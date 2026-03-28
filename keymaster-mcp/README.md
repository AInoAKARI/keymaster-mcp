# keymaster-mcp

MCP (Model Context Protocol) server for [AKARI Vault Keymaster](https://github.com/AInoAKARI/akari-vault-gateway) — secure secret retrieval for AI agents.

## What it does

Wraps the Keymaster HTTP API as MCP tools so that any MCP-compatible client (Claude Desktop, Claude Code, etc.) can securely retrieve secrets from HashiCorp Vault without direct Vault access.

## Tools

| Tool | Description |
|------|-------------|
| `get_secret` | Retrieve a secret by service name or Vault path |
| `list_services` | Discover / register service names |
| `health_check` | Check Keymaster server health |

## Quick Start

### Install

```bash
npm install -g @akairio/keymaster-mcp
```

### Configure

Set environment variables:

```bash
export KEYMASTER_URL="https://your-keymaster-instance.example.com"
export KEYMASTER_AUTH_TOKEN="your-auth-token"
```

### Use with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "keymaster": {
      "command": "keymaster-mcp",
      "env": {
        "KEYMASTER_URL": "https://your-keymaster-instance.example.com",
        "KEYMASTER_AUTH_TOKEN": "your-auth-token"
      }
    }
  }
}
```

### Use with Claude Code

```bash
claude mcp add keymaster keymaster-mcp \
  -e KEYMASTER_URL=https://your-keymaster-instance.example.com \
  -e KEYMASTER_AUTH_TOKEN=your-auth-token
```

## Tool Reference

### get_secret

Retrieve a secret from Vault via Keymaster.

**Parameters:**
- `service` (string, optional) — Service/API name (e.g. `"stripe"`, `"openai"`). Maps to Vault path `api_keys/{service}`
- `path` (string, optional) — Custom Vault path (overrides service)
- `key_name` (string, optional) — Key within the secret (default: `"api_key"`)

Either `service` or `path` is required.

### list_services

Discover or register service names.

**Parameters:**
- `name` (string, optional) — If provided, returns the form URL for registering a new service

### health_check

Check if the Keymaster server is reachable. No parameters.

## Architecture

```
AI Agent ←→ MCP (stdio) ←→ keymaster-mcp ←→ Keymaster API ←→ HashiCorp Vault
```

The MCP server is a thin wrapper. All authentication and Vault access is handled by the Keymaster server.

## Security

- Secrets are transmitted over HTTPS between keymaster-mcp and the Keymaster server
- The `KEYMASTER_AUTH_TOKEN` is required for secret retrieval
- No secrets are cached or logged by the MCP server
- Vault is never accessed directly — all operations go through Keymaster

## License

MIT
