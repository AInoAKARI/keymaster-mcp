import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentWallet } from '../src/agent_wallet/index.mjs';
import { createChannelOffer, createVoucher, verifyVoucher } from '../src/ata_gateway/channel.mjs';

test('channel accepts chained ¥0.01 cumulative vouchers and rejects replay', () => {
  const buyer = createAgentWallet('buyer');
  const seller = createAgentWallet('seller');
  const channel = createChannelOffer({ payer: buyer, payee: seller, maxBudgetJpyMicros: '100000' });
  const first = createVoucher({ wallet: buyer, channel, sequence: 1, cumulativeJpyMicros: '10000' });
  const v1 = verifyVoucher({ channel, voucher: first });
  assert.equal(v1.deltaJpyMicros, '10000');
  const second = createVoucher({ wallet: buyer, channel, sequence: 2, cumulativeJpyMicros: '20000', previousVoucherHash: v1.voucherHash });
  const v2 = verifyVoucher({ channel, voucher: second, previousVoucher: first });
  assert.equal(v2.deltaJpyMicros, '10000');
  assert.throws(() => verifyVoucher({ channel, voucher: first, previousVoucher: first }), /sequence|chain|monotonic/);
});

test('voucher tamper fails signature verification', () => {
  const buyer = createAgentWallet('buyer');
  const seller = createAgentWallet('seller');
  const channel = createChannelOffer({ payer: buyer, payee: seller });
  const voucher = createVoucher({ wallet: buyer, channel, sequence: 1, cumulativeJpyMicros: '10000' });
  assert.throws(() => verifyVoucher({ channel, voucher: { ...voucher, cumulativeJpyMicros: '99999' } }), /signature/);
});
