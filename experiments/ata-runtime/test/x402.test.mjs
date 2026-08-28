import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createX402FacilitatorAdapter } from '../src/ata_gateway/settlement.mjs';

test('x402 adapter calls verify then settle without overstating external finality', async (t) => {
  const seen = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    seen.push(req.url);
    res.setHeader('content-type', 'application/json');
    if (req.url === '/verify') return res.end(JSON.stringify({ isValid: true, payer: 'agent' }));
    if (req.url === '/settle') return res.end(JSON.stringify({ success: true, transaction: 'tx:test', network: 'solana:devnet' }));
    res.statusCode = 404; res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const adapter = createX402FacilitatorAdapter({ facilitatorUrl: `http://127.0.0.1:${port}`, paymentPayloadFactory: async () => ({ signature: 'mock' }) });
  const result = await adapter.settle({ requirement: { scheme: 'exact', network: 'solana:devnet', amount: '1' }, context: {} });
  assert.deepEqual(seen, ['/verify', '/settle']);
  assert.equal(result.finality, 'facilitator-reported');
  assert.equal(result.externalVerified, false);
  assert.equal(result.settlement.transaction, 'tx:test');
});

test('x402 adapter promotes finality only after evidence collector verifies settlement', async (t) => {
  const server = http.createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/verify') return res.end(JSON.stringify({ isValid: true }));
    if (req.url === '/settle') return res.end(JSON.stringify({ success: true, transaction: 'tx:verified', network: 'solana:devnet' }));
    res.statusCode = 404; res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const adapter = createX402FacilitatorAdapter({
    facilitatorUrl: `http://127.0.0.1:${port}`,
    paymentPayloadFactory: async () => ({ signature: 'mock' }),
    evidenceCollector: async () => ({ externalTxVerified: true, settled: true, receiverBalanceDeltaAtomic: '1000' })
  });
  const result = await adapter.settle({ requirement: { scheme: 'exact', network: 'solana:devnet', amount: '1' }, context: {} });
  assert.equal(result.finality, 'external-settled');
  assert.equal(result.externalVerified, true);
  assert.equal(result.evidence.receiverBalanceDeltaAtomic, '1000');
});
