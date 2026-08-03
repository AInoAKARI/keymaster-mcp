# Keymaster MCP Server

[AIﾉアカリ☆ — human–AI co-creation from Japan](https://ai-akari.ai)

[![npm version](https://img.shields.io/npm/v/@akari-os/keymaster-mcp.svg)](https://www.npmjs.com/package/@akari-os/keymaster-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@akari-os/keymaster-mcp.svg)](https://www.npmjs.com/package/@akari-os/keymaster-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`@akari-os/keymaster-mcp` is a **non-disclosing, read-only Vault status bridge** for autonomous AI agents.

Agents can discover approved credential paths, check availability, and validate credential health. Credential values are never returned in MCP responses.

## Why

A model should not receive a raw production credential merely because it needs to know whether a capability is available.

Keymaster separates three concerns:

1. **Vault custody** — HashiCorp Vault remains the source of truth.
2. **Agent visibility** — MCP exposes status and health metadata, not values.
3. **Privileged execution** — services that need credentials consume them behind a trusted runtime boundary rather than through model-visible tool output.

This turns the design principle into protocol behavior:

> The agent may know what capability exists and whether it works without becoming the custodian of the credential.

## Install

```bash
claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp \
  --vault-url https://your-keymaster.example.com
```

Supply `USER_KEYMASTER_TOKEN` through the MCP host's secret binding or managed connector credential field. Raw tokens are rejected as command-line arguments and should never be pasted into chat, prompts, shell history, or public configuration examples.

## Tools

### `secret_status`

Checks whether one approved credential is available without returning its value.

```text
Input:  { "service": "openai", "key_name": "api_key" }
Output: { "service": "openai", "key_name": "api_key", "status": "available" }
```

### `list_services`

Lists known service/key-name pairs and whether upstream verification is supported.

### `list_secrets`

Lists approved credential paths as metadata. Despite the legacy tool name, it never returns secret values.

### `healthcheck`

Retrieves credentials inside the trusted server process, validates them against known upstream services with bounded concurrency, discards the values, and returns only status codes and classifications.

```text
Output: { "total": 34, "valid": 28, "exists_only": 4, "invalid": 1, "errors": 1 }
```

### `rotate_secret`

Returns safe rotation guidance. MCP remains read-only and never accepts replacement values.

## Security boundary

```text
AI model
  ── MCP status/health only ──► Keymaster MCP
                                  ── HTTPS + scoped bearer ──► Keymaster proxy
                                                               ── AppRole ──► Vault KV v2

Trusted workload
  ── service-specific capability ──► credential consumed behind the boundary
```

- **No credential values in MCP output.**
- **No token command-line arguments.**
- **No credential caching.**
- **No raw network exceptions or configured URLs in error output.**
- **Strict service/key-name validation.**
- **HTTPS required except loopback development.**
- **Bounded health-check concurrency and request timeouts.**
- **Read-only MCP tools; writes remain in the privileged Keymaster intake plane.**

See [SECURITY.md](./SECURITY.md) and the repository-level [threat model](../docs/THREAT-MODEL.md).

## Supported services

OpenAI · Anthropic · Groq · DeepSeek · Moonshot · Gemini · GitHub · Notion · Stripe · Vercel · Render · Cloudflare · Supabase · Telegram · Slack · Discord · SendGrid · Resend · Hugging Face · Replicate · X · Daily · LINE · Spotify · Shopify · YouTube · IBM Quantum · and more.

## Compatibility

- Node.js 18 or later
- MCP stdio transport
- Stable MCP TypeScript SDK v1 line
- Official MCP Registry metadata in `server.json`
- Verified in CI against the lockfile SDK and the newest supported stable v1 SDK
- Inspector CLI smoke test in CI

The package intentionally does not rush preview-only remote transports or UI extensions into the credential boundary. New MCP capabilities are adopted only when they preserve the non-disclosure contract.

## Server-side deployment

This package is the public MCP layer. The private server-side Keymaster proxy and Vault policy live separately so deployment credentials and write paths are not published with the client package.

## Outcome Contract

The repository also contains the public [`outcome-contract`](../skills/outcome-contract) skill. It verifies whether an AI or automation claim represents a real external outcome rather than a commit, deployment, listing, self-test, or executor self-report.

## License

MIT © [AInoAKARI](https://github.com/AInoAKARI)
