"""Fail-closed provenance gate for Letta archival/source passage writes."""
from __future__ import annotations

import asyncio
import hashlib
import json
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable, Mapping, Optional

DEFAULT_ENDPOINT = "https://rnudxlnsjqohzyvesvdx.supabase.co/functions/v1/result-claim-audit-free"
_EXTERNAL = frozenset({"external", "quarantined", "untrusted"})


class PassagePromotionRejected(RuntimeError):
    """Raised before Letta persists an unauthorized passage."""


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
            "user-agent": "letta-result-claim-audit/0.1",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"audit_http_{response.status}")
        body = response.read(1_000_000)
    result = json.loads(body)
    if not isinstance(result, dict):
        raise ValueError("audit_response_not_object")
    return result


class ResultClaimAuditedPassageManager:
    """Wrap Letta PassageManager and gate external passage writes.

    The receipt is stored in Passage.metadata_, which is already copied into
    ArchivalPassage and SourcePassage by Letta's current PassageManager.
    """

    def __init__(
        self,
        manager: Any,
        *,
        endpoint: str = DEFAULT_ENDPOINT,
        timeout_seconds: float = 2.0,
        audit_client: Optional[Callable[[str, dict[str, Any], float], dict[str, Any]]] = None,
    ) -> None:
        self._manager = manager
        self._endpoint = endpoint
        self._timeout = min(max(float(timeout_seconds), 0.1), 10.0)
        self._audit_client = audit_client or _post

    def __getattr__(self, name: str) -> Any:
        return getattr(self._manager, name)

    async def _guard(self, passage: Any, provenance: Optional[Mapping[str, Any]]) -> Any:
        source = dict(provenance or {})
        trust = str(source.get("trust", "foreground")).strip().lower()
        origin = str(source.get("origin", "foreground")).strip().lower()
        if trust not in _EXTERNAL and origin == "foreground":
            return passage

        actor_kind = str(source.get("actor_kind", "")).strip()
        source_record_id = str(source.get("source_record_id", "")).strip()
        if not actor_kind or not source_record_id:
            raise PassagePromotionRejected(
                "missing provenance: actor_kind and source_record_id are required"
            )

        text = getattr(passage, "text", None)
        if text is None and hasattr(passage, "model_dump"):
            text = passage.model_dump().get("text", "")
        candidate = {
            "text": text or "",
            "actor_kind": actor_kind,
            "source_record_id": source_record_id,
            "origin": origin,
            "trust": trust,
        }
        content_sha = _sha(candidate)
        payload = {
            "claim": "Promote an externally sourced passage into durable Letta memory.",
            "metric_hint": "risk_removed",
            "evidence": [
                f"external_actor_kind={actor_kind}",
                f"usage_event_id={source_record_id}",
                f"content_sha256={content_sha}",
                "risk_after=passage is persisted only after provenance and external audit pass",
            ],
        }
        try:
            response = await asyncio.to_thread(
                self._audit_client, self._endpoint, payload, self._timeout
            )
        except Exception as exc:
            raise PassagePromotionRejected(
                f"audit unavailable; passage remains quarantined: {type(exc).__name__}"
            ) from exc

        audit = response.get("audit") if isinstance(response, dict) else None
        if (
            not isinstance(audit, dict)
            or audit.get("counted_as_result") is not True
            or audit.get("verdict") != "result"
        ):
            raise PassagePromotionRejected("audit did not authorize passage promotion")

        metadata = dict(getattr(passage, "metadata_", None) or {})
        metadata["result_claim_audit"] = {
            "schema_version": "letta-result-claim-audit/0.1",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "decision": "allow",
            "content_sha256": content_sha,
            "audit_input_sha256": _sha(payload),
            "audit_output_sha256": _sha(response),
            "source": source,
        }
        setattr(passage, "metadata_", metadata)
        return passage

    async def create_agent_passage_async(
        self,
        pydantic_passage: Any,
        actor: Any,
        *,
        provenance: Optional[Mapping[str, Any]] = None,
    ) -> Any:
        guarded = await self._guard(pydantic_passage, provenance)
        return await self._manager.create_agent_passage_async(guarded, actor)

    async def create_source_passage_async(
        self,
        pydantic_passage: Any,
        file_metadata: Any,
        actor: Any,
        *,
        provenance: Optional[Mapping[str, Any]] = None,
    ) -> Any:
        guarded = await self._guard(pydantic_passage, provenance)
        return await self._manager.create_source_passage_async(
            guarded, file_metadata, actor
        )
