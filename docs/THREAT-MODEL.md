# Keymaster MCP threat model

## Protected assets

- Vault credential values
- Keymaster bearer tokens
- configured Keymaster URLs and internal topology
- credential existence metadata beyond the caller's approved scope
- the integrity of health-check and outcome reports

## Trust boundaries

1. **Model boundary** — all MCP tool arguments and responses are considered model-visible.
2. **MCP host boundary** — the host may inject `USER_KEYMASTER_TOKEN`; it must not place the token in model context.
3. **Keymaster boundary** — the proxy authenticates the read-only caller and retrieves Vault values.
4. **Vault boundary** — Vault remains the credential source of truth.
5. **Privileged workload boundary** — real service calls that need credentials execute outside model-visible MCP output.

## Primary threats and controls

| Threat | Control |
|---|---|
| Model requests a raw secret | No tool returns credential values; `get_secret` is absent |
| Token leaks through argv or shell history | `--token` and `--token=...` are rejected without echoing the value |
| Path traversal or unexpected Vault path | service and key names use a strict 80-character allowlist |
| SSRF through a configured proxy URL | HTTPS is required except loopback HTTP; userinfo, query strings, and fragments are rejected |
| Secret appears in logs or exceptions | raw request errors, configured URLs, headers, and response bodies are never surfaced |
| Health check overloads Keymaster or providers | 10-second deadlines and concurrency limit of five |
| Redirect forwards authentication unexpectedly | upstream validation uses manual redirect handling |
| Agent writes or rotates a secret | MCP is read-only; rotation returns guidance only |
| Public issue contains evidence secrets | adoption template explicitly rejects credentials, private URLs, personal data, and confidential evidence |
| Internal activity is counted as outcome | Outcome Contract requires an external evidence boundary |

## Explicit non-goals

Keymaster MCP 1.1.0 does not:

- proxy arbitrary HTTP requests;
- execute user-supplied code;
- return raw Vault values;
- accept replacement credentials;
- provide a remote unauthenticated transport;
- prove that a host application keeps injected environment values out of model context;
- prove the authenticity of evidence markers supplied to Outcome Contract.

## Deployment requirements

- use a read-only, least-privilege Keymaster token;
- inject the token through the MCP host or platform secret binding;
- require HTTPS outside loopback development;
- keep the Keymaster write intake plane private;
- rotate host tokens independently of service credentials;
- review Vault and proxy audit logs outside model context;
- treat credential availability metadata as sensitive operational information.

## Security regression boundary

A release must fail if:

- package, runtime, and `server.json` versions differ;
- a `get_secret` MCP tool exists;
- MCP output contains a fetched credential;
- a token CLI argument is accepted or echoed;
- invalid path-like names reach Keymaster;
- the official MCP Inspector cannot initialize and list tools.
