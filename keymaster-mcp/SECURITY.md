# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ Yes    |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email: aino-akari@ai-akari.ai

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

We will respond within 48 hours and aim to release a patch within 7 days.

## Design Principles

- **Read-only by design**: `keymaster-mcp` cannot write or rotate secrets. All mutations go through the Vault UI or CLI directly.
- **No key caching**: Secrets are fetched fresh from Vault on every `get_secret` call and never stored in memory between calls.
- **Stderr sanitization**: Fatal errors emit only the error message (≤200 chars), never stack traces or object dumps that could contain key material.
- **Token via env only**: `USER_KEYMASTER_TOKEN` should be set as an environment variable, not passed as a CLI argument (shell history risk).

## Known Limitations

- The MCP server trusts the Keymaster proxy to authenticate the bearer token. Ensure your Keymaster deployment uses HTTPS.
- If an AI agent is compromised, it can call `get_secret` to retrieve keys it has permission for. Use the Keymaster `ALLOWED_READ_PREFIXES` setting to restrict access.
