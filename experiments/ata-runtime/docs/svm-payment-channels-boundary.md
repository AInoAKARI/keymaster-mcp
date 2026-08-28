# AtA SVM payment-channel execution boundary

## Upstream basis

Implementation is aligned to the current `solana-foundation/payment-channels` source snapshot:

- source commit: `3ffa4d6728ad88e4a9667a76ad9ccd68a302c696`
- generated TypeScript client: `clients/typescript`
- package name: `@payment-channels/client`
- generated instructions include `open`, `topUp`, `settle`, `distribute`, `requestClose`, and cleanup lifecycle operations.

The AtA runtime does not copy or expose any private signer. It injects a trusted transaction builder inside the Keymaster execution boundary and accepts only the resulting signed transaction plus non-sensitive public evidence.

## Truth boundary

A facilitator HTTP response with `success: true` is **not** final settlement evidence.

Evidence states:

1. `facilitator-reported` — `/verify` and `/settle` returned success.
2. `external-tx-confirmed` — the reported Solana transaction is confirmed/finalized by RPC.
3. `external-settled` — a settlement/distribution transaction is confirmed and the receiver token-account balance increased by at least the expected atomic amount.

Opening or topping up a channel proves funding/escrow, not payment to the receiver. It must never be booked as realized settlement.

## Devnet execution requirements

Actual devnet execution requires all of the following in a network-capable trusted runtime:

- a verified payment-channels program deployment for the selected devnet network,
- funded devnet payer and fee-payer/sponsor signers held behind Keymaster,
- Solana RPC egress,
- an x402 facilitator endpoint supporting the selected scheme/network,
- a receiver USDC token account whose pre/post balances can be measured.

No production key, secret, or funded wallet is generated or written by this repository.
