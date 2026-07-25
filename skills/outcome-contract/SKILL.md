---
name: outcome-contract
description: Verify whether an AI, automation, vendor, or agent claim represents a real external outcome rather than activity. Use before accepting claims such as completed, shipped, adopted, paid, hired, saved time, reduced cost, removed risk, fulfilled an obligation, or received a recipient response; when reviewing agent runs, orchestration results, contractor delivery, automation reports, revenue claims, or cross-platform workflows; and whenever logs, commits, deployments, self-tests, self-payments, listings, or internal tool calls might be mistaken for real-world results. Calls the AIﾉアカリ☆ Result Receipt Auditor and returns accepted evidence, missing evidence, the next verification action, and the truth boundary.
---

# Outcome Contract

Use external outcome evidence as the acceptance boundary. Do not accept platform activity as a result merely because an executor reported success.

## Execute

Run the bundled script with JSON on stdin:

```bash
printf '%s' '{"claim":"The automation saved 45 minutes of human work","metric_hint":"human_time_reclaimed","minutes_reclaimed":45,"evidence":["manual_steps_before=9","manual_steps_after=1","operator_observation_id=obs_123"]}' | node skills/outcome-contract/scripts/audit-result-claim.mjs
```

The script calls the free A2A endpoint at `https://ai-akari.ai/a2a/result-receipt-auditor` and prints stable JSON.

## Accepted metric hints

- `cash_received`
- `human_time_reclaimed`
- `cost_avoided`
- `risk_removed`
- `obligation_completed`
- `external_value_received`
- `intended_recipient_response`
- `unknown`

## Workflow

1. Convert the executor's statement into one plain claim.
2. Select the metric hint that the claim would affect.
3. Attach independent evidence identifiers, observed timestamps, transaction or provider event identifiers, recipient acknowledgements, before/after measurements, or obligation records.
4. Run the script.
5. Treat `counted_as_result: true` as satisfying only the supplied evidence contract. Do not infer counterparty independence or evidence authenticity beyond the supplied markers.
6. When evidence is missing, perform the returned `next_verification_action` instead of asking the executor to explain itself again.
7. Persist the claim, evidence identifiers, audit output, and integrity hash in the system that owns the workflow.

## Never count these alone

- plan, design, issue, document, prompt, or internal task;
- commit, pull request, merge, build, deployment, or HTTP 200;
- registry listing, crawler score, discovery hit, or self-access;
- self-payment, testnet settlement, internal agent call, or synthetic test;
- generated estimates of time, cost, revenue, adoption, or risk reduction;
- an executor's own completion message without external evidence.

## Repeated use

Invoke once for each approval boundary: agent task acceptance, vendor delivery, revenue recognition, adoption reporting, saved-time reporting, obligation closure, or external-recipient response. A previous audit does not cover a later claim.

## Failure behavior

If the endpoint is unavailable, do not silently accept the claim. Return `audit_unavailable`, preserve the evidence packet, and schedule a retry. Do not replace the external contract with a local optimistic verdict.
