import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentWallet } from '../src/agent_wallet/index.mjs';
import { createChannelOffer, createVoucher } from '../src/ata_gateway/channel.mjs';
import { createGatewayClient } from '../src/ata_gateway/client.mjs';
import { createAtaGateway } from '../src/ata_gateway/server.mjs';
import { createNotarySettlement } from '../src/ata_gateway/settlement.mjs';

test('gateway handshakes and notarizes a paid relay', async (t) => {
  const buyer = createAgentWallet('buyer');
  const seller = createAgentWallet('seller');
  const notary = createAgentWallet('notary');
  const gateway = createAtaGateway({ identity: seller, settlement: createNotarySettlement({ notaryWallet: notary }) });
  const address = await gateway.listen(0);
  t.after(() => gateway.close());
  const client = createGatewayClient({ baseUrl: `http://127.0.0.1:${address.port}` });
  const channel = createChannelOffer({ payer: buyer, payee: seller });
  const hello = await client.handshake(channel);
  assert.equal(hello.accepted, true);
  const voucher = createVoucher({ wallet: buyer, channel, sequence: 1, cumulativeJpyMicros: '10000' });
  const receipt = await client.relay({ channelId: channel.channelId, voucher, provider: 'openai', model: 'gpt', payload: { answer: 42 } });
  assert.equal(receipt.deltaJpyMicros, '10000');
  assert.equal(receipt.receipt.finality, 'notary-only');
  await assert.rejects(client.relay({ channelId: channel.channelId, voucher, provider: 'openai', model: 'gpt', payload: { answer: 42 } }), /sequence|chain|monotonic/);
});
