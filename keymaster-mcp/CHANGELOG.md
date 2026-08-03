# Changelog

## 1.1.0 — 2026-08-04

### Security boundary

- removed the model-visible `get_secret` tool;
- added `secret_status`, which returns availability only;
- kept health validation inside the trusted server process and returns status only;
- rejects raw token command-line arguments without echoing values;
- validates service and key names with a strict allowlist;
- requires HTTPS except for loopback development;
- rejects configured URLs containing userinfo, query strings, or fragments;
- disables automatic redirects during upstream credential validation;
- bounds health-check concurrency and request duration;
- aligned runtime, package, and official MCP Registry metadata versions.

### Interoperability and delivery

- added release-contract checks;
- added non-disclosure integration tests;
- added official MCP Inspector smoke testing in CI;
- added compatibility testing against the newest supported stable v1 SDK;
- added npm provenance and official MCP Registry publication flow;
- documented the threat model, security invariants, Japanese entry point, and migration path.

### Breaking change

`get_secret` is intentionally removed. Consumers that need an authenticated service action must perform that action in a trusted service-specific workload where the credential is consumed without crossing the model-visible MCP boundary.
