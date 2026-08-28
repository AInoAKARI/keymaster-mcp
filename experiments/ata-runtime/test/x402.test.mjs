import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createX402FacilitatorAdapter } from '../src/ata_gateway/settlement.mjs';

test('x402 adapter calls verify then settle', async (t) => {
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
  assert.equal(result.finality, 'external');
  assert.equal(result.settlement.transaction, 'tx:test');
});
