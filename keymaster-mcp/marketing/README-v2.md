# Keymaster MCP Server

`@akari-os/keymaster-mcp` is the **non-disclosing Vault status bridge** for autonomous AI agents.

Agents discover approved credential paths and verify availability or upstream health.
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

Connector credentials come only from the existing runtime secret binding and are never shown in examples.

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
Read-only. Directs rotation to the Fly-authenticated one-time localhost browser form.

---

## Security Model

```
AI Agent
  ──(MCP: status only)──►  Keymaster MCP Server
                              ──(HTTPS + Bearer)──►  Keymaster HTTP Proxy
                                                         ──(AppRole)──►  HashiCorp Vault KV v2
```

- **No secret disclosure.** MCP responses contain status and metadata only.
- **No secret caching or logging.** Values used for health checks are never returned or written to stdout.
- **Write-blocked by design.** MCP stays read-only; human intake uses a separate Fly-authenticated private tunnel.
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

CLI URL arguments override the existing runtime URL binding. Credentials are never accepted as CLI arguments.

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
