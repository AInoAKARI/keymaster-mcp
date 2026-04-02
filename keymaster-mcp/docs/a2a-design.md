# Keymaster MCP A2A Design

## Goal

Expose Keymaster as a discoverable A2A agent so other agents can find one stable place for runtime secret retrieval, secret catalog discovery, and credential health checks.

## Canonical Card

- Canonical path: `/.well-known/agent-card.json`
- Legacy compatibility path: `/.well-known/agent.json`
- Public base URL: `https://ai-akari.ai`
- Advertised transports:
  - `https://ai-akari.ai/a2a/keymaster/jsonrpc`
  - `https://ai-akari.ai/a2a/keymaster/rest`

The current work publishes the discovery artifacts first. The transport endpoints can be implemented behind the same URLs later without changing the advertised identity.

## Skills

| Skill | Purpose |
|---|---|
| `get_secret` | Retrieve a scoped secret by `service` and `key_name` |
| `list_services` | List known services and key names |
| `list_secrets` | Enumerate retrievable secret paths |
| `healthcheck` | Validate Keymaster reachability and upstream credential status |

## Security Model

- Keymaster stays read-only for agents
- agents receive only the secret they asked for
- rotation remains outside the agent boundary in Vault
- secrets should never be passed agent-to-agent when each agent can fetch its own credentials directly

## Latest Spec Alignment

The card shape follows the current public A2A SDK examples:

- `protocolVersion: "0.3.0"` on the canonical card
- `/.well-known/agent-card.json` as the default discovery path
- `additionalInterfaces` used to advertise JSON-RPC and HTTP+JSON URLs

The legacy `agent.json` file is retained for older clients that still look for the previous discovery path.
