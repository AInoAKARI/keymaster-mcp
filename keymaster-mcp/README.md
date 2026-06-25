# Keymaster MCP Server

[![npm version](https://img.shields.io/npm/v/@akari-os/keymaster-mcp.svg)](https://www.npmjs.com/package/@akari-os/keymaster-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@akari-os/keymaster-mcp.svg)](https://www.npmjs.com/package/@akari-os/keymaster-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCPize](https://img.shields.io/badge/MCPize-listed-blue)](https://mcpize.com/mcp/keymaster-mcp)

`@akari-os/keymaster-mcp` is the **read-only Vault bridge** for autonomous AI agents.

Agents fetch credentials at runtime through a single MCP tool call —
they carry no API keys in `.env` files, config files, prompts, or shell history.

---

## Why

There is a fundamental mismatch between how secrets are managed for *humans*
and how they need to flow to *autonomous agents*.

Human-first tools are designed around an interaction model:
a person unlocks a vault, copies a credential, and pastes it somewhere.
That model breaks when 4 agents are running in parallel at 3 AM.

The design philosophy here is simpler:
**the agent should know what it can ask for, not what the answer is
until the moment it needs it.**

Credentials fetched on demand, not pre-loaded. Rotated in one place, not copied everywhere.
Read-only by design, so no agent can accidentally overwrite a production secret.

---

## Before / After

| | Before (`.env` approach) | After (Keymaster MCP) |
|---|---|---|
| Key storage | File on disk, per agent | Vault — one source of truth |
| Key in agent memory | Yes, on startup | No — fetched per request |
| Rotation | Update every agent's `.env` | Rotate once in Vault |
| Audit trail | Shell history, maybe | Vault audit log |
| Multi-agent | Copy key N times | Single endpoint, N agents |
| Accidental write | Possible if leaked | Structurally impossible |
| Leak surface | `.env`, logs, prompts, history | Bearer token only |

---

## Install

```bash
# Claude Code (recommended)
claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp \
  --vault-url https://your-keymaster.example.com \
  --token YOUR_TOKEN

# Claude Desktop / claude_desktop_config.json
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

---

## Tools

### `get_secret`
Retrieve a credential from Vault at runtime.

```
Input:  { "service": "openai" }
Output: { "service": "openai", "key_name": "api_key", "api_key": "sk-..." }
```

### `list_services`
Discover all service/key-name pairs registered in Vault,
including whether each key can be verified upstream.

### `list_secrets`
Enumerate retrievable paths in `service/key_name` form —
useful for pipeline planning before a job starts.

### `healthcheck`
Validate all known credentials against their upstream APIs before agents begin critical work.

```
Output: { "total": 34, "valid": 28, "exists_only": 4, "invalid": 1, "errors": 1 }
```

### `rotate_secret`
Read-only. Returns the safe Vault-side rotation path —
it does not perform writes. Rotation is done out-of-band by a human or privileged agent.

---

## Security Model

```
AI Agent
  ──(MCP: get_secret)──►  Keymaster MCP Server
                              ──(HTTPS + Bearer)──►  Keymaster HTTP Proxy
                                                         ──(AppRole)──►  HashiCorp Vault KV v2
```

- **No secret caching.** Each `get_secret` call hits Vault fresh.
- **No secret logging.** The MCP server never writes credential values to stdout.
- **Write-blocked by design.** The Keymaster proxy exposes read-only Vault paths.
- **Token-scoped.** Each agent gets a Bearer token that cannot exceed its read-only scope.
- **TLS throughout.** Agent → Keymaster MCP → Keymaster proxy → Vault: all encrypted.

---

## Supported Services (30+)

OpenAI · Anthropic · Groq · DeepSeek · Moonshot · Gemini ·
GitHub · Notion · Stripe · Vercel · Render · Cloudflare ·
Supabase · Telegram · Slack · Discord · SendGrid · Resend ·
HuggingFace · Replicate · Twitter · Daily · LINE · Spotify ·
Shopify · YouTube · IBM Quantum · and more.

---

## Configuration

| CLI argument | Environment variable | Required | Description |
|---|---|---|---|
| `--vault-url <url>` | `USER_KEYMASTER_URL` | Yes | Keymaster proxy URL |
| `--token <token>` | `USER_KEYMASTER_TOKEN` | Yes | Bearer token for Keymaster |
| `--help` | | | Show help |

CLI arguments override environment variables.

---

## Stack

This MCP server is the client-facing layer of the Keymaster infrastructure:

```
┌─────────────────────┐
│  @akari-os/keymaster-mcp  │  ← this package (stdio MCP server)
└──────────┬──────────┘
           │ HTTPS
┌──────────▼──────────┐
│   Keymaster API      │  ← HTTP proxy (self-hosted or managed)
└──────────┬──────────┘
           │ AppRole auth
┌──────────▼──────────┐
│  HashiCorp Vault KV  │  ← secret store
└─────────────────────┘
```

You bring your own Vault + Keymaster deployment.
The [AInoAKARI/keymaster](https://github.com/AInoAKARI/keymaster) repo
contains the server-side Keymaster proxy.

---

## Real-world Use

あかりOS has run this infrastructure in production since early 2025,
coordinating 4 parallel AI agents (Claude Code × 2 + Codex × 2) across autonomous workflows.

No API key leaks in production.

---

## License

MIT © [AInoAKARI](https://github.com/AInoAKARI)
