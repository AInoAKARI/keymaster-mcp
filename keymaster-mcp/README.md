# keymaster-mcp

MCP (Model Context Protocol) server for [AKARI Vault Keymaster](https://github.com/AInoAKARI/akari-vault-gateway) — secure secret retrieval for AI agents.

## What it does

Wraps the Keymaster HTTP API as MCP tools so that any MCP-compatible client (Claude Desktop, Claude Code, etc.) can securely retrieve secrets from HashiCorp Vault without direct Vault access.

```
AI Agent <-> MCP (stdio) <-> keymaster-mcp <-> Keymaster API <-> HashiCorp Vault
```

## Tools

| Tool | Description |
|------|-------------|
| `get_secret` | Retrieve an API key by service name and key name |
| `healthcheck` | Check Keymaster connectivity and validate all known API keys |
| `list_services` | List all known services and their key names |

## Quick Start

### Install

```bash
npm install -g @akairio/keymaster-mcp
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `USER_KEYMASTER_URL` | Yes | Keymaster server URL |
| `USER_KEYMASTER_TOKEN` | Yes | Bearer token for authentication |

### Use with Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "keymaster": {
      "command": "keymaster-mcp",
      "env": {
        "USER_KEYMASTER_URL": "https://your-keymaster.example.com",
        "USER_KEYMASTER_TOKEN": "your-token"
      }
    }
  }
}
```

### Use with Claude Code

```bash
claude mcp add keymaster keymaster-mcp \
  -e USER_KEYMASTER_URL=https://your-keymaster.example.com \
  -e USER_KEYMASTER_TOKEN=your-token
```

## Tool Reference

### get_secret

Retrieve an API key from Vault via Keymaster.

**Parameters:**
- `service` (string, required) — Service name (e.g. `"openai"`, `"stripe"`, `"groq"`)
- `key_name` (string, optional) — Key field name (default: `"api_key"`)

**Example:** `get_secret({ service: "openai" })` returns `{ service: "openai", key_name: "api_key", api_key: "sk-..." }`

### healthcheck

Check Keymaster connectivity and validate all known API keys against their service endpoints. Returns a full status report with per-service results.

No parameters.

### list_services

List all registered services and their key names. Each entry includes whether the key is verifiable (has an API endpoint for validation).

No parameters.

## mcpize

This server supports [mcpize](https://mcpize.com/) with `credentials_mode: per_user`. Users provide their own `USER_KEYMASTER_URL` and `USER_KEYMASTER_TOKEN`.

## Security

- Secrets are transmitted over HTTPS between keymaster-mcp and the Keymaster server
- Authentication token is required for all operations
- No secrets are cached or logged by the MCP server
- Vault is never accessed directly — all operations go through Keymaster

## License

MIT
