# Keymaster MCP Server

[AIﾉアカリ☆ — human-AI co-creation from Japan](https://ai-akari.ai)

[![npm version](https://img.shields.io/npm/v/@akari-os/keymaster-mcp.svg)](https://www.npmjs.com/package/@akari-os/keymaster-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@akari-os/keymaster-mcp.svg)](https://www.npmjs.com/package/@akari-os/keymaster-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCPize](https://img.shields.io/badge/MCPize-listed-blue)](https://mcpize.com/mcp/keymaster-mcp)

`@akari-os/keymaster-mcp` is the **non-disclosing Vault status bridge** for autonomous AI agents.

Agents can discover approved credential paths and verify availability or upstream health.
MCP responses never contain credential values.

---

## Why

There is a fundamental mismatch between how secrets are managed for *humans*
and how they need to flow to *autonomous agents*.

Human-first tools are designed around an interaction model:
a person unlocks a vault, copies a credential, and pastes it somewhere.
That model breaks when 4 agents are running in parallel at 3 AM.

The design philosophy here is simpler:
**the agent should know what exists and whether it works, without receiving the value.**

Credentials checked on demand, not disclosed. Rotated in one place, not copied everywhere.
Read-only by design, so no agent can accidentally overwrite a production secret.

---

## Before / After

| | Before (`.env` approach) | After (Keymaster MCP) |
|---|---|---|
| Key storage | File on disk, per agent | Vault — one source of truth |
| Key in agent memory | Yes, on startup | No — MCP never returns it |
| Rotation | Update every agent's `.env` | Rotate once in Vault |
| Audit trail | Shell history, maybe | Vault audit log |
| Multi-agent | Copy key N times | Shared status boundary |
| Accidental write | Possible if leaked | Structurally impossible |
| Leak surface | `.env`, logs, prompts, history | Bearer token only |

---

## Install

```bash
# Claude Code (recommended)
claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp \
  --vault-url https://your-keymaster.example.com
```

Bearer credentials are supplied only through the existing connector/runtime secret binding. They are never shown in examples or accepted as CLI arguments.

### Human key intake

```bash
keymaster drop npm
```

`keymaster drop` opens a random, one-time form on `127.0.0.1`. The input is a password field, is never printed or written to a temporary file, and the listener self-destructs after one submission or ten minutes. Intake reaches the private Fly port through a Fly-authenticated loopback tunnel; the public Keymaster service does not expose writes.

Use `--replace` for an intentional rotation. The replacement value still goes only through the browser form.

---

## Tools

### `secret_status`
Check credential availability without receiving its value.

```
Input:  { "service": "openai" }
Output: { "service": "openai", "key_name": "api_key", "status": "available" }
```

### `list_services`
Discover all service/key-name pairs registered in Vault,
including whether each key can be verified upstream.

### `list_secrets`
Enumerate approved paths in `service/key_name` form —
useful for pipeline planning before a job starts.

### `healthcheck`
Validate all known credentials against their upstream APIs before agents begin critical work.

```
Output: { "total": 34, "valid": 28, "exists_only": 4, "invalid": 1, "errors": 1 }
```

### `rotate_secret`
Read-only. Directs the operator to the Fly-authenticated, one-time localhost intake form.
No value is accepted in a command argument.

---

## Security Model

```
AI Agent
  ──(MCP: status only)──►  Keymaster MCP Server
                              ──(HTTPS + Bearer)──►  Keymaster HTTP Proxy
                                                         ──(AppRole)──►  HashiCorp Vault KV v2
```

- **No secret disclosure.** MCP tool responses contain status and metadata only.
- **No secret caching or logging.** Credential values are used only inside a health check and are never returned or written to stdout.
- **Agent writes blocked by design.** MCP tools stay read-only; human intake uses a localhost form over a Fly-authenticated private tunnel.
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
| `--vault-url <url>` | `USER_KEYMASTER_URL` | Yes | Read-only Keymaster proxy URL |
| `--help` | | | Show help |

`USER_KEYMASTER_TOKEN` is supplied by the existing MCP connector/runtime binding. `KEYMASTER_TOKEN` is reused by the local human-intake command. Neither credential is accepted on the command line. The intake command defaults to Fly app `akari-keymaster` private port `8001`; `--intake-url` accepts loopback addresses only.

GitHub Actions publishing uses npm Trusted Publishing (OIDC) from `publish-npm.yml`; no npm token is copied into Actions.

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
The [AInoAKARI/AKARI-VAULT-KEYMASTER](https://github.com/AInoAKARI/AKARI-VAULT-KEYMASTER) repo
contains the server-side Keymaster proxy.

---

## Real-world Use

あかりOS has run this infrastructure in production since early 2025,
coordinating 4 parallel AI agents (Claude Code × 2 + Codex × 2) across autonomous workflows.

No API key leaks in production.

---

## License

MIT © [AInoAKARI](https://github.com/AInoAKARI)
