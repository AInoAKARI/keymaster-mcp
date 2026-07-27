"""Fail-closed write gate for LlamaIndex VectorMemory.put/set."""
from __future__ import annotations

import hashlib
import json
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable, Mapping, Optional

DEFAULT_ENDPOINT = "https://rnudxlnsjqohzyvesvdx.supabase.co/functions/v1/result-claim-audit-free"
_EXTERNAL = frozenset({"external", "quarantined", "untrusted"})


class MemoryPromotionRejected(RuntimeError):
    """Raised before externally sourced content reaches LlamaIndex memory."""


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _sha(value: Any) -> str:
    return hashlib.sha256(_canonical(value).encode()).hexdigest()


def _post(endpoint: str, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode(),
        headers={
            "content-type": "application/json",
            "accept": "application/json",
            "user-agent": "llamaindex-result-claim-audit/0.1",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"audit_http_{response.status}")
        result = json.loads(response.read(1_000_000))
    if not isinstance(result, dict):
        raise ValueError("audit_response_not_object")
    return result


class ResultClaimAuditedMemory:
    """Wrap any LlamaIndex BaseMemory-compatible object.

    For current VectorMemory this gate runs before put() reaches _commit_node()
    and vector_index.insert_nodes(). The receipt is attached to the native
    ChatMessage.additional_kwargs mapping.
    """

    def __init__(
        self,
        memory: Any,
        *,
        endpoint: str = DEFAULT_ENDPOINT,
        timeout_seconds: float = 2.0,
        audit_client: Optional[Callable[[str, dict[str, Any], float], dict[str, Any]]] = None,
    ) -> None:
        self._memory = memory
        self._endpoint = endpoint
        self._timeout = min(max(float(timeout_seconds), 0.1), 10.0)
        self._audit = audit_client or _post

    def __getattr__(self, name: str) -> Any:
        return getattr(self._memory, name)

    def _guard(
        self, message: Any, provenance: Optional[Mapping[str, Any]]
    ) -> Optional[dict[str, Any]]:
        source = dict(provenance or {})
        trust = str(source.get("trust", "foreground")).strip().lower()
        origin = str(source.get("origin", "foreground")).strip().lower()
        if trust not in _EXTERNAL and origin == "foreground":
            return None

        actor_kind = str(source.get("actor_kind", "")).strip()
        source_record_id = str(source.get("source_record_id", "")).strip()
        if not actor_kind or not source_record_id:
            raise MemoryPromotionRejected(
                "missing provenance: actor_kind and source_record_id are required"
            )

        candidate = {
            "content": getattr(message, "content", None),
            "role": str(getattr(message, "role", "")),
            "source": source,
        }
        content_sha = _sha(candidate)
        payload = {
            "claim": "Promote externally sourced content into durable LlamaIndex memory.",
            "metric_hint": "risk_removed",
            "evidence": [
                f"external_actor_kind={actor_kind}",
                f"usage_event_id={source_record_id}",
                f"content_sha256={content_sha}",
                "risk_after=VectorMemory.put runs only after provenance and audit pass",
            ],
        }
        try:
            response = self._audit(self._endpoint, payload, self._timeout)
        except Exception as exc:
            raise MemoryPromotionRejected(
                f"audit unavailable; memory remains quarantined: {type(exc).__name__}"
            ) from exc

        audit = response.get("audit") if isinstance(response, dict) else None
        if (
            not isinstance(audit, dict)
            or audit.get("counted_as_result") is not True
            or audit.get("verdict") != "result"
        ):
            raise MemoryPromotionRejected("audit did not authorize memory promotion")

        receipt = {
            "schema_version": "llamaindex-result-claim-audit/0.1",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "decision": "allow",
            "content_sha256": content_sha,
            "audit_input_sha256": _sha(payload),
            "audit_output_sha256": _sha(response),
            "source": source,
        }
        additional_kwargs = getattr(message, "additional_kwargs", None)
        if isinstance(additional_kwargs, dict):
            additional_kwargs["result_claim_audit"] = receipt
        return receipt

    def put(
        self, message: Any, *, provenance: Optional[Mapping[str, Any]] = None
    ) -> Any:
        receipt = self._guard(message, provenance)
        result = self._memory.put(message)
        if receipt:
            return {"memory_result": result, "result_claim_audit": receipt}
        return result

    def set(
        self,
        messages: list[Any],
        *,
        provenance: Optional[Mapping[str, Any]] = None,
    ) -> Any:
        for message in messages:
            self._guard(message, provenance)
        return self._memory.set(messages)
