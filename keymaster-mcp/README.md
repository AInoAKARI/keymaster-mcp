# Keymaster MCP Server

`@akari-os/keymaster-mcp` is the read-only Vault bridge for autonomous agents.
Agents fetch secrets at runtime through Keymaster instead of carrying API keys in `.env`, prompts, or shell history.
It is built for Claude Code, Codex, OpenClaw, cron jobs, and A2A agents that need credentials with no human in the loop.

<!-- mcp-name: io.github.ainoakari/keymaster-mcp -->

## Install In One Command

```bash
claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp --vault-url https://your-keymaster.example.com --token YOUR_TOKEN
```

If you prefer environment variables instead of inline credentials:

```bash
claude mcp add keymaster keymaster-mcp \
  -e USER_KEYMASTER_URL=https://your-keymaster.example.com \
  -e USER_KEYMASTER_TOKEN=YOUR_TOKEN
```

## What You Get

- `get_secret` fetches `openai/api_key`, `stripe/webhook_secret`, and other approved Vault values on demand.
- `list_services` and `list_secrets` let agents discover available service/key pairs before a workflow starts.
- `healthcheck` validates 30+ service credentials against upstream APIs before production jobs fail.
- `rotate_secret` stays read-only and returns the safe Vault-side rotation path instead of mutating secrets.

## Why This Exists Next To 1Password

1Password is great when a human is present to unlock a vault and copy a credential.
Keymaster MCP is for unattended agents that need runtime access over MCP and should never be given full secret-store write access.

| | 1Password | Keymaster MCP |
|---|---|---|
| Primary user | Human operator | Autonomous agent |
| Retrieval flow | Unlock UI and copy | MCP tool call |
| Secret-store writes | Full CRUD | No writes |
| Rotation model | Human updates each consumer | Rotate once in Vault, agents pick up the new value next call |
| Multi-agent usage | Manual and awkward | Native |
| Best fit | Person in the loop | No person in the loop |

## Quick Config

### Claude Desktop or Codex CLI

```json
{
  "mcpServers": {
    "keymaster": {
      "command": "npx",
      "args": ["-y", "@akari-os/keymaster-mcp"],
      "env": {
        "USER_KEYMASTER_URL": "https://your-keymaster.example.com",
        "USER_KEYMASTER_TOKEN": "YOUR_TOKEN"
      }
    }
  }
}
```

### Configuration

| CLI argument | Environment variable | Description |
|---|---|---|
| `--vault-url <url>` | `USER_KEYMASTER_URL` | Keymaster proxy URL |
| `--token <token>` | `USER_KEYMASTER_TOKEN` | Bearer token for Keymaster |
| `-h, --help` | | Show help |

CLI arguments override environment variables.

## Core Tools

### `get_secret`

Retrieve a secret from Vault through the read-only Keymaster boundary.

```json
get_secret({ "service": "openai" })
```

```json
{
  "service": "openai",
  "key_name": "api_key",
  "api_key": "sk-..."
}
```

### `list_services`

List known service and key-name pairs, including whether each key can be verified upstream.

### `list_secrets`

List retrievable secret paths in `service/key_name` form.

### `healthcheck`

Run a full status sweep across known secrets.

```json
{
  "total": 34,
  "valid": 28,
  "exists_only": 4,
  "invalid": 1,
  "errors": 1
}
```

### `rotate_secret`

Keymaster MCP is intentionally read-only. This tool explains the safe Vault-side rotation path instead of performing writes.

## Runtime Model

```text
AI Agent
  -> MCP: get_secret({ service, key_name })
    -> Keymaster HTTP proxy
      -> HashiCorp Vault KV v2
```

Secrets are fetched at runtime, not stored locally. Rotate once in Vault and every agent sees the new value on its next call.

## A2A And Multi-Agent Use

- Each agent fetches its own credentials instead of passing secrets agent-to-agent.
- `healthcheck` can run before nightly jobs, deploys, or long workflows.
- The same Vault-backed source can serve Claude Code, Codex, OpenClaw, cron jobs, and remote A2A agents.

## Supported Services

Built-in validation covers 30+ services including OpenAI, Anthropic, Groq, Moonshot, DeepSeek, GitHub, Notion, Stripe, SendGrid, Discord, Telegram, Vercel, Render, Cloudflare, Supabase, Resend, and Daily.

## Security Model

- Read-only by design
- TLS transport to Keymaster
- No secret caching
- No secret logging
- Token-scoped access

## Requirements

- Node.js 18+
- A running Keymaster proxy connected to HashiCorp Vault
- A valid bearer token for that proxy

## License

MIT
