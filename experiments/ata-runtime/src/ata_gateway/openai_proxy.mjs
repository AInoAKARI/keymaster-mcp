import http from 'node:http';
import { createPaymentRequired, decodeX402Header, encodeX402Header } from './x402_svm.mjs';
import { createSpendingPolicy } from './spending_policy.mjs';

async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 1_000_000) throw new Error('request too large'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

export function createOpenAiCompatibleAtaProxy({ requirements, verifyPayment, handler, model = 'ata-proxy' }) {
  if (typeof verifyPayment !== 'function' || typeof handler !== 'function') throw new Error('verifyPayment and handler are required');
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/v1/models') return send(res, 200, { object: 'list', data: [{ id: model, object: 'model', owned_by: 'AIﾉアカリ☆' }] });
      if (req.method === 'GET' && req.url === '/.well-known/x402.json') return send(res, 200, { x402Version: 2, endpoints: [{ method: 'POST', path: '/v1/chat/completions', accepts: [requirements] }] });
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return send(res, 404, { error: { message: 'Not found', type: 'invalid_request_error', code: 'not_found' } });

      const body = await readJson(req);
      const paymentHeader = req.headers['payment-signature'];
      if (!paymentHeader) {
        const required = createPaymentRequired({ url: '/v1/chat/completions', requirements });
        return send(res, 402, { error: { message: 'Payment required', type: 'payment_required', code: 'x402_payment_required' }, x402: required }, { 'PAYMENT-REQUIRED': encodeX402Header(required) });
      }

      let paymentPayload;
      try { paymentPayload = decodeX402Header(String(paymentHeader)); }
      catch { return send(res, 400, { error: { message: 'Invalid PAYMENT-SIGNATURE', type: 'invalid_request_error', code: 'invalid_payment_signature' } }); }
      const verified = await verifyPayment({ paymentPayload, requirements, request: body });
      if (!verified?.ok) return send(res, 402, { error: { message: verified?.reason || 'Payment verification failed', type: 'payment_required', code: 'payment_rejected' } });

      const result = await handler(body);
      const paymentResponse = verified.paymentResponse ?? { success: true, transaction: '', network: requirements.network, payer: verified.payer ?? '', amount: requirements.amount };
      return send(res, 200, result, { 'PAYMENT-RESPONSE': encodeX402Header(paymentResponse) });
    } catch (error) {
      return send(res, 500, { error: { message: error instanceof Error ? error.message : 'Internal error', type: 'server_error', code: 'ata_proxy_error' } });
    }
  });
  return {
    listen(port = 0, host = '127.0.0.1') { return new Promise((resolve) => server.listen(port, host, () => resolve(server.address()))); },
    close() { return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  };
}

export function createBudgetedX402Fetch({
  fetchImpl = fetch,
  authorize,
  policy,
  maxAtomicPerRequest = '1000',
  maxAtomicPerSession = null,
  maxAtomicPerDay = null,
  allowedNetworks = [],
  allowedAssets = [],
  budgetStore,
  requireDurableStore = false,
  clock
}) {
  if (typeof authorize !== 'function') throw new Error('authorize is required');
  const spendPolicy = policy ?? createSpendingPolicy({
    maxAtomicPerRequest,
    maxAtomicPerSession,
    maxAtomicPerDay,
    allowedNetworks,
    allowedAssets,
    budgetStore,
    requireDurableStore,
    ...(clock ? { clock } : {})
  });
  if (!spendPolicy || typeof spendPolicy.reserve !== 'function') throw new Error('policy must provide reserve(requirements)');

  const paidFetch = async function paidFetch(url, init = {}) {
    const first = await fetchImpl(url, init);
    if (first.status !== 402) return first;
    const requiredHeader = first.headers.get('payment-required');
    if (!requiredHeader) return first;
    const required = decodeX402Header(requiredHeader);

    let selected = null;
    let reservation = null;
    let lastPolicyError = null;
    for (const candidate of required.accepts ?? []) {
      try {
        reservation = await spendPolicy.reserve(candidate);
        selected = candidate;
        break;
      } catch (error) {
        lastPolicyError = error;
      }
    }
    if (!selected || !reservation) throw lastPolicyError ?? new Error('no x402 payment option allowed by policy');

    try {
      const paymentPayload = await authorize({ paymentRequired: required, requirements: selected, reservation });
      const headers = new Headers(init.headers || {});
      headers.set('PAYMENT-SIGNATURE', encodeX402Header(paymentPayload));
      const second = await fetchImpl(url, { ...init, headers });
      if (second.status === 402) reservation.cancel();
      else reservation.commit();
      return second;
    } catch (error) {
      reservation.cancel();
      throw error;
    }
  };
  paidFetch.policy = spendPolicy;
  return paidFetch;
}
