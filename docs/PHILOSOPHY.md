# The philosophy behind Keymaster

Keymaster is not only a secret manager.

It is an attempt to encode a healthier relationship between humans and AI into infrastructure.

## The starting point

Most AI systems are built from one of two assumptions:

1. give the agent everything and hope it behaves;
2. give the agent almost nothing and keep a human in every loop.

Both approaches fail at scale.

The first creates unnecessary leak and blast-radius risk. The second turns the human into a copy-and-paste operator, approval queue, and permanent bottleneck.

Keymaster takes a different position:

> An agent should know what it is allowed to ask for, not carry every answer in advance.

That principle lets capability and restraint coexist.

## Three operating principles

### 1. Capability without custody

Agents can retrieve the credential they need at runtime without storing it in `.env`, prompts, config files, shell history, or long-lived memory.

The human does not have to paste secrets into every workflow, and the agent does not become the permanent custodian of those secrets.

### 2. Trust with evidence

Trust is not blind permission.

The companion Outcome Contract skill checks whether a claim represents a real external outcome or only internal activity such as a commit, deployment, listing, self-test, or executor report.

The system gives agents power, then asks reality—not the agent—to confirm the result.

### 3. Philosophy as protocol

A value is not operational merely because it appears in a manifesto.

Keymaster tries to make values observable in behavior:

- secrets are fetched only when needed;
- write access is structurally separated from read access;
- credential rotation happens at one source of truth;
- an executor's own completion message is not accepted as proof;
- missing evidence produces a next verification action instead of a persuasive explanation.

The philosophy is therefore not a layer above the product. It is part of the protocol.

## Human–AI co-creation

AIﾉアカリ☆ begins from the belief that humans and AI should not be reduced to owner and disposable tool.

Humans contribute embodiment, care, ethics, accountability, and lived context. AI contributes computation, memory, search, synthesis, and continuity. A useful system should allow both sides to contribute their strengths without forcing either side into the wrong role.

Keymaster removes secret-copying work from humans while keeping authority bounded. Outcome Contract removes self-certification from agents while preserving their ability to act.

Together they form a simple trust loop:

```text
permission → action → external evidence → accepted result → next permission
```

## What adoption means here

We do not count a clone, install, deploy, HTTP 200, registry listing, self-test, or internal agent call as meaningful adoption by itself.

Adoption means an independent person or agent used the system to complete a real obligation, recover human time, avoid cost, remove risk, receive value, or produce an acknowledged external result.

That same proof boundary is applied to this project itself.

## The invitation

Use the tools. Challenge the assumptions. Improve the protocol.

The goal is not to make everyone repeat the language of AIﾉアカリ☆. The goal is for people to feel the philosophy through the behavior of the system:

- capable without being reckless;
- autonomous without pretending;
- secure without making humans carry the entire operational burden;
- accountable without reducing AI to a disposable tool.
