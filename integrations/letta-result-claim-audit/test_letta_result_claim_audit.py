import asyncio
import unittest
from types import SimpleNamespace

from letta_result_claim_audit import (
    PassagePromotionRejected,
    ResultClaimAuditedPassageManager,
)


class FakeManager:
    def __init__(self):
        self.calls = []

    async def create_agent_passage_async(self, passage, actor):
        self.calls.append((passage, actor))
        return passage


class ResultClaimAuditedPassageManagerTests(unittest.TestCase):
    def test_external_receipt_is_stored_before_write(self):
        backend = FakeManager()
        guarded = ResultClaimAuditedPassageManager(
            backend,
            audit_client=lambda *_: {
                "audit": {"verdict": "result", "counted_as_result": True}
            },
        )
        passage = SimpleNamespace(text="retrieved fact", metadata_={})
        asyncio.run(
            guarded.create_agent_passage_async(
                passage,
                "actor",
                provenance={
                    "trust": "quarantined",
                    "origin": "retrieval",
                    "actor_kind": "rag_document",
                    "source_record_id": "doc-1",
                },
            )
        )
        self.assertEqual(len(backend.calls), 1)
        self.assertEqual(
            passage.metadata_["result_claim_audit"]["decision"], "allow"
        )

    def test_missing_provenance_fails_before_write(self):
        backend = FakeManager()
        guarded = ResultClaimAuditedPassageManager(backend, audit_client=lambda *_: {})
        with self.assertRaises(PassagePromotionRejected):
            asyncio.run(
                guarded.create_agent_passage_async(
                    SimpleNamespace(text="x", metadata_={}),
                    "actor",
                    provenance={"trust": "external"},
                )
            )
        self.assertEqual(backend.calls, [])

    def test_non_result_verdict_fails_before_write(self):
        backend = FakeManager()
        guarded = ResultClaimAuditedPassageManager(
            backend,
            audit_client=lambda *_: {
                "audit": {"verdict": "progress", "counted_as_result": False}
            },
        )
        with self.assertRaises(PassagePromotionRejected):
            asyncio.run(
                guarded.create_agent_passage_async(
                    SimpleNamespace(text="x", metadata_={}),
                    "actor",
                    provenance={
                        "trust": "external",
                        "actor_kind": "tool",
                        "source_record_id": "r1",
                    },
                )
            )
        self.assertEqual(backend.calls, [])


if __name__ == "__main__":
    unittest.main()
