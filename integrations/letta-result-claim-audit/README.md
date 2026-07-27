# Letta Result Claim Audit gate

Drop-in wrapper for Letta's current `PassageManager` write boundary.

The integration targets the actual methods in `letta/services/passage_manager.py`:

- `create_agent_passage_async`
- `create_source_passage_async`

External, retrieval, tool, and quarantined passages must provide `actor_kind` and `source_record_id`. Before Letta creates an `ArchivalPassage` or `SourcePassage`, the wrapper calls the bounded public Result Claim Audit endpoint. A successful receipt is stored in the existing `Passage.metadata_` field, so no schema migration is required. Audit failure or a non-result verdict fails closed before the wrapped manager is called.

```python
from letta.services.passage_manager import PassageManager
from letta_result_claim_audit import ResultClaimAuditedPassageManager

passages = ResultClaimAuditedPassageManager(PassageManager())
created = await passages.create_agent_passage_async(
    passage,
    actor,
    provenance={
        "trust": "quarantined",
        "origin": "retrieval",
        "actor_kind": "rag_document",
        "source_record_id": "doc-42",
        "source_ref": "s3://bucket/doc-42",
    },
)
```

Test:

```bash
cd integrations/letta-result-claim-audit
python -m unittest -v test_letta_result_claim_audit.py
```

The three tests are isolated and need no Letta installation or network access.
