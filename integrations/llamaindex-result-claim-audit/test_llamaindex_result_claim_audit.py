import unittest
from types import SimpleNamespace

from llamaindex_result_claim_audit import (
    MemoryPromotionRejected,
    ResultClaimAuditedMemory,
)


class FakeMemory:
    def __init__(self):
        self.calls = []

    def put(self, message):
        self.calls.append(message)
        return None

    def set(self, messages):
        self.calls.extend(messages)
        return None


class ResultClaimAuditedMemoryTests(unittest.TestCase):
    def test_external_receipt_is_attached_before_write(self):
        backend = FakeMemory()
        guarded = ResultClaimAuditedMemory(
            backend,
            audit_client=lambda *_: {
                "audit": {"verdict": "result", "counted_as_result": True}
            },
        )
        message = SimpleNamespace(content="fact", role="user", additional_kwargs={})
        result = guarded.put(
            message,
            provenance={
                "trust": "quarantined",
                "origin": "rag",
                "actor_kind": "retriever",
                "source_record_id": "node-7",
            },
        )
        self.assertEqual(len(backend.calls), 1)
        self.assertEqual(result["result_claim_audit"]["decision"], "allow")
        self.assertIn("result_claim_audit", message.additional_kwargs)

    def test_non_result_verdict_fails_before_write(self):
        backend = FakeMemory()
        guarded = ResultClaimAuditedMemory(
            backend,
            audit_client=lambda *_: {
                "audit": {"verdict": "progress", "counted_as_result": False}
            },
        )
        message = SimpleNamespace(content="x", role="user", additional_kwargs={})
        with self.assertRaises(MemoryPromotionRejected):
            guarded.put(
                message,
                provenance={
                    "trust": "external",
                    "actor_kind": "tool",
                    "source_record_id": "x1",
                },
            )
        self.assertEqual(backend.calls, [])

    def test_foreground_write_remains_compatible(self):
        backend = FakeMemory()
        guarded = ResultClaimAuditedMemory(backend)
        message = SimpleNamespace(
            content="operator preference", role="user", additional_kwargs={}
        )
        guarded.put(message)
        self.assertEqual(len(backend.calls), 1)


if __name__ == "__main__":
    unittest.main()
