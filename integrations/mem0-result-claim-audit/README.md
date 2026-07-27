# Mem0 Result Claim Audit gate

This adapter prevents external or quarantined content from reaching `Memory.add`
until a bounded Result Claim Audit authorizes promotion.

It uses Mem0's existing `metadata` parameter, so no Mem0 fork or schema change is
required. A successful write stores a timestamped receipt containing:

- content SHA-256
- audit input and output SHA-256
- verdict and decision
- source actor, source record ID, trust class, and source reference

Timeout, network failure, malformed output, missing provenance, or any verdict
other than `result` fails closed. The wrapped `Memory.add` is not called.

## Usage

```python
from mem0 import Memory
from mem0_result_claim_audit import ResultClaimAuditedMemory

memory = ResultClaimAuditedMemory(Memory())

result = memory.add(
    [{"role": "user", "content": "Fact extracted from an external document."}],
    user_id="user-123",
    provenance={
        "trust": "quarantined",
        "origin": "retrieval",
        "actor_kind": "rag_document",
        "source_record_id": "document-42",
        "source_ref": "https://example.com/document-42",
    },
    metadata={"workflow": "support-rag"},
)
```

Foreground/operator writes remain compatible:

```python
memory.add(
    "The operator prefers concise answers.",
    user_id="user-123",
    metadata={"source": "operator"},
)
```

## Failure behavior

Catch `MemoryPromotionRejected` and leave the candidate in the caller's existing
quarantine or review queue:

```python
from mem0_result_claim_audit import MemoryPromotionRejected

try:
    memory.add(...)
except MemoryPromotionRejected as exc:
    quarantine_queue.put({"candidate": candidate, "reason": str(exc)})
```

The default audit endpoint needs no wallet, API key, environment variable, or
new paid service. A custom `audit_client` may be injected for private deployment
or tests.

## Test

```bash
cd integrations/mem0-result-claim-audit
python -m unittest -v test_mem0_result_claim_audit.py
```

The tests use a fake Mem0-compatible backend and perform no network calls.

## Upstream integration point

Mem0's current OSS `Memory.add` accepts `metadata` and calls
`_add_to_vector_store` only after normalizing that metadata. This wrapper gates
the call before persistence and puts the receipt into the same metadata object,
preserving normal `user_id`, `agent_id`, and `run_id` scoping.
