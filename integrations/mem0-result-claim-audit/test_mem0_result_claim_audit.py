import unittest

from mem0_result_claim_audit import (
    MemoryPromotionRejected,
    ResultClaimAuditedMemory,
)


class FakeMemory:
    def __init__(self):
        self.calls = []

    def add(self, messages, **kwargs):
        self.calls.append((messages, kwargs))
        return {"results": [{"id": "mem-1", "event": "ADD"}]}


def passing_audit(_endpoint, _payload, _timeout):
    return {
        "audit": {
            "verdict": "result",
            "counted_as_result": True,
            "missing_evidence": [],
        }
    }


class ResultClaimAuditedMemoryTests(unittest.TestCase):
    def test_external_write_is_audited_and_receipt_is_persisted(self):
        backend = FakeMemory()
        guarded = ResultClaimAuditedMemory(
            backend, audit_client=passing_audit
        )
        result = guarded.add(
            "Remember this external fact.",
            user_id="user-1",
            provenance={
                "trust": "quarantined",
                "actor_kind": "retrieval",
                "source_record_id": "doc-42",
                "source_ref": "https://example.invalid/doc-42",
            },
            metadata={"project": "alpha"},
        )

        self.assertEqual(len(backend.calls), 1)
        _, kwargs = backend.calls[0]
        receipt = kwargs["metadata"]["result_claim_audit"]
        self.assertEqual(receipt["decision"], "allow")
        self.assertEqual(receipt["source"]["source_record_id"], "doc-42")
        self.assertEqual(len(receipt["content_sha256"]), 64)
        self.assertIn("memory_result", result)

    def test_missing_provenance_fails_before_backend_write(self):
        backend = FakeMemory()
        guarded = ResultClaimAuditedMemory(
            backend, audit_client=passing_audit
        )
        with self.assertRaisesRegex(
            MemoryPromotionRejected, "missing provenance"
        ):
            guarded.add(
                "Unattributed fact",
                user_id="user-1",
                provenance={"trust": "external"},
            )
        self.assertEqual(backend.calls, [])

    def test_timeout_fails_closed(self):
        backend = FakeMemory()

        def timeout_audit(*_args):
            raise TimeoutError("slow")

        guarded = ResultClaimAuditedMemory(
            backend, audit_client=timeout_audit
        )
        with self.assertRaisesRegex(
            MemoryPromotionRejected, "audit unavailable"
        ):
            guarded.add(
                "Candidate",
                user_id="user-1",
                provenance={
                    "trust": "external",
                    "actor_kind": "tool",
                    "source_record_id": "tool-call-1",
                },
            )
        self.assertEqual(backend.calls, [])

    def test_non_result_verdict_fails_closed(self):
        backend = FakeMemory()

        def rejected_audit(*_args):
            return {
                "audit": {
                    "verdict": "evidence_missing",
                    "counted_as_result": False,
                    "next_verification_action": "Add a source event ID.",
                }
            }

        guarded = ResultClaimAuditedMemory(
            backend, audit_client=rejected_audit
        )
        with self.assertRaisesRegex(
            MemoryPromotionRejected, "did not authorize"
        ):
            guarded.add(
                "Candidate",
                user_id="user-1",
                provenance={
                    "trust": "quarantined",
                    "actor_kind": "subagent",
                    "source_record_id": "subagent-1",
                },
            )
        self.assertEqual(backend.calls, [])

    def test_foreground_write_bypasses_external_audit(self):
        backend = FakeMemory()

        def must_not_run(*_args):
            raise AssertionError("audit should not run")

        guarded = ResultClaimAuditedMemory(
            backend, audit_client=must_not_run
        )
        result = guarded.add(
            "Operator preference",
            user_id="user-1",
            metadata={"source": "operator"},
        )
        self.assertEqual(result["results"][0]["id"], "mem-1")
        self.assertEqual(len(backend.calls), 1)


if __name__ == "__main__":
    unittest.main()
