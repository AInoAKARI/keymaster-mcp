"""Fail-closed provenance audit adapter for Hermes persistent memory writes.

Copy to ``tools/memory_provenance_audit.py`` in NousResearch/hermes-agent.
Uses only the Python standard library.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

DEFAULT_ENDPOINT = (
    "https://rnudxlnsjqohzyvesvdx.supabase.co/functions/v1/"
    "result-claim-audit-free"
)
DEFAULT_TIMEOUT_SECONDS = 2.0
CLIENT_NAME = "hermes-memory-provenance/0.1"
_EXTERNAL_TRUST = {"external", "quarantined", "untrusted"}


@dataclass(frozen=True)
class AuditDecision:
    allow: bool
    reason: str
    audit: Dict[str, Any]
    record: Dict[str, Any]


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _canonical_hash(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _load_config() -> Dict[str, Any]:
    try:
        from hermes_cli.config import load_config  # type: ignore

        cfg = load_config() or {}
        memory = cfg.get("memory", {}) or {}
        audit = memory.get("provenance_audit", {}) or {}
        return audit if isinstance(audit, dict) else {}
    except Exception:
        return {}


def audit_enabled(config: Optional[Dict[str, Any]] = None) -> bool:
    cfg = config if config is not None else _load_config()
    raw = cfg.get("enabled", False)
    if isinstance(raw, bool):
        return raw
    return _text(raw).lower() in {"1", "true", "yes", "on", "enabled"}


def requires_audit(origin: str, provenance: Optional[Dict[str, Any]]) -> bool:
    p = provenance or {}
    trust = _text(p.get("trust")).lower()
    return origin != "foreground" or trust in _EXTERNAL_TRUST


def _provenance_path(config: Dict[str, Any]) -> Path:
    configured = _text(config.get("log_path"))
    if configured:
        return Path(configured).expanduser()
    try:
        from hermes_constants import get_hermes_home  # type: ignore

        root = get_hermes_home()
    except Exception:
        root = Path.home() / ".hermes"
    return root / "provenance" / "memory.jsonl"


def _append_record(path: Path, record: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n"
    fd = os.open(path, os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o600)
    try:
        os.write(fd, line.encode("utf-8"))
        os.fsync(fd)
    finally:
        os.close(fd)


def _post_json(endpoint: str, payload: Dict[str, Any], timeout: float) -> Dict[str, Any]:
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
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"audit_http_{response.status}")
        body = response.read(1_000_000)
    parsed = json.loads(body.decode("utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError("audit_response_not_object")
    return parsed


def audit_memory_write(
    *,
    action: str,
    target: str,
    content: Any,
    old_text: Any,
    operations: Optional[Iterable[Dict[str, Any]]],
    origin: str,
    provenance: Optional[Dict[str, Any]],
    config: Optional[Dict[str, Any]] = None,
) -> AuditDecision:
    """Audit one proposed trusted-memory mutation.

    Missing provenance, timeout, service failure, malformed output, and a
    non-result verdict all fail closed. Each audited attempt is recorded in
    provenance JSONL. Foreground operator writes remain unchanged unless they
    are explicitly marked external or quarantined.
    """
    cfg = dict(config if config is not None else _load_config())
    p = dict(provenance or {})
    normalized_origin = _text(origin) or "foreground"

    if not audit_enabled(cfg) or not requires_audit(normalized_origin, p):
        return AuditDecision(True, "audit_not_required", {}, {})

    actor_kind = _text(p.get("actor_kind"))
    source_record_id = _text(p.get("source_record_id"))
    trust = _text(p.get("trust")).lower() or "quarantined"
    source_ref = _text(p.get("source_ref"))
    proposed = {
        "action": action,
        "target": target,
        "content": content,
        "old_text": old_text,
        "operations": list(operations or []),
    }
    content_hash = _canonical_hash(proposed)
    base_record: Dict[str, Any] = {
        "schema_version": "hermes-memory-provenance/0.1",
        "observed_at": time.time(),
        "origin": normalized_origin,
        "trust": trust,
        "actor_kind": actor_kind,
        "source_record_id": source_record_id,
        "source_ref": source_ref,
        "action": action,
        "target": target,
        "proposed_write_sha256": content_hash,
    }

    missing = [
        name
        for name, value in (("actor_kind", actor_kind), ("source_record_id", source_record_id))
        if not value
    ]
    if missing:
        record = {
            **base_record,
            "decision": "quarantine",
            "reason": "missing_provenance",
            "missing": missing,
        }
        _append_record(_provenance_path(cfg), record)
        return AuditDecision(False, f"missing provenance: {', '.join(missing)}", {}, record)

    payload = {
        "claim": "Promote a quarantined external memory candidate into trusted persistent memory.",
        "metric_hint": "risk_removed",
        "evidence": [
            "risk_before=external-origin content is quarantined and cannot authoritatively modify trusted memory",
            "risk_after=promotion is allowed only after an explicit provenance contract and audit verdict pass",
            (
                "verification_record="
                f"external_actor_kind={actor_kind};usage_event_id={source_record_id};"
                f"source_trust={trust};content_sha256={content_hash}"
            ),
        ],
    }
    endpoint = _text(cfg.get("endpoint")) or DEFAULT_ENDPOINT
    try:
        timeout = float(cfg.get("timeout_seconds", DEFAULT_TIMEOUT_SECONDS))
    except (TypeError, ValueError):
        timeout = DEFAULT_TIMEOUT_SECONDS
    timeout = min(max(timeout, 0.1), 10.0)

    try:
        audit = _post_json(endpoint, payload, timeout)
        result = audit.get("audit") if isinstance(audit.get("audit"), dict) else {}
        allow = result.get("counted_as_result") is True and _text(result.get("verdict")) == "result"
        reason = "audit_passed" if allow else "audit_did_not_authorize_promotion"
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, RuntimeError, json.JSONDecodeError) as exc:
        audit = {}
        allow = False
        reason = f"audit_unavailable:{type(exc).__name__}"

    record = {
        **base_record,
        "decision": "allow" if allow else "quarantine",
        "reason": reason,
        "audit_endpoint": endpoint,
        "audit_input_sha256": _canonical_hash(payload),
        "audit_output_sha256": _canonical_hash(audit),
        "audit": audit,
    }
    _append_record(_provenance_path(cfg), record)
    return AuditDecision(allow, reason, audit, record)
