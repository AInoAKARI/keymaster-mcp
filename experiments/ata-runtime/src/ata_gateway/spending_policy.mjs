function atomic(value, label) {
  if (!/^\d+$/.test(String(value))) throw new Error(`${label} must be an unsigned atomic integer`);
  return BigInt(value);
}

function limit(value, label) {
  if (value == null) return null;
  return atomic(value, label);
}

function policyError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createMemoryBudgetStore() {
  const reservations = new Map();
  let sessionCommitted = 0n;
  let sessionReserved = 0n;
  const dayCommitted = new Map();
  const dayReserved = new Map();
  let nextId = 0;

  return Object.freeze({
    durability: 'process',
    reserve({ amount, dayKey, maxSession, maxDay }) {
      const sessionNext = sessionCommitted + sessionReserved + amount;
      if (maxSession != null && sessionNext > maxSession) throw policyError('session_budget_exceeded', 'x402 session budget exceeded');
      const dc = dayCommitted.get(dayKey) ?? 0n;
      const dr = dayReserved.get(dayKey) ?? 0n;
      if (maxDay != null && dc + dr + amount > maxDay) throw policyError('daily_budget_exceeded', 'x402 daily budget exceeded');
      const id = `r${++nextId}`;
      reservations.set(id, { amount, dayKey, state: 'reserved' });
      sessionReserved += amount;
      dayReserved.set(dayKey, dr + amount);
      return id;
    },
    commit(id) {
      const r = reservations.get(id);
      if (!r || r.state !== 'reserved') return false;
      r.state = 'committed';
      sessionReserved -= r.amount;
      sessionCommitted += r.amount;
      dayReserved.set(r.dayKey, (dayReserved.get(r.dayKey) ?? 0n) - r.amount);
      dayCommitted.set(r.dayKey, (dayCommitted.get(r.dayKey) ?? 0n) + r.amount);
      return true;
    },
    cancel(id) {
      const r = reservations.get(id);
      if (!r || r.state !== 'reserved') return false;
      r.state = 'cancelled';
      sessionReserved -= r.amount;
      dayReserved.set(r.dayKey, (dayReserved.get(r.dayKey) ?? 0n) - r.amount);
      return true;
    },
    snapshot(dayKey) {
      return Object.freeze({
        durability: 'process',
        sessionCommittedAtomic: sessionCommitted.toString(),
        sessionReservedAtomic: sessionReserved.toString(),
        dayCommittedAtomic: (dayCommitted.get(dayKey) ?? 0n).toString(),
        dayReservedAtomic: (dayReserved.get(dayKey) ?? 0n).toString()
      });
    }
  });
}

export function createSpendingPolicy({
  maxAtomicPerRequest = null,
  maxAtomicPerSession = null,
  maxAtomicPerDay = null,
  allowedNetworks = [],
  allowedAssets = [],
  clock = () => new Date(),
  budgetStore = createMemoryBudgetStore(),
  requireDurableStore = false
} = {}) {
  const maxRequest = limit(maxAtomicPerRequest, 'maxAtomicPerRequest');
  const maxSession = limit(maxAtomicPerSession, 'maxAtomicPerSession');
  const maxDay = limit(maxAtomicPerDay, 'maxAtomicPerDay');
  const networkSet = new Set(allowedNetworks);
  const assetSet = new Set(allowedAssets);
  if (!budgetStore || typeof budgetStore.reserve !== 'function' || typeof budgetStore.commit !== 'function' || typeof budgetStore.cancel !== 'function') {
    throw new Error('budgetStore must implement reserve/commit/cancel');
  }
  if (requireDurableStore && budgetStore.durability !== 'durable') throw new Error('durable budget store required');

  const dayKey = () => {
    const value = clock();
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('clock returned invalid date');
    return date.toISOString().slice(0, 10);
  };

  return Object.freeze({
    durability: budgetStore.durability ?? 'unknown',
    reserve(requirements) {
      const amount = atomic(requirements?.amount, 'payment amount');
      if (maxRequest != null && amount > maxRequest) throw policyError('request_budget_exceeded', 'x402 price exceeds configured per-request budget');
      if (networkSet.size && !networkSet.has(requirements?.network)) throw policyError('network_not_allowed', 'x402 network is not allowed');
      if (assetSet.size && !assetSet.has(requirements?.asset)) throw policyError('asset_not_allowed', 'x402 asset is not allowed');
      const key = dayKey();
      const reservationId = budgetStore.reserve({ amount, dayKey: key, maxSession, maxDay });
      let open = true;
      return Object.freeze({
        id: reservationId,
        amountAtomic: amount.toString(),
        dayKey: key,
        commit() { if (!open) return false; open = false; return budgetStore.commit(reservationId); },
        cancel() { if (!open) return false; open = false; return budgetStore.cancel(reservationId); }
      });
    },
    snapshot() {
      return typeof budgetStore.snapshot === 'function'
        ? budgetStore.snapshot(dayKey())
        : Object.freeze({ durability: budgetStore.durability ?? 'unknown' });
    }
  });
}
