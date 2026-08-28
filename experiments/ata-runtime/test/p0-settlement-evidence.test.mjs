import test from 'node:test';
import assert from 'node:assert/strict';
import { createChannelConfig, createDepositPaymentPayload, createTrustedSvmTransactionBoundary, validateChannelAgainstRequirements } from '../src/ata_gateway/svm_channel_client.mjs';
import { collectExternalSettlementEvidence, toRealityLedgerSettlement } from '../src/ata_gateway/settlement_evidence.mjs';
import { createSolanaRpcClient } from '../src/ata_gateway/solana_rpc.mjs';

const payer = '11111111111111111111111111111111';
const payerAuthorizer = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const feePayer = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const receiver = 'CHNLxYvVA28MJP9PrFuDXccuoGXAx7jBacfLEkahyGsX';
const token = 'So11111111111111111111111111111111111111112';
const requirements = {
  scheme: 'batch-settlement',
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  amount: '1000',
  asset: token,
  payTo: receiver,
  maxTimeoutSeconds: 300,
  extra: { feePayer, withdrawDelay: 3600, tokenProgram: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }
};

test('channel config enforces x402 authority separation and mapping', () => {
  const config = createChannelConfig({ payer, payerAuthorizer, receiver, token, withdrawDelay: 3600, salt: '42', openSlot: 123 });
  assert.equal(validateChannelAgainstRequirements({ requirements, channelConfig: config }), true);
  const bad = { ...config, payer: feePayer };
  assert.throws(() => validateChannelAgainstRequirements({ requirements, channelConfig: bad }), /payer must differ/);
});

test('deposit payload matches x402 v2 batch-settlement tagged union', () => {
  const config = createChannelConfig({ payer, payerAuthorizer, receiver, token, withdrawDelay: 3600, salt: '42', openSlot: 123 });
  const voucher = { channelId: receiver, maxClaimableAmount: '1000', expiresAt: 0, signature: '3'.repeat(88) };
  const payload = createDepositPaymentPayload({ requirements, channelConfig: config, voucher, depositAmount: '100000', transactionBase64: 'AQIDBAUGBwg=' });
  assert.equal(payload.x402Version, 2);
  assert.equal(payload.payload.type, 'deposit');
  assert.equal(payload.payload.deposit.amount, '100000');
});

test('trusted transaction boundary never requires or exports a raw private key', async () => {
  const boundary = createTrustedSvmTransactionBoundary({
    buildOpenTransaction: async (input) => {
      assert.equal('privateKey' in input, false);
      return { transaction: 'AQIDBAUGBwg=', publicEvidence: { builder: 'official-client-adapter' }, privateKey: 'must-not-leak' };
    }
  });
  const result = await boundary.buildOpen({ payer, programId: receiver });
  assert.equal(result.transaction, 'AQIDBAUGBwg=');
  assert.equal('privateKey' in result, false);
  assert.equal(result.publicEvidence.builder, 'official-client-adapter');
});

test('deposit tx can be externally confirmed without being falsely counted as receiver settlement', async () => {
  const evidence = await collectExternalSettlementEvidence({
    phase: 'deposit',
    settlementResponse: { success: true, transaction: 'tx-deposit-123', network: requirements.network },
    expectedNetwork: requirements.network,
    expectedAmountAtomic: '1000',
    rpc: { getSignatureStatus: async () => ({ err: null, confirmationStatus: 'confirmed' }) }
  });
  assert.equal(evidence.externalTxVerified, true);
  assert.equal(evidence.settled, false);
  assert.equal(toRealityLedgerSettlement(evidence).settled, false);
});

test('only confirmed distribute tx plus receiver balance delta becomes real settlement evidence', async () => {
  const rpc = {
    getSignatureStatus: async () => ({ err: null, confirmationStatus: 'finalized' }),
    getTokenAccountBalance: async () => 501500n
  };
  const evidence = await collectExternalSettlementEvidence({
    phase: 'distribute',
    settlementResponse: { success: true, transaction: 'tx-distribute-123', network: requirements.network },
    expectedNetwork: requirements.network,
    expectedAmountAtomic: '1000',
    receiverTokenAccount: receiver,
    beforeReceiverBalanceAtomic: '500000',
    rpc
  });
  assert.equal(evidence.settled, true);
  assert.equal(evidence.receiverBalanceDeltaAtomic, '1500');
  assert.equal(toRealityLedgerSettlement(evidence).externalTransaction, 'tx-distribute-123');
});

test('RPC transport errors are surfaced as infrastructure blockers', async () => {
  const rpc = createSolanaRpcClient({ fetchImpl: async () => { throw new Error('dns blocked'); } });
  await assert.rejects(() => rpc.getSlot(), /solana rpc unavailable: dns blocked/);
});
