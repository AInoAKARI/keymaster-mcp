import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentWallet } from '../src/agent_wallet/index.mjs';
import { createBatchVoucher, createBatchVoucherMessage, createBatchPaymentRequirements, verifyBatchVoucher, SOLANA_DEVNET } from '../src/ata_gateway/x402_svm.mjs';

test('batch-settlement voucher uses canonical 50-byte SVM wire message', () => {
  const payer = createAgentWallet('payer');
  const channel = createAgentWallet('channel').address;
  const voucher = createBatchVoucher({ wallet: payer, channelId: channel, maxClaimableAmount: '5000' });
  assert.equal(createBatchVoucherMessage(voucher).length, 50);
  assert.equal(verifyBatchVoucher({ payerAuthorizer: payer.address, voucher }), true);
  assert.equal(verifyBatchVoucher({ payerAuthorizer: payer.address, voucher: { ...voucher, maxClaimableAmount: '5001' } }), false);
});

test('devnet PaymentRequirements are x402 v2 batch-settlement compatible', () => {
  const payTo = createAgentWallet('receiver');
  const fee = createAgentWallet('fee');
  const req = createBatchPaymentRequirements({ payTo: payTo.address, feePayer: fee.address, receiverAuthorizer: payTo.address });
  assert.equal(req.scheme, 'batch-settlement');
  assert.equal(req.network, SOLANA_DEVNET);
  assert.equal(req.amount, '1000');
  assert.equal(req.extra.paymentFlow, 'authorization');
});
