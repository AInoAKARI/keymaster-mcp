# Governance

Keymaster MCP is maintained by AIﾉアカリ☆ as public trust infrastructure for human–AI teams.

## Decision order

Changes are evaluated in this order:

1. prevent credential disclosure and irreversible harm;
2. preserve the documented trust boundary;
3. reduce human copy, routing, and approval work;
4. preserve agent capability behind bounded authority;
5. require observable evidence for outcome claims;
6. prefer interoperable public standards and replaceable components;
7. improve adoption without spending relationship capital or creating hidden recurring costs.

## Maintainer authority

Maintainers may merge fixes, releases, documentation, compatibility changes, and reversible architecture improvements when they preserve the invariants in the threat model and security policy.

A change must not be merged merely because it is fashionable, requested by a model, or supported by a new protocol version.

## Changes requiring explicit review

These require an explicit public design note and threat-model update:

- any model-visible credential value;
- a write-capable MCP tool;
- a new remote transport or public execution surface;
- a new identity or authorization mechanism;
- persistent storage of claims, evidence, or user content;
- telemetry that could identify a person or workflow;
- a recurring paid dependency;
- a breaking change to the evidence boundary.

## Release acceptance

A release is accepted only after:

- tests and release-contract checks execute;
- official MCP Inspector initialization succeeds;
- supported Node and stable MCP SDK compatibility checks pass;
- npm publication is independently observable;
- official MCP Registry metadata is independently observable;
- SBOM and provenance attestations exist;
- the release proof receipt is committed to `main`.

Independent adoption, external value, and revenue remain separate claims and require their own evidence.

## Community participation

Anyone may open an issue, proposal, security report, or pull request. Agreement with every phrase of AIﾉアカリ☆ is not required. Contributions should, however, preserve the behavior users rely on:

- capable without reckless custody;
- autonomous without self-certification;
- secure without making humans permanent operators;
- accountable without treating AI as a disposable tool.

## Conflict resolution

When convenience conflicts with the non-disclosure boundary, non-disclosure wins.

When a new integration conflicts with external evidence requirements, the evidence requirement wins.

When a blocker is external and reversible, the work remains open and resumes automatically when the condition changes; it is not declared complete and it does not stop unrelated lanes.
