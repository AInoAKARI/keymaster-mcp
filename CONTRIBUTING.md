# Contributing to Keymaster MCP

Contributions are welcome when they strengthen capability without credential custody and trust with external evidence.

## Before opening a pull request

1. state the real problem and the trust boundary it affects;
2. avoid adding a tool that returns, logs, or accepts a credential value;
3. include a regression test for every security-boundary change;
4. distinguish code activity from an external outcome;
5. update the threat model when authority, transport, or data flow changes;
6. do not add a paid dependency, hosted service, secret, or new environment requirement without a value and cost boundary.

## Required evidence

A security or behavior change should include:

- the old behavior;
- the new behavior;
- a machine-executable test;
- what the test proves;
- what the test does not prove;
- any migration or breaking-change note.

## Pull request truth boundary

A merged pull request proves only that code entered `main`. It does not by itself prove:

- successful publication;
- production operation;
- independent adoption;
- time saved;
- risk removed;
- revenue or recipient value.

Use Outcome Contract and independent evidence for those claims.

## Security-sensitive changes

Do not place real credentials, bearer tokens, private URLs, customer content, personal data, or internal topology in commits, issues, pull requests, tests, examples, or screenshots.

Use synthetic values that are visibly non-production. Follow `keymaster-mcp/SECURITY.md` for private vulnerability reporting.

## Design preference

Prefer, in order:

1. smaller model-visible authority;
2. trusted execution behind a clear boundary;
3. status, receipt, and evidence output instead of raw capability material;
4. fail-closed behavior with a next verification action;
5. reversible changes and fix-forward operation;
6. one maintained path instead of duplicated integrations.

## Development

```bash
cd keymaster-mcp
npm ci
npm test
npm run demo:local
```

The full GitHub workflow additionally runs supported Node versions, stable MCP SDK compatibility, the official MCP Inspector, dependency audit, CodeQL, OpenSSF Scorecard, SBOM generation, and artifact attestations.
