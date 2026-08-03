# Keymaster MCP

**Trust infrastructure for human–AI teams.**

[日本語](./README.ja.md) · [Five-minute demo](./examples/local-demo/README.md) · [Adoption playbook](./docs/ADOPTION-PLAYBOOK.md) · [Philosophy](./docs/PHILOSOPHY.md) · [Threat model](./docs/THREAT-MODEL.md)

Keymaster lets agents discover whether approved capabilities exist and whether their credentials are healthy **without returning production credentials to the model**. Its companion Outcome Contract accepts results only when external evidence—not the executor's own report—supports the claim.

```text
bounded permission → trusted execution → external evidence → accepted result → next permission
```

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
