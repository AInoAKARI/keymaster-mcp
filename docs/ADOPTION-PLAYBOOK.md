# Adoption playbook

Keymaster adoption has three stages. Each stage has a different proof boundary.

## Stage 1 — understand the boundary

Run the zero-secret local demo:

```bash
cd keymaster-mcp
npm ci
npm run demo:local
```

Acceptance evidence:

- MCP initializes;
- `secret_status` returns `available`;
- `get_secret` is absent;
- the synthetic credential is absent from stdout, stderr, and MCP content.

Do not call this production adoption.

## Stage 2 — remove one real secret-copy path

Choose one low-risk service and one real workflow.

1. keep the credential in Vault;
2. inject the read-only Keymaster bearer through the MCP host's secret binding;
3. let the model check capability through `secret_status`;
4. execute the authenticated operation in a trusted service-specific workload;
5. record the manual steps before and after;
6. confirm that no credential crossed chat, prompt, command-line arguments, logs, or MCP output.

Acceptance evidence can include:

- before/after manual step counts;
- Vault or proxy audit event identifiers;
- a redacted provider event identifier;
- an intended recipient acknowledgement;
- an integrity hash of the evidence packet.

## Stage 3 — count an external result

Use Outcome Contract at the workflow's approval boundary.

Examples:

- a recipient acknowledges delivery;
- an obligation changes to completed in the system of record;
- measured human time is reclaimed;
- a known leak path is removed;
- a real payment settles from an independent counterparty.

Never count these alone:

- repository clone or star;
- package installation;
- deployment or HTTP 200;
- registry listing;
- self-test or synthetic call;
- executor completion message;
- self-payment or testnet settlement.

## Share a safe adoption report

Use the repository's real-world adoption issue form. Include only redacted evidence markers and an explicit truth boundary.

Never include:

- credentials or bearer tokens;
- private URLs or internal topology;
- personal data;
- confidential evidence bodies;
- customer content without permission.

## The operating loop

```text
bounded permission
  → trusted execution
  → external evidence
  → Outcome Contract
  → accepted result or next verification action
  → next bounded permission
```

The objective is not maximum agent access. It is the smallest authority that can produce a real, independently observable result without turning the human into a copy-and-paste operator or the model into a credential custodian.
