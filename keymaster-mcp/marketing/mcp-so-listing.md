# Keymaster MCP — The Vault for Autonomous AI Agents

**Package:** `@akari-os/keymaster-mcp`
**Transport:** stdio
**License:** MIT
**Node.js:** ≥ 18

---

## What It Does

Keymaster MCP is a **read-only** bridge between your AI agents and HashiCorp Vault.
Agents call `get_secret` at runtime to receive credentials — they never carry raw API keys
in `.env` files, prompts, shell history, or workflow configs.

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
│  AI Agent ──MCP get_secret──► Keymaster ──► HashiCorp Vault │
│               (runtime fetch)   (read-only)   (source of    │
│                                               truth)        │
│                                                             │
│  ✅  No keys at rest in agent configs                       │
│  ✅  Keys fetched on demand, not cached                     │
│  ✅  Rotate in Vault once → all agents get new key next call │
│  ✅  MCP server is write-blocked by design                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Install in One Command

```bash
claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp \
  --vault-url https://your-keymaster.example.com \
  --token YOUR_TOKEN
```

Or via environment variables:

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

---

## Tools

| Tool | Description |
|------|-------------|
| `get_secret` | Fetch an API key from Vault by service name |
| `list_services` | Discover all registered service/key-name pairs |
| `list_secrets` | Enumerate retrievable secret paths |
| `healthcheck` | Validate 30+ credentials against upstream APIs |
| `rotate_secret` | Returns the safe Vault-side rotation path (read-only) |

---

## Example Usage

```
Agent: get_secret({ service: "openai" })
→ { service: "openai", key_name: "api_key", api_key: "sk-..." }

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
