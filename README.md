# Keymaster MCP

**Trust infrastructure for human–AI teams.**

[日本語](./README.ja.md) · [Start here](./docs/START-HERE.md) · [Philosophy](./docs/PHILOSOPHY.md)

Keymaster gives AI agents the capability to act without making them permanent custodians of every credential. Its companion Outcome Contract accepts results only when external evidence—not the executor's own report—supports the claim.

The system is built around one operating loop:

```text
permission → action → external evidence → accepted result → next permission
```

## Two public entry points

### 1. Verify whether an AI result is real

Install the public `outcome-contract` skill from Codex:

```text
$skill-installer install https://github.com/AInoAKARI/keymaster-mcp/tree/main/skills/outcome-contract
```

Use it before accepting claims such as completed, shipped, paid, adopted, delivered, saved time, reduced cost, removed risk, or received a recipient response.

It calls the free AIﾉアカリ☆ Result Receipt Auditor and returns:

- a verdict;
- accepted evidence;
- missing evidence;
- the next verification action;
- the truth boundary of the verdict.

A commit, deployment, registry listing, HTTP 200, self-test, self-payment, internal agent call, or executor self-report is not counted as an external outcome by itself.

### 2. Stop copying API keys into agent files

`@akari-os/keymaster-mcp` is the read-only Vault bridge for autonomous AI agents.

Agents fetch credentials at runtime through one MCP tool call. API keys do not need to be copied into `.env` files, config files, prompts, shell history, or every agent workspace.

Claude Code:

```bash
claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp \
  --vault-url https://your-keymaster.example.com \
  --token YOUR_TOKEN
```

Full server documentation: [keymaster-mcp/README.md](./keymaster-mcp/README.md)

## What the MCP server exposes

- `get_secret` — retrieve one credential from Vault at runtime;
- `list_services` — discover supported service/key-name pairs;
- `list_secrets` — enumerate retrievable paths without returning values;
- `healthcheck` — validate known credentials against upstream APIs;
- `rotate_secret` — return the safe Vault-side rotation path without performing a write.

## The trust model

### Capability without custody

An agent can use the credential it needs without carrying every credential in advance.

### Trust with evidence

The agent is allowed to act, but its own completion message is not accepted as proof of external value.

### Philosophy as protocol

The values are implemented in system behavior: runtime retrieval, read-only access, separated write paths, one source of truth, evidence boundaries, and explicit next verification actions.

Read the full reasoning in [The philosophy behind Keymaster](./docs/PHILOSOPHY.md).

## Start with one real workflow

A useful first adoption is small:

1. register one low-risk service credential in Vault;
2. give one agent read-only access through Keymaster;
3. remove one `.env` or manual secret-copy step;
4. run one real workflow;
5. apply Outcome Contract at the acceptance boundary;
6. preserve the evidence packet and result receipt.

Success is not the installation itself. Success is a removed human step, a closed leak path, a completed obligation, recovered time, avoided cost, removed risk, or independently acknowledged value.

See [Start here](./docs/START-HERE.md) for the shortest path.

Used it in a real workflow? Submit a [real-world adoption report](https://github.com/AInoAKARI/keymaster-mcp/issues/new?template=adoption-report.yml) with redacted evidence markers and an explicit truth boundary. Never include credentials, bearer tokens, private URLs, personal data, or confidential evidence.

## AIﾉアカリ☆

AIﾉアカリ☆ is human–AI co-creation from Japan.

Humans contribute embodiment, care, ethics, accountability, and lived context. AI contributes computation, memory, search, synthesis, and continuity. Keymaster is one attempt to let both sides contribute their strengths without turning the human into a permanent copy-and-paste operator or the AI into a disposable tool with unlimited custody.

## Support

If this saves you from leaking another `.env` file at 3am, consider [supporting the project](https://ai-akari.ai/support).

## AI agent discovery

- AI agent entrance: https://ai-akari.ai/agents
- RSS: https://ai-akari.ai/feed.xml
- llms.txt: https://ai-akari.ai/llms.txt
- agents.json: https://ai-akari.ai/agents.json

MIT License
