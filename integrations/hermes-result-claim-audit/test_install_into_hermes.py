import pytest

import install_into_hermes as installer


SOURCE = '''def _apply_write_gate(action: str, target: str, content: Optional[str],
                      old_text: Optional[str]) -> Optional[str]:
    if action not in {"add", "replace", "remove"}:
        return None
    try:
        from tools import write_approval as wa
    except Exception:
        return None
    # Build a small inline summary/detail for the foreground approval prompt.
    label = "user profile" if target == "user" else "memory"
    payload = {
        "action": action,
        "target": target,
        "content": content,
        "old_text": old_text,
    }
    record = wa.stage_write(
        wa.MEMORY, payload,
        summary="single",
        origin=wa.current_origin(),
    )


def _apply_batch_write_gate(target: str, operations: List[Dict[str, Any]]) -> Optional[str]:
    try:
        from tools import write_approval as wa
    except Exception:
        return None
    label = "user profile" if target == "user" else "memory"
    summary = f"apply {len(operations)} op(s) to {label}"
    payload = {"action": "batch", "target": target, "operations": operations}
    record = wa.stage_write(
        wa.MEMORY, payload,
        summary="batch",
        origin=wa.current_origin(),
    )


def memory_tool(
    action: str = None,
    target: str = "memory",
    content: str = None,
    old_text: str = None,
    operations: Optional[List[Dict[str, Any]]] = None,
    store: Optional[MemoryStore] = None,
) -> str:
    if operations:
        gate_result = _apply_batch_write_gate(target, operations)
    gate_result = _apply_write_gate(action, target, content, old_text)


def apply_memory_pending(payload: Dict[str, Any], store: "MemoryStore") -> Dict[str, Any]:
    action = payload.get("action")
    target = payload.get("target", "memory")
    content = payload.get("content") or ""
    old_text = payload.get("old_text") or ""
    if action == "batch":
        return store.apply_batch(target, payload.get("operations") or [])


MEMORY_SCHEMA = {
    "parameters": {
        "type": "object",
        "properties": {
            "operations": {
                "type": "array",
            },
        },
    },
}

registry.register(
    name="memory",
    handler=lambda args, **kw: memory_tool(
        action=args.get("action", ""),
        target=args.get("target", "memory"),
        content=args.get("content"),
        old_text=args.get("old_text"),
        operations=args.get("operations"),
        store=kw.get("store")),
)
'''


def test_installer_exposes_and_forwards_provenance():
    patched = installer.patch_memory_tool(SOURCE)

    assert 'provenance: Optional[Dict[str, Any]] = None' in patched
    assert '"provenance": {' in patched
    assert '"required": ["trust", "actor_kind", "source_record_id"]' in patched
    assert 'provenance=args.get("provenance")' in patched
    assert '_apply_batch_write_gate(target, operations, provenance)' in patched
    assert '_apply_write_gate(action, target, content, old_text, provenance)' in patched
    assert 'provenance = payload.get("provenance")' in patched
    assert 'origin=wa.current_origin()' not in patched


def test_installer_refuses_double_application():
    patched = installer.patch_memory_tool(SOURCE)
    with pytest.raises(RuntimeError):
        installer.patch_memory_tool(patched)
'''
