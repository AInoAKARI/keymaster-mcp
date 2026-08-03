# Start here

Choose the smallest useful entry point. You do not need to adopt the entire stack at once.

## Path A — verify whether an AI result is real

Use this when an agent, automation, contractor, or vendor says a task is complete and you need to distinguish a real external outcome from internal activity.

Install the public skill from Codex:

```text
$skill-installer install https://github.com/AInoAKARI/keymaster-mcp/tree/main/skills/outcome-contract
```

Then ask the agent to run `outcome-contract` before accepting claims such as:

- “the customer received the delivery”;
- “the automation saved 45 minutes”;
- “the payment was received”;
- “the risk was removed”;
- “the release was adopted externally.”

The skill returns:

- whether the claim can be counted as a result;
- accepted evidence;
- missing evidence;
- the next verification action;
- the boundary of what the verdict proves.

This path uses the free AIﾉアカリ☆ Result Receipt Auditor and does not require your own Vault deployment.

## Path B — stop placing API keys in agent files

Use this when one or more AI agents need runtime access to OpenAI, Anthropic, GitHub, Stripe, Notion, Vercel, Supabase, or other services.

Prerequisites:

- a running Keymaster HTTP proxy connected to HashiCorp Vault;
- a read-only Keymaster bearer token;
- Node.js 18 or later.

Claude Code:

```bash
claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp \
  --vault-url https://your-keymaster.example.com \
  --token YOUR_TOKEN
```

After installation, the agent receives these tools:

- `get_secret` — fetch one credential at runtime;
- `list_services` — see supported service/key-name pairs;
- `list_secrets` — plan available secret paths without returning values;
- `healthcheck` — validate configured credentials against upstream services;
- `rotate_secret` — return the safe Vault-side rotation path without performing a write.

## Path C — understand the operating model

Read [The philosophy behind Keymaster](./PHILOSOPHY.md).

The central idea is:

> Give agents the capability to act without making them permanent custodians of every credential, then accept outcomes only when reality provides evidence.

## A practical first adoption

A useful first deployment is deliberately small:

1. register one low-risk service credential in Vault;
2. give one agent read-only access through Keymaster;
3. replace one `.env` or manual copy-paste step;
4. run one real workflow;
5. use Outcome Contract at the acceptance boundary;
6. preserve the evidence packet and result receipt.

Do not measure success by installation alone. Measure whether a human step disappeared, a secret-copy path was removed, or an independently acknowledged outcome was completed.
