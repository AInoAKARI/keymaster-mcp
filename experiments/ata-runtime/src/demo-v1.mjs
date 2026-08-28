import { createAgentWallet } from './agent_wallet/index.mjs';
import { createChannelOffer, createVoucher } from './ata_gateway/channel.mjs';
import { createGatewayClient } from './ata_gateway/client.mjs';
import { createAtaGateway } from './ata_gateway/server.mjs';
import { createNotarySettlement } from './ata_gateway/settlement.mjs';

const buyer = createAgentWallet('buyer');
const seller = createAgentWallet('seller');
const notary = createAgentWallet('notary');
const gateway = createAtaGateway({ identity: seller, settlement: createNotarySettlement({ notaryWallet: notary }) });
const address = await gateway.listen(0);
const baseUrl = `http://127.0.0.1:${address.port}`;
const client = createGatewayClient({ baseUrl });

try {
  const channel = createChannelOffer({ payer: buyer, payee: seller, maxBudgetJpyMicros: '100000' });
  await client.handshake(channel);
  const voucher = createVoucher({ wallet: buyer, channel, sequence: 1, cumulativeJpyMicros: '10000', memoHash: 'demo' });
  const receipt = await client.relay({ channelId: channel.channelId, voucher, provider: 'llm', model: 'provider-agnostic', payload: { text: 'AtA ¥0.01 hello' } });
  console.log(JSON.stringify({ status: 'COMPLETED', buyer: buyer.did, seller: seller.did, buyerAddress: buyer.address, sellerAddress: seller.address, yen: '0.01', receipt }, null, 2));
} finally {
  await gateway.close();
}
