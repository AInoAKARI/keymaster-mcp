# Keymaster MCP A2A Design

## Goal

Expose Keymaster as a discoverable A2A agent so other agents can find one stable place for non-disclosing credential discovery, availability, and health checks.

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
| `secret_status` | Check scoped credential availability without returning its value |
| `list_services` | List known services and key names |
| `list_secrets` | Enumerate approved credential paths |
| `healthcheck` | Validate Keymaster reachability and upstream credential status |
| `rotate_secret` | Direct rotation to the private one-time localhost intake |

## Security Model

- Keymaster stays read-only for agents
- agents receive status and metadata only, never credential values
- rotation remains outside the MCP agent boundary through the Fly-authenticated private intake
- secrets are entered only in the one-time localhost browser form

## Latest Spec Alignment

The card shape follows the current public A2A SDK examples:

- `protocolVersion: "0.3.0"` on the canonical card
- `/.well-known/agent-card.json` as the default discovery path
- `additionalInterfaces` used to advertise JSON-RPC and HTTP+JSON URLs

The legacy `agent.json` file is retained for older clients that still look for the previous discovery path.
