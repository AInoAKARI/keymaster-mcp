import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryBudgetStore, createSpendingPolicy } from '../src/ata_gateway/spending_policy.mjs';

const NETWORK = 'solana:test';
const ASSET = 'USDC_TEST';
const req = (amount = '1000', network = NETWORK, asset = ASSET) => ({ amount, network, asset });

test('rejects per-request, network, and asset before reserving budget', () => {
  const policy = createSpendingPolicy({
    maxAtomicPerRequest: '1000',
    maxAtomicPerSession: '5000',
    maxAtomicPerDay: '5000',
    allowedNetworks: [NETWORK],
    allowedAssets: [ASSET],
    clock: () => new Date('2026-08-29T00:00:00Z')
  });
  assert.throws(() => policy.reserve(req('1001')), /per-request budget/);
  assert.throws(() => policy.reserve(req('1000', 'solana:other')), /network is not allowed/);
  assert.throws(() => policy.reserve(req('1000', NETWORK, 'OTHER')), /asset is not allowed/);
  assert.deepEqual(policy.snapshot(), {
    durability: 'process',
    sessionCommittedAtomic: '0',
    sessionReservedAtomic: '0',
    dayCommittedAtomic: '0',
    dayReservedAtomic: '0'
  });
});

test('enforces committed session and daily spend', () => {
  const policy = createSpendingPolicy({
    maxAtomicPerRequest: '1000',
    maxAtomicPerSession: '2000',
    maxAtomicPerDay: '2000',
    clock: () => new Date('2026-08-29T01:00:00Z')
  });
  policy.reserve(req()).commit();
  policy.reserve(req()).commit();
  assert.throws(() => policy.reserve(req()), /session budget exceeded/);
  assert.equal(policy.snapshot().sessionCommittedAtomic, '2000');
  assert.equal(policy.snapshot().dayCommittedAtomic, '2000');
});

test('reservation blocks concurrent overspend and cancel releases it', () => {
  const policy = createSpendingPolicy({
    maxAtomicPerRequest: '1000',
    maxAtomicPerSession: '1000',
    maxAtomicPerDay: '1000',
    clock: () => new Date('2026-08-29T02:00:00Z')
  });
  const first = policy.reserve(req());
  assert.equal(policy.snapshot().sessionReservedAtomic, '1000');
  assert.throws(() => policy.reserve(req()), /session budget exceeded/);
  assert.equal(first.cancel(), true);
  const second = policy.reserve(req());
  assert.equal(second.commit(), true);
  assert.equal(policy.snapshot().sessionReservedAtomic, '0');
  assert.equal(policy.snapshot().sessionCommittedAtomic, '1000');
});

test('durable requirement rejects process-only store', () => {
  assert.throws(() => createSpendingPolicy({
    maxAtomicPerDay: '1000',
    budgetStore: createMemoryBudgetStore(),
    requireDurableStore: true
  }), /durable budget store required/);
});
