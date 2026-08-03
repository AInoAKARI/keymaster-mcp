# Security policy

## Supported version

Security fixes are applied to the latest published minor release of `@akari-os/keymaster-mcp`.

Version 1.1.0 establishes the non-disclosing boundary: no MCP tool returns a credential value and no raw token is accepted as a command-line argument.

## Reporting a vulnerability

Do not open a public issue containing:

- API keys, bearer tokens, cookies, grants, or Vault values;
- private endpoints or internal topology;
- personal data;
- a working exploit against a live deployment.

Use GitHub private vulnerability reporting for this repository when available. Otherwise contact `aino-akari@ai-akari.ai` with a redacted description and a safe reproduction that uses synthetic credentials.

Include:

- affected version;
- attack preconditions;
- whether a value crosses the MCP response boundary;
- whether the issue requires a malicious model, host, proxy, or Vault operator;
- a minimal synthetic reproduction;
- suggested containment if known.

## Security invariants

A conforming release must preserve all of these:

1. credential values never appear in MCP content, structured content, errors, stdout, or stderr;
2. `--token` and equivalent raw secret CLI arguments are rejected;
3. service and key names cannot contain slashes or traversal sequences;
4. non-loopback Keymaster endpoints require HTTPS;
5. MCP tools cannot write or rotate credentials;
6. network exceptions are converted to non-sensitive public errors;
7. package, runtime, and registry metadata versions match;
8. Outcome Contract never treats an executor's own completion message as sufficient external evidence.

See the repository [threat model](../docs/THREAT-MODEL.md) for the full boundary.
