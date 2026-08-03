# Start here

Choose the smallest useful entry point. You do not need to adopt the entire stack at once.

## Path A — verify whether an AI result is real

Use this when an agent, automation, contractor, or vendor says a task is complete and you need to distinguish a real external outcome from internal activity.

```text
$skill-installer install https://github.com/AInoAKARI/keymaster-mcp/tree/main/skills/outcome-contract
```

Run `outcome-contract` before accepting claims such as delivery, saved time, payment, risk removal, external adoption, or a recipient response.

The skill returns whether the claim can be counted, accepted evidence, missing evidence, the next verification action, and the boundary of what the verdict proves.

This path uses the free AIﾉアカリ☆ Result Receipt Auditor and does not require your own Vault deployment.

## Path B — let agents inspect capability without receiving credentials

Use this when agents need to know whether OpenAI, Anthropic, GitHub, Stripe, Notion, Vercel, Supabase, or another approved capability is available and healthy.

Prerequisites:

- a Keymaster HTTPS proxy connected to HashiCorp Vault;
- a read-only bearer token supplied by the MCP host's secret binding;
- Node.js 18 or later.

```bash
claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp \
  --vault-url https://your-keymaster.example.com
```

The agent receives:

- `secret_status` — check availability without returning a credential;
- `list_services` — see supported service/key-name pairs;
- `list_secrets` — list approved paths as metadata;
- `healthcheck` — validate credentials upstream and receive status only;
- `rotate_secret` — receive safe rotation guidance without submitting a value.

Do not pass a token with `--token`. Version 1.1.0 rejects secret command-line arguments.

## Path C — understand the operating model

Read [The philosophy behind Keymaster](./PHILOSOPHY.md) and [the threat model](./THREAT-MODEL.md).

> Let the agent understand capability and evidence. Keep credential custody and privileged execution behind a trusted boundary.

## A practical first adoption

1. register one low-risk credential in Vault;
2. connect Keymaster through a read-only host secret binding;
3. remove one manual availability-check or secret-copy step;
4. use `secret_status` or `healthcheck` before the workflow;
5. execute the authenticated operation inside a trusted service-specific workload;
6. use Outcome Contract at the acceptance boundary;
7. preserve the evidence packet and result receipt.

Do not measure success by installation alone. Measure whether a human step disappeared, a secret-copy path was removed, a risk was reduced, or an independently acknowledged outcome was completed.
