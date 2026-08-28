import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentWallet } from '../src/agent_wallet/index.mjs';
import { createBatchPaymentRequirements, decodeX402Header, SOLANA_DEVNET } from '../src/ata_gateway/x402_svm.mjs';
import { createOpenAiCompatibleAtaProxy, createBudgetedX402Fetch } from '../src/ata_gateway/openai_proxy.mjs';

async function withProxy(fn) {
  const receiver = createAgentWallet('receiver'); const fee = createAgentWallet('fee');
  const requirements = createBatchPaymentRequirements({ payTo: receiver.address, feePayer: fee.address });
  const proxy = createOpenAiCompatibleAtaProxy({ requirements, verifyPayment: async ({ paymentPayload }) => ({ ok: paymentPayload?.payload?.type === 'voucher', payer: paymentPayload?.payload?.channelConfig?.payer || 'payer', paymentResponse: { success: true, transaction: 'offchain:voucher:1', network: SOLANA_DEVNET, payer: 'payer', amount: '1000' } }), handler: async (body) => ({ id: 'chatcmpl-ata', object: 'chat.completion', model: body.model || 'ata-proxy', choices: [{ index: 0, message: { role: 'assistant', content: 'paid-ok' }, finish_reason: 'stop' }] }) });
  const address = await proxy.listen();
  try { await fn(`http://127.0.0.1:${address.port}`, requirements); } finally { await proxy.close(); }
}

test('OpenAI-compatible endpoint returns canonical 402 challenge before payment', async () => withProxy(async (base) => {
  const r = await fetch(`${base}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'ata-proxy', messages: [] }) });
  assert.equal(r.status, 402);
  const required = decodeX402Header(r.headers.get('payment-required'));
  assert.equal(required.x402Version, 2);
  assert.equal(required.accepts[0].scheme, 'batch-settlement');
  const body = await r.json(); assert.equal(body.error.code, 'x402_payment_required');
}));

test('budgeted x402 fetch retries transparently only after explicit authorization policy', async () => withProxy(async (base, requirements) => {
  let authorizeCalls = 0;
  const paidFetch = createBudgetedX402Fetch({ maxAtomicPerRequest: '1000', allowedNetworks: [SOLANA_DEVNET], authorize: async ({ paymentRequired }) => { authorizeCalls += 1; return { x402Version: 2, resource: paymentRequired.resource, accepted: requirements, payload: { type: 'voucher', channelConfig: { payer: 'payer' }, voucher: { channelId: 'demo' } }, extensions: {} }; } });
  const r = await paidFetch(`${base}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'ata-proxy', messages: [] }) });
  assert.equal(r.status, 200); assert.equal(authorizeCalls, 1);
  const body = await r.json(); assert.equal(body.choices[0].message.content, 'paid-ok');
  assert.equal(decodeX402Header(r.headers.get('payment-response')).transaction, 'offchain:voucher:1');
}));

test('budgeted x402 fetch refuses prices above policy', async () => withProxy(async (base) => {
  const paidFetch = createBudgetedX402Fetch({ maxAtomicPerRequest: '999', allowedNetworks: [SOLANA_DEVNET], authorize: async () => { throw new Error('must not authorize'); } });
  await assert.rejects(() => paidFetch(`${base}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), /price exceeds/);
}));
