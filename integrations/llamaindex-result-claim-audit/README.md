# LlamaIndex Result Claim Audit gate

Drop-in wrapper for LlamaIndex memory writes. It targets the current `VectorMemory.put` / `VectorMemory.set` boundary before `_commit_node` calls `vector_index.insert_nodes`.

External, RAG, tool, and quarantined messages require source provenance. An accepted receipt is written into the native `ChatMessage.additional_kwargs` field and the underlying memory receives the message only after the audit passes. Audit failure and non-result verdicts fail closed.

```python
from llama_index.core.memory.vector_memory import VectorMemory
from llamaindex_result_claim_audit import ResultClaimAuditedMemory

memory = ResultClaimAuditedMemory(VectorMemory.from_defaults())
memory.put(
    message,
    provenance={
        "trust": "quarantined",
        "origin": "rag",
        "actor_kind": "retriever",
        "source_record_id": "node-7",
        "source_ref": "https://example.test/node-7",
    },
)
```

Test:

```bash
cd integrations/llamaindex-result-claim-audit
python -m unittest -v test_llamaindex_result_claim_audit.py
```

The three tests are isolated and need no LlamaIndex installation or network access.
