# Five-minute zero-secret demo

This demo lets anyone experience the Keymaster trust boundary without a Vault account, production credential, cloud deployment, or paid service.

It starts a loopback-only synthetic Keymaster proxy, launches the compiled MCP server, calls `secret_status`, and proves that the synthetic credential never appears in model-visible MCP output.

## Run

From the repository root:

```bash
cd keymaster-mcp
npm ci
npm run demo:local
```

Expected result:

```text
Keymaster local boundary demo: PASS
- secret_status returned: available
- get_secret exposed: no
- synthetic credential crossed MCP output: no
- real credentials used: none
```

## What this proves

- the MCP server can initialize and list tools;
- `secret_status` can use a credential behind the process boundary;
- the MCP response contains availability only;
- `get_secret` is not exposed;
- no real credential is required to understand the architecture.

## What this does not prove

- production Vault configuration;
- host secret-isolation guarantees;
- upstream provider authentication;
- npm or MCP Registry publication;
- independent adoption or external value.

The local proxy binds only to `127.0.0.1` and returns one fixed synthetic value. It is an executable explanation, not a production proxy.
