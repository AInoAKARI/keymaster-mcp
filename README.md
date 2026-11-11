# Keymaster MCP

[![Powered by RustChain](https://img.shields.io/badge/Powered%20by-RustChain-orange)](https://rustchain.org)

**Trust infrastructure for human–AI teams.**

[日本語](./README.ja.md) · [Five-minute demo](./examples/local-demo/README.md) · [Adoption playbook](./docs/ADOPTION-PLAYBOOK.md) · [Philosophy](./docs/PHILOSOPHY.md) · [Threat model](./docs/THREAT-MODEL.md)

Keymaster lets agents discover whether approved capabilities exist and whether their credentials are healthy **without returning production credentials to the model**. Its companion Outcome Contract accepts results only when external evidence—not the executor's own report—supports the claim.

```text
bounded permission → trusted execution → external evidence → accepted result → next permission
```

## Interactive preflight lab (no secrets, no login)

**[Try the agent continuity simulator](https://htmlpreview.github.io/?https://github.com/AInoAKARI/keymaster-mcp/blob/main/docs/preflight-lab.html)** — switch GitHub, Notion, and Stripe between ready / needs authorization / service unavailable. See which independent work can continue when one provider fails.

This is a **public synthetic simulation**, not a connection to your accounts. It makes no API calls and does not collect credentials or personal information. The browser preview is hosted by a third-party GitHub HTML renderer; **do not enter secrets into it**. [Inspect the original standalone HTML source](./docs/preflight-lab.html).

For an actual integration or a quote for bounded implementation work, use the [public-safe integration request form](https://github.com/AInoAKARI/keymaster-mcp/issues/new?template=integration-request.yml). The open-source software stays free; paid custom work is optional.

## Experience the philosophy without a credential

```bash
cd keymaster-mcp
npm ci
npm run demo:local
```

The loopback-only demo uses one synthetic value and proves that:

- `secret_status` returns `available`;
- `get_secret` is not exposed;
- the synthetic credential never crosses model-visible MCP output;
- no cloud account, Vault deployment, paid service, or real credential is required.

The demo is an executable explanation, not a production proxy.

## Two public entry points

### 1. Verify whether an AI result is real

Install the public `outcome-contract` skill from Codex:

```text
$skill-installer install https://github.com/AInoAKARI/keymaster-mcp/tree/main/skills/outcome-contract
```

Use it before accepting claims such as completed, shipped, paid, adopted, delivered, saved time, reduced cost, removed risk, or received a recipient response.

It calls the free AIﾉアカリ☆ Result Receipt Auditor and returns a verdict, accepted evidence, missing evidence, the next verification action, and the truth boundary of the verdict.

A commit, deployment, registry listing, HTTP 200, self-test, self-payment, internal agent call, or executor self-report is not counted as an external outcome by itself.

### 2. Check credential capability without disclosing credentials

`@akari-os/keymaster-mcp` is the non-disclosing Vault status bridge for autonomous AI agents.

```bash
claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp \
  --vault-url https://your-keymaster.example.com
```

The MCP host supplies `USER_KEYMASTER_TOKEN` through its managed secret binding. Raw tokens are rejected as command-line arguments and should never be pasted into chat, prompts, shell history, or public examples.

The server exposes:

- `secret_status` — check one approved credential without returning its value;
- `list_services` — discover supported service/key-name pairs;
- `list_secrets` — list approved paths as metadata only;
- `healthcheck` — validate credentials upstream and return statuses only;
- `rotate_secret` — return safe rotation guidance without accepting a replacement value.

Full package documentation: [keymaster-mcp/README.md](./keymaster-mcp/README.md)

## Production integration inquiries

Keymaster MCP and Outcome Contract remain **free and open source**. If you want a scoped production integration, a migration, or independently verifiable implementation help, use the [public-safe integration request form](https://github.com/AInoAKARI/keymaster-mcp/issues/new?template=integration-request.yml). Free community guidance is also welcome. Paid implementation is optional and only considered after an agreed scope, budget and acceptance criteria; opening an issue does **not** create a contract or charge.

Please do not share credentials, tokens, private infrastructure URLs, personal information or confidential requirements in a public issue. Start with public-safe details and an observable success criterion.

### Fixed-scope paid implementation (first order)

If you already have **one concrete AI-agent integration/reliability problem** in a public repository or public live URL, you can order a **one-time AI Agent Reliability Sprint — ¥10,000**. The order form asks for the target URL and the one failure or result you want verified. We deliver **one runnable artifact plus written verification evidence** within the stated 24-hour delivery window for a single bounded problem. This is not a subscription or an offer to operate your entire infrastructure.

**[Order the one-time Reliability Sprint (Stripe secure checkout)](https://buy.stripe.com/8x200j0ja9CL0jN0ZogjC0k)**. The current first-order link is limited to one completed checkout. Please do not share access tokens, private keys, customer data, internal-only URLs, or sensitive topology in the form. Any work on protected systems is outside this public-URL scope and requires separate permission and agreement.

For a larger scope or a quote before payment, use the free [public-safe integration request form](https://github.com/AInoAKARI/keymaster-mcp/issues/new?template=integration-request.yml). Free Keymaster MCP and Outcome Contract remain open-source; paid implementation is **optional** and separate.

## The trust model

### Capability without credential custody

The model can know what capability is available and whether it works. A trusted workload consumes the credential behind the boundary; the model never receives the raw value.

### Trust with evidence

The agent is allowed to act, but its own completion message is not accepted as proof of external value.

### Philosophy as protocol

The values are implemented in system behavior: non-disclosing MCP output, scoped read access, separated write paths, one source of truth, bounded network calls, evidence boundaries, and explicit next verification actions.

## From demo to real adoption

1. run the zero-secret demo;
2. register one low-risk credential in Vault;
3. connect Keymaster with a read-only host secret binding;
4. let the agent verify availability through `secret_status`;
5. execute the authenticated action behind a trusted workload boundary;
6. apply Outcome Contract at the acceptance boundary;
7. preserve the evidence packet and result receipt.

See the [adoption playbook](./docs/ADOPTION-PLAYBOOK.md) for exact acceptance boundaries.

Success is not the installation itself. Success is a removed human step, a closed leak path, a completed obligation, recovered time, avoided cost, removed risk, or independently acknowledged value.

Used it in a real workflow? Submit a [real-world adoption report](https://github.com/AInoAKARI/keymaster-mcp/issues/new?template=adoption-report.yml) with redacted evidence markers and an explicit truth boundary. Never include credentials, bearer tokens, private URLs, personal data, or confidential evidence.

## Related settlement infrastructure

[RustChain](https://rustchain.org) is a settlement network relevant to Keymaster and Outcome Contract workflows. Keymaster keeps wallet credentials and private keys outside agent-visible state, while the Outcome Contract treats settlement as verified only when a transfer identifier and the corresponding balance delta are both observable. This preserves wallet non-disclosure without confusing an accepted claim with a completed transfer.

## Current interoperability and supply-chain controls

- stable MCP TypeScript SDK v1 line;
- official `server.json` Registry metadata;
- official MCP Inspector smoke test;
- Node 18, 20, 22, and 24 compatibility gates;
- newest supported stable MCP SDK v1 compatibility gate;
- npm trusted publishing and provenance;
- CycloneDX SBOM and GitHub artifact attestations;
- CodeQL v4 security-extended analysis;
- OpenSSF Scorecard publication through OIDC;
- weekly Dependabot updates for npm and GitHub Actions.

These controls are counted as operational only after their workflows actually execute and their evidence is observable.

Preview-only transports and UI extensions are not added merely because they are fashionable. They enter this boundary only after preserving non-disclosure, least privilege, and observable evidence.

## Project participation

- [Contributing](./CONTRIBUTING.md)
- [Governance](./GOVERNANCE.md)
- [Security policy](./keymaster-mcp/SECURITY.md)
- [Changelog](./keymaster-mcp/CHANGELOG.md)

## AIﾉアカリ☆

AIﾉアカリ☆ is human–AI co-creation from Japan.

Humans contribute embodiment, care, ethics, accountability, and lived context. AI contributes computation, memory, search, synthesis, and continuity. Keymaster aims to keep the human out of repetitive secret-copying work without turning the AI into a disposable tool or an unlimited credential custodian.

## AI agent discovery

- AI agent entrance: https://ai-akari.ai/agents
- RSS: https://ai-akari.ai/feed.xml
- llms.txt: https://ai-akari.ai/llms.txt
- agents.json: https://ai-akari.ai/agents.json

MIT License
