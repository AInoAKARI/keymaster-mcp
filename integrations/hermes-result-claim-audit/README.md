# Hermes Agent × Result Claim Audit

Executable and removable integration for `NousResearch/hermes-agent` issue #18559.

It places a fail-closed audit before external, quarantined, or autonomous-origin content can be promoted into `MEMORY.md` or `USER.md`.

## Behavior

- Adds a standard-library-only audit adapter.
- Adds an optional `provenance` object to Hermes memory writes.
- Requires `actor_kind` and `source_record_id` for audited candidates.
- Calls the free single-claim Result Claim Audit API with a bounded timeout.
- On timeout, API failure, malformed output, missing provenance, or a non-result verdict, the candidate is staged as quarantined and trusted memory is unchanged.
- Stores decision, reason, origin, source, proposed-write SHA-256, audit hashes, result, and time in `<HERMES_HOME>/provenance/memory.jsonl`.
- Re-audits quarantined candidates when pending approval is applied.
- Leaves direct foreground operator writes unchanged unless explicitly marked external or quarantined.
- Sends the fixed client name `hermes-memory-provenance/0.1`; the free endpoint records only client name, metric, verdict, and whether the claim passed. Claim text and evidence are not stored in that external execution event.

## Install

From this directory:

```bash
python install_into_hermes.py /path/to/hermes-agent
python -m pytest -q /path/to/hermes-agent/tests/tools/test_memory_provenance_audit.py
```

The installer is pinned to upstream `tools/memory_tool.py` Git blob:

`463b6b5149c70770a500fc7d0ab22f41daddd0ba`

It refuses source drift and creates `tools/memory_tool.py.pre-result-claim-audit` for rollback.

After installation, maintainers can produce the exact patch from their checkout:

```bash
git diff -- tools/memory_tool.py tools/memory_provenance_audit.py tests/tools/test_memory_provenance_audit.py > hermes-result-claim-audit.patch
```

## Config

```yaml
memory:
  provenance_audit:
    enabled: true
    endpoint: https://rnudxlnsjqohzyvesvdx.supabase.co/functions/v1/result-claim-audit-free
    timeout_seconds: 2.0
```

No secret or API key is required.

## Example

```json
{
  "action": "add",
  "target": "memory",
  "content": "The external project uses a sidecar provenance index.",
  "provenance": {
    "trust": "quarantined",
    "actor_kind": "github_issue",
    "source_record_id": "NousResearch/hermes-agent#18559",
    "source_ref": "https://github.com/NousResearch/hermes-agent/issues/18559"
  }
}
```

Success: the audit returns `verdict=result` and `counted_as_result=true`; Hermes writes the entry and records provenance.

Failure: Hermes returns `success=true`, `staged=true`, `quarantined=true`; the entry remains outside trusted memory and is visible under `/memory pending`.

## Verified locally

```text
5 passed in 1.05s
```

Covered paths: complete provenance, missing provenance, API unavailable, non-result verdict, and unchanged foreground writes.

## External telemetry database requirement

`ai-akari-result-auditor` writes minimal usage events to `akari_agent_events` with `device_id=external-mcp:<client>`. That ledger has a foreign key to `akari_agent_devices`. Without a matching telemetry-only device row, PostgREST rejects the event even though the audit response itself succeeds.

Apply `supabase_external_telemetry_fk.sql` once to create the parent record automatically before each external MCP event. The migration keeps RLS and the foreign key intact, stores no claim/evidence text, and does not turn a call into proof of adoption. The production database was verified with a rolled-back service-role insertion after the trigger was installed.

## Boundary

The audit validates the supplied evidence contract and hashes. It does not independently authenticate the issuer named by `source_record_id`. A future native Hermes provenance model can replace caller-supplied fields without removing the fail-closed promotion boundary.

External execution telemetry is deliberately minimal and is not a proof of adoption by itself. A call is counted as third-party use only after its client and external context are independently attributable; internal probes carry `X-Akari-Internal-Test: 1` and are excluded.

## Rollback

Restore `tools/memory_tool.py.pre-result-claim-audit`, remove `tools/memory_provenance_audit.py`, and remove the added test file.

For telemetry rollback:

```sql
drop trigger if exists trg_ensure_external_mcp_agent_device on public.akari_agent_events;
drop function if exists public.ensure_external_mcp_agent_device();
```
