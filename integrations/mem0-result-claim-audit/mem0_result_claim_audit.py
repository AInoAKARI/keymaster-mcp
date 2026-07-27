"""Fail-closed Result Claim Audit gate for Mem0 memory writes.

Wraps a ``mem0.Memory``-compatible object without modifying Mem0 itself.
External/quarantined writes are audited before ``memory.add`` is called.
"""
from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Mapping, Optional

DEFAULT_ENDPOINT = (
    "https://rnudxlnsjqohzyvesvdx.supabase.co/functions/v1/"
    "result-claim-audit-free"
)
DEFAULT_TIMEOUT_SECONDS = 2.0
CLIENT_NAME = "mem0-result-claim-audit/0.1"
_EXTERNAL_TRUST = frozenset({"external", "quarantined", "untrusted"})


class MemoryPromotionRejected(RuntimeError):
    """Raised when a candidate is not authorized for persistent memory."""


AuditClient = Callable[[str, Dict[str, Any], float], Dict[str, Any]]


def _canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def _sha256(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _default_audit_client(
    endpoint: str, payload: Dict[str, Any], timeout_seconds: float
) -> Dict[str, Any]:
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "user-agent": CLIENT_NAME,
            "x-akari-client-name": CLIENT_NAME,
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        if response.status != 200:
            raise RuntimeError(f"audit_http_{response.status}")
        raw = response.read(1_000_000)
    parsed = json.loads(raw.decode("utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError("audit_response_not_object")
    return parsed


class ResultClaimAuditedMemory:
    """A drop-in write gate around a Mem0 ``Memory``-compatible instance.

    The wrapped object is expected to expose ``add(messages, **kwargs)``.
    All other attributes are delegated to the wrapped object.
    """

    def __init__(
        self,
        memory: Any,
        *,
        endpoint: str = DEFAULT_ENDPOINT,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        audit_client: Optional[AuditClient] = None,
    ) -> None:
        self._memory = memory
        self._endpoint = endpoint
        self._timeout_seconds = min(max(float(timeout_seconds), 0.1), 10.0)
        self._audit_client = audit_client or _default_audit_client

    def __getattr__(self, name: str) -> Any:
        return getattr(self._memory, name)

    @staticmethod
    def _requires_audit(provenance: Mapping[str, Any]) -> bool:
        trust = _text(provenance.get("trust")).lower()
        origin = _text(provenance.get("origin")).lower() or "foreground"
        return trust in _EXTERNAL_TRUST or origin != "foreground"

    @staticmethod
    def _validate_provenance(provenance: Mapping[str, Any]) -> Dict[str, str]:
        normalized = {
            "trust": _text(provenance.get("trust")).lower() or "quarantined",
            "origin": _text(provenance.get("origin")).lower() or "external",
            "actor_kind": _text(provenance.get("actor_kind")),
            "source_record_id": _text(provenance.get("source_record_id")),
            "source_ref": _text(provenance.get("source_ref")),
        }
        missing = [
            key
            for key in ("actor_kind", "source_record_id")
            if not normalized[key]
        ]
        if missing:
            raise MemoryPromotionRejected(
                "missing provenance: " + ", ".join(missing)
            )
        return normalized

    def add(
        self,
        messages: Any,
        *,
        provenance: Optional[Mapping[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Any:
        """Audit an external candidate, then call the wrapped ``memory.add``.

        ``provenance`` is consumed by this wrapper and is not forwarded as a
        top-level Mem0 argument. The resulting audit receipt is stored inside
        Mem0's normal ``metadata`` object.
        """
        supplied = dict(provenance or {})
        if not self._requires_audit(supplied):
            return self._memory.add(
                messages,
                metadata=dict(metadata or {}),
                **kwargs,
            )

        normalized = self._validate_provenance(supplied)
        candidate = {
            "messages": messages,
            "provenance": normalized,
            "scope": {
                key: kwargs.get(key)
                for key in ("user_id", "agent_id", "run_id")
                if kwargs.get(key) is not None
            },
        }
        content_sha256 = _sha256(candidate)
        payload = {
            "claim": (
                "Promote a quarantined external memory candidate into "
                "trusted persistent memory."
            ),
            "metric_hint": "risk_removed",
            "evidence": [
                (
                    "risk_before=external-origin content is quarantined and "
                    "cannot authoritatively modify trusted memory"
                ),
                (
                    "risk_after=promotion is allowed only after an explicit "
                    "provenance contract and audit verdict pass"
                ),
                (
                    "verification_record="
                    f"external_actor_kind={normalized['actor_kind']};"
                    f"usage_event_id={normalized['source_record_id']};"
                    f"source_trust={normalized['trust']};"
                    f"content_sha256={content_sha256}"
                ),
            ],
        }

        try:
            response = self._audit_client(
                self._endpoint, payload, self._timeout_seconds
            )
        except (
            urllib.error.URLError,
            TimeoutError,
            OSError,
            RuntimeError,
            ValueError,
            json.JSONDecodeError,
        ) as exc:
            raise MemoryPromotionRejected(
                f"audit unavailable; memory remains quarantined: "
                f"{type(exc).__name__}"
            ) from exc

        audit = response.get("audit")
        if not isinstance(audit, dict):
            raise MemoryPromotionRejected(
                "malformed audit response; memory remains quarantined"
            )
        allowed = (
            audit.get("counted_as_result") is True
            and _text(audit.get("verdict")) == "result"
        )
        if not allowed:
            reason = _text(audit.get("next_verification_action"))
            suffix = f": {reason}" if reason else ""
            raise MemoryPromotionRejected(
                "audit did not authorize memory promotion" + suffix
            )

        observed_at = datetime.now(timezone.utc).isoformat()
        receipt = {
            "schema_version": "mem0-result-claim-audit/0.1",
            "client": CLIENT_NAME,
            "observed_at": observed_at,
            "decision": "allow",
            "verdict": "result",
            "content_sha256": content_sha256,
            "audit_input_sha256": _sha256(payload),
            "audit_output_sha256": _sha256(response),
            "source": normalized,
        }
        enhanced_metadata = dict(metadata or {})
        enhanced_metadata["result_claim_audit"] = receipt

        result = self._memory.add(
            messages,
            metadata=enhanced_metadata,
            **kwargs,
        )
        return {
            "memory_result": result,
            "result_claim_audit": receipt,
        }
