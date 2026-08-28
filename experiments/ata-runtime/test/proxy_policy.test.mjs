import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetedX402Fetch } from '../src/ata_gateway/openai_proxy.mjs';
import { encodeX402Header } from '../src/ata_gateway/x402_svm.mjs';

function paymentRequired(accepts) {
  return encodeX402Header({ x402Version: 2, resource: { url: '/paid' }, accepts });
}

function challenge(accepts) {
  return new Response(JSON.stringify({ payment: 'required' }), {
    status: 402,
    headers: { 'payment-required': paymentRequired(accepts) }
  });
}

const allowed = { scheme: 'exact', network: 'solana:allowed', asset: 'USDC', amount: '1000', payTo: 'seller' };

test('selects an allowed alternative, authorizes once, and commits a successful retry', async () => {
  const seen = [];
  let authorizeCount = 0;
  const fetchImpl = async (_url, init = {}) => {
    const headers = new Headers(init.headers || {});
    if (!headers.has('payment-signature')) return challenge([
      { ...allowed, network: 'solana:blocked' },
      allowed
    ]);
    seen.push(headers.get('payment-signature'));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const paidFetch = createBudgetedX402Fetch({
    fetchImpl,
    authorize: async ({ requirements }) => {
      authorizeCount += 1;
      assert.equal(requirements.network, 'solana:allowed');
      return { x402Version: 2, accepted: requirements, payload: { type: 'test' } };
    },
    maxAtomicPerRequest: '1000',
    maxAtomicPerSession: '1000',
    maxAtomicPerDay: '1000',
    allowedNetworks: ['solana:allowed'],
    allowedAssets: ['USDC'],
    clock: () => new Date('2026-08-29T03:00:00Z')
  });
  const response = await paidFetch('https://example.test/paid');
  assert.equal(response.status, 200);
  assert.equal(authorizeCount, 1);
  assert.equal(seen.length, 1);
  assert.equal(paidFetch.policy.snapshot().sessionCommittedAtomic, '1000');
  assert.equal(paidFetch.policy.snapshot().sessionReservedAtomic, '0');
});

test('concurrent reservations prevent session overspend before a second authorization', async () => {
  let authorizeCount = 0;
  let releaseFirst;
  const gate = new Promise((resolve) => { releaseFirst = resolve; });
  const fetchImpl = async (_url, init = {}) => {
    const headers = new Headers(init.headers || {});
    if (!headers.has('payment-signature')) return challenge([allowed]);
    return new Response('{}', { status: 200 });
  };
  const paidFetch = createBudgetedX402Fetch({
    fetchImpl,
    authorize: async () => {
      authorizeCount += 1;
      if (authorizeCount === 1) await gate;
      return { x402Version: 2, payload: { type: 'test' } };
    },
    maxAtomicPerRequest: '1000',
    maxAtomicPerSession: '1000',
    maxAtomicPerDay: '1000'
  });
  const first = paidFetch('https://example.test/paid');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await assert.rejects(paidFetch('https://example.test/paid'), /session budget exceeded/);
  assert.equal(authorizeCount, 1);
  releaseFirst();
  assert.equal((await first).status, 200);
});

test('a retry that remains 402 cancels the reservation', async () => {
  const fetchImpl = async () => challenge([allowed]);
  const paidFetch = createBudgetedX402Fetch({
    fetchImpl,
    authorize: async () => ({ x402Version: 2, payload: { type: 'test' } }),
    maxAtomicPerRequest: '1000',
    maxAtomicPerSession: '1000',
    maxAtomicPerDay: '1000'
  });
  const response = await paidFetch('https://example.test/paid');
  assert.equal(response.status, 402);
  assert.equal(paidFetch.policy.snapshot().sessionCommittedAtomic, '0');
  assert.equal(paidFetch.policy.snapshot().sessionReservedAtomic, '0');
});
