# AtA durable spending boundary

`createFileBudgetStore()` is the zero-service durable budget store for a single trusted Keymaster host.

It persists only non-secret accounting state: reservation IDs, session/day atomic amounts, and resolution state. It does not store wallet private keys, API keys, or payment payload secrets.

## Required economic-rail posture

For any rail that can move economic value:

1. construct the store with an explicit Keymaster-owned persistent `filePath` and explicit `sessionId`;
2. inject it into `createBudgetedX402Fetch` as `budgetStore`;
3. set `requireDurableStore: true`;
4. set explicit per-request, per-session, per-day, network, and asset limits;
5. keep the signing capability behind the Keymaster boundary;
6. count settlement only from external transaction + receiver balance evidence.

The store uses an inter-process lock plus fsynced temporary-file replacement. Reservations are persisted before authorization begins. A crash does **not** auto-release an unresolved reservation: uncertainty fails closed and consumes available budget until reconciled.

`durabilityScope` is `host-filesystem`. This is appropriate when all spend authorization for that wallet is serialized through one persistent Keymaster host, including multiple processes on that host. It is **not** a distributed consensus store. Multi-host / horizontally scaled signers must inject a different budget store that provides atomic distributed reservations rather than sharing this file adapter.

No `.env`, `process.env`, or public client secret is required by this store; the path and policy are supplied directly by the trusted runtime.
