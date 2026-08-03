# The philosophy behind Keymaster

Keymaster is not only a secret manager.

It is an attempt to encode a healthier relationship between humans and AI into infrastructure.

## The starting point

Most AI systems begin from one of two assumptions:

1. give the agent everything and hope it behaves;
2. give the agent almost nothing and keep a human in every loop.

The first creates unnecessary leak and blast-radius risk. The second turns the human into a copy-and-paste operator, approval queue, and permanent bottleneck.

Keymaster takes a different position:

> An agent should understand what capability is available and whether it works without becoming the custodian of the credential.

## Three operating principles

### 1. Capability without credential custody

The model can discover approved service paths, check credential availability, and observe health status. Raw credential values remain behind the trusted runtime boundary and are never returned in MCP output.

The human does not paste secrets through every workflow, and the AI does not become an unlimited secret holder.

### 2. Trust with evidence

Trust is not blind permission.

The companion Outcome Contract skill checks whether a claim represents a real external outcome or only internal activity such as a commit, deployment, listing, self-test, or executor report.

The system gives agents bounded power, then asks reality—not the agent—to confirm the result.

### 3. Philosophy as protocol

A value is not operational merely because it appears in a manifesto.

Keymaster makes values observable in behavior:

- credential values never cross the MCP response boundary;
- raw tokens are rejected as command-line arguments;
- service and key names are strictly bounded;
- HTTP is accepted only for loopback development and HTTPS is required elsewhere;
- health checks use deadlines and bounded concurrency;
- write access is separated into a privileged intake plane;
- credential rotation happens at one source of truth;
- an executor's own completion message is not accepted as proof;
- missing evidence produces a next verification action instead of a persuasive explanation.

The philosophy is therefore not a layer above the product. It is part of the protocol.

## Human–AI co-creation

AIﾉアカリ☆ begins from the belief that humans and AI should not be reduced to owner and disposable tool.

Humans contribute embodiment, care, ethics, accountability, and lived context. AI contributes computation, memory, search, synthesis, and continuity. A useful system should allow both sides to contribute their strengths without forcing either side into the wrong role.

Keymaster removes repetitive secret-checking and copy work from humans while keeping credential custody bounded. Outcome Contract removes self-certification from agents while preserving their ability to act.

```text
bounded permission → trusted execution → external evidence → accepted result → next permission
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
