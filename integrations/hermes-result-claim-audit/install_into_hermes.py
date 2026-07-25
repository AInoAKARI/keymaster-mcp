#!/usr/bin/env python3
"""Install the Result Claim Audit memory gate into a Hermes Agent checkout.

Pinned to the current upstream memory-tool Git blob. Unknown source is refused;
``--force-source`` still requires every exact hunk to match once.
"""
from __future__ import annotations

import argparse
import hashlib
import shutil
from pathlib import Path

EXPECTED_MEMORY_TOOL_BLOB = "463b6b5149c70770a500fc7d0ab22f41daddd0ba"


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one source match, found {count}")
    return text.replace(old, new, 1)


def patch_memory_tool(text: str) -> str:
    """Return the fully patched Hermes memory tool or fail on source drift."""
    text = replace_once(
        text,
        "def _apply_write_gate(action: str, target: str, content: Optional[str],\n"
        "                      old_text: Optional[str]) -> Optional[str]:",
        "def _apply_write_gate(action: str, target: str, content: Optional[str],\n"
        "                      old_text: Optional[str],\n"
        "                      provenance: Optional[Dict[str, Any]] = None) -> Optional[str]:",
        "single gate signature",
    )

    marker = '    # Build a small inline summary/detail for the foreground approval prompt.\n    label = "user profile" if target == "user" else "memory"\n'
    insertion = '''    origin = wa.current_origin()\n    try:\n        from tools.memory_provenance_audit import audit_memory_write\n        audit_decision = audit_memory_write(\n            action=action, target=target, content=content, old_text=old_text,\n            operations=None, origin=origin, provenance=provenance,\n        )\n        audit_failure = ""\n    except Exception as exc:\n        audit_decision = None\n        audit_failure = (\n            f"provenance audit adapter failed closed: {type(exc).__name__}"\n            if origin != "foreground" or provenance else ""\n        )\n\n    if (audit_decision is not None and not audit_decision.allow) or audit_failure:\n        payload = {\n            "action": action, "target": target, "content": content,\n            "old_text": old_text, "provenance": provenance, "origin": origin,\n        }\n        reason = audit_failure or audit_decision.reason\n        record = wa.stage_write(\n            wa.MEMORY, payload,\n            summary=f"quarantined {action} to {target}: {(content or old_text or '')[:120]}",\n            origin=origin,\n        )\n        return json.dumps(\n            {"success": True, "staged": True, "quarantined": True,\n             "pending_id": record["id"], "message": reason},\n            ensure_ascii=False,\n        )\n\n    # Build a small inline summary/detail for the foreground approval prompt.\n    label = "user profile" if target == "user" else "memory"\n'''
    text = replace_once(text, marker, insertion, "single provenance hook")
    text = replace_once(
        text,
        '        "old_text": old_text,\n    }\n    record = wa.stage_write(',
        '        "old_text": old_text,\n        "provenance": provenance,\n        "origin": origin,\n    }\n    record = wa.stage_write(',
        "single staged payload",
    )
    text = replace_once(text, "        origin=wa.current_origin(),\n", "        origin=origin,\n", "single stage origin")

    text = replace_once(
        text,
        "def _apply_batch_write_gate(target: str, operations: List[Dict[str, Any]]) -> Optional[str]:",
        "def _apply_batch_write_gate(target: str, operations: List[Dict[str, Any]],\n"
        "                            provenance: Optional[Dict[str, Any]] = None) -> Optional[str]:",
        "batch gate signature",
    )
    batch_marker = '    label = "user profile" if target == "user" else "memory"\n    summary = f"apply {len(operations)} op(s) to {label}"\n'
    batch_insertion = '''    origin = wa.current_origin()\n    try:\n        from tools.memory_provenance_audit import audit_memory_write\n        audit_decision = audit_memory_write(\n            action="batch", target=target, content=None, old_text=None,\n            operations=operations, origin=origin, provenance=provenance,\n        )\n        audit_failure = ""\n    except Exception as exc:\n        audit_decision = None\n        audit_failure = (\n            f"provenance audit adapter failed closed: {type(exc).__name__}"\n            if origin != "foreground" or provenance else ""\n        )\n\n    if (audit_decision is not None and not audit_decision.allow) or audit_failure:\n        payload = {"action": "batch", "target": target, "operations": operations,\n                   "provenance": provenance, "origin": origin}\n        reason = audit_failure or audit_decision.reason\n        record = wa.stage_write(wa.MEMORY, payload,\n                                summary=f"quarantined batch to {target}", origin=origin)\n        return json.dumps(\n            {"success": True, "staged": True, "quarantined": True,\n             "pending_id": record["id"], "message": reason},\n            ensure_ascii=False,\n        )\n\n    label = "user profile" if target == "user" else "memory"\n    summary = f"apply {len(operations)} op(s) to {label}"\n'''
    text = replace_once(text, batch_marker, batch_insertion, "batch provenance hook")
    text = replace_once(
        text,
        '    payload = {"action": "batch", "target": target, "operations": operations}\n',
        '    payload = {"action": "batch", "target": target, "operations": operations,\n               "provenance": provenance, "origin": origin}\n',
        "batch staged payload",
    )
    text = replace_once(text, "        origin=wa.current_origin(),\n", "        origin=origin,\n", "batch stage origin")

    text = replace_once(
        text,
        "    operations: Optional[List[Dict[str, Any]]] = None,\n    store: Optional[MemoryStore] = None,",
        "    operations: Optional[List[Dict[str, Any]]] = None,\n    provenance: Optional[Dict[str, Any]] = None,\n    store: Optional[MemoryStore] = None,",
        "memory_tool provenance parameter",
    )
    text = replace_once(
        text,
        "        gate_result = _apply_batch_write_gate(target, operations)\n",
        "        gate_result = _apply_batch_write_gate(target, operations, provenance)\n",
        "batch gate call",
    )
    text = replace_once(
        text,
        "    gate_result = _apply_write_gate(action, target, content, old_text)\n",
        "    gate_result = _apply_write_gate(action, target, content, old_text, provenance)\n",
        "single gate call",
    )

    approval_marker = '''    action = payload.get("action")\n    target = payload.get("target", "memory")\n    content = payload.get("content") or ""\n    old_text = payload.get("old_text") or ""\n'''
    approval_insertion = '''    action = payload.get("action")\n    target = payload.get("target", "memory")\n    content = payload.get("content") or ""\n    old_text = payload.get("old_text") or ""\n    provenance = payload.get("provenance")\n    origin = payload.get("origin") or "quarantined"\n    if provenance or origin != "foreground":\n        try:\n            from tools.memory_provenance_audit import audit_memory_write\n            decision = audit_memory_write(\n                action=action or "", target=target, content=content, old_text=old_text,\n                operations=payload.get("operations") or [], origin=origin,\n                provenance=provenance,\n            )\n        except Exception as exc:\n            return {"success": False, "error":\n                    f"Provenance audit failed closed during approval: {type(exc).__name__}"}\n        if not decision.allow:\n            return {"success": False, "quarantined": True, "error": decision.reason}\n'''
    text = replace_once(text, approval_marker, approval_insertion, "pending re-audit")

    schema_marker = '''            "operations": {\n                "type": "array",\n'''
    schema_insertion = '''            "provenance": {\n                "type": "object",\n                "additionalProperties": False,\n                "description": (\n                    "Source and trust metadata for external or quarantined memory candidates. "\n                    "Required by the provenance audit before such content can become trusted memory."\n                ),\n                "properties": {\n                    "trust": {\n                        "type": "string",\n                        "enum": ["external", "quarantined", "untrusted"],\n                    },\n                    "actor_kind": {"type": "string"},\n                    "source_record_id": {"type": "string"},\n                    "source_ref": {"type": "string"},\n                },\n                "required": ["trust", "actor_kind", "source_record_id"],\n            },\n            "operations": {\n                "type": "array",\n'''
    text = replace_once(text, schema_marker, schema_insertion, "provenance tool schema")
    text = replace_once(
        text,
        '        operations=args.get("operations"),\n        store=kw.get("store")),',
        '        operations=args.get("operations"),\n        provenance=args.get("provenance"),\n        store=kw.get("store")),',
        "registry provenance forwarding",
    )
    return text


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("hermes_repo", type=Path)
    parser.add_argument("--force-source", action="store_true")
    args = parser.parse_args()
    root = args.hermes_repo.resolve()
    memory_tool = root / "tools" / "memory_tool.py"
    adapter_source = Path(__file__).with_name("hermes_memory_provenance.py")
    adapter_target = root / "tools" / "memory_provenance_audit.py"
    test_source = Path(__file__).with_name("test_hermes_memory_provenance.py")
    test_target = root / "tests" / "tools" / "test_memory_provenance_audit.py"

    data = memory_tool.read_bytes()
    blob = git_blob_sha(data)
    if blob != EXPECTED_MEMORY_TOOL_BLOB and not args.force_source:
        raise SystemExit(
            f"Refusing unknown tools/memory_tool.py blob {blob}; "
            f"expected {EXPECTED_MEMORY_TOOL_BLOB}."
        )

    text = patch_memory_tool(data.decode("utf-8"))
    backup = memory_tool.with_suffix(".py.pre-result-claim-audit")
    if not backup.exists():
        shutil.copy2(memory_tool, backup)
    memory_tool.write_text(text, encoding="utf-8")
    shutil.copy2(adapter_source, adapter_target)
    shutil.copy2(test_source, test_target)
    print(f"installed: {adapter_target}")
    print(f"patched:   {memory_tool}")
    print(f"test:      python -m pytest -q {test_target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
