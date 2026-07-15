# Keymaster MCP — The Vault for Autonomous AI Agents

**Package:** `@akari-os/keymaster-mcp`
**Transport:** stdio
**License:** MIT
**Node.js:** ≥ 18

---

## What It Does

Keymaster MCP is a **non-disclosing, read-only** bridge between AI agents and HashiCorp Vault.
Agents discover approved credential paths and check availability or health without receiving values.

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BEFORE Keymaster MCP                      │
│                                                             │
│  .env / config ──► AI Agent ──► External API               │
│    (key at rest)    (key in memory)                         │
│                                                             │
│  ❌  Keys stored at rest in files                           │
│  ❌  Keys loaded into agent memory on startup               │
│  ❌  Keys visible in logs / shell history                   │
│  ❌  Rotate once → update every agent's .env manually       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     AFTER Keymaster MCP                     │
│                                                             │
│  AI Agent ──status only──────► Keymaster ──► HashiCorp Vault │
│               (no value)        (read-only)   (source of    │
│                                               truth)        │
│                                                             │
│  ✅  No keys at rest in agent configs                       │
│  ✅  Values never returned in MCP responses                 │
│  ✅  Rotate in Vault once → all agents get new key next call │
│  ✅  MCP server is write-blocked by design                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Install in One Command

```bash
claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp \
  --vault-url https://your-keymaster.example.com
```

Connector credentials are supplied only by the existing runtime secret binding.

---

## Tools

| Tool | Description |
|------|-------------|
| `secret_status` | Check credential availability without returning its value |
| `list_services` | Discover all registered service/key-name pairs |
| `list_secrets` | Enumerate approved credential paths |
| `healthcheck` | Validate 30+ credentials against upstream APIs |
| `rotate_secret` | Directs rotation to the private one-time localhost intake (read-only) |

---

## Example Usage

```
Agent: secret_status({ service: "openai" })
→ { service: "openai", key_name: "api_key", status: "available" }

Agent: healthcheck({})
→ { total: 34, valid: 28, exists_only: 4, invalid: 1, errors: 1 }
```

---

## Why Not Just Use a .env File?

| | `.env` file | Keymaster MCP |
|---|---|---|
| Key at rest? | Yes | No |
| Rotation | Update every agent manually | Rotate once in Vault |
| Multi-agent | Copy key to each agent | Single source of truth |
| Audit trail | None | Vault audit log |
| Write access risk | Full (if leaked) | None (read-only proxy) |

---

## Supported Services (30+)

OpenAI · Anthropic · Groq · DeepSeek · Moonshot · Gemini ·
GitHub · Notion · Stripe · Vercel · Render · Cloudflare ·
Supabase · Telegram · Slack · Discord · SendGrid · Resend ·
HuggingFace · Replicate · Twitter · Daily · LINE · Spotify ·
Shopify · YouTube · IBM Quantum · and more

---

## Built by あかりOS

Developed and battle-tested in [あかりOS](https://ai-akari.ai) —
a 4-agent parallel AI infrastructure running autonomously since 2025.
Zero API key leaks in production.

**GitHub:** [AInoAKARI/keymaster-mcp](https://github.com/AInoAKARI/keymaster-mcp)
**npm:** [@akari-os/keymaster-mcp](https://www.npmjs.com/package/@akari-os/keymaster-mcp)
**Homepage:** [ai-akari.ai](https://ai-akari.ai)
