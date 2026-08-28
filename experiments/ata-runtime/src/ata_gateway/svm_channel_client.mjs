import { base58Decode } from '../agent_wallet/index.mjs';

const U64_MAX = 0xffffffffffffffffn;

function publicKey(value, label) {
  const bytes = base58Decode(value);
  if (bytes.length !== 32) throw new Error(`${label} must be a 32-byte base58 public key`);
  return value;
}

function u64Decimal(value, label) {
  if (!/^\d+$/.test(String(value))) throw new Error(`${label} must be an unsigned decimal integer`);
  const n = BigInt(value);
  if (n > U64_MAX) throw new Error(`${label} exceeds u64`);
  return n.toString();
}

function assertRequirements(requirements) {
  if (requirements?.scheme !== 'batch-settlement') throw new Error('batch-settlement requirements required');
  if (!requirements.network || !requirements.asset || !requirements.payTo) throw new Error('incomplete payment requirements');
  if (!requirements.extra?.feePayer) throw new Error('feePayer required');
  return requirements;
}

export function createChannelConfig({ payer, payerAuthorizer, receiver, receiverAuthorizer, token, withdrawDelay, salt, openSlot }) {
  publicKey(payer, 'payer');
  publicKey(payerAuthorizer, 'payerAuthorizer');
  publicKey(receiver, 'receiver');
  if (receiverAuthorizer) publicKey(receiverAuthorizer, 'receiverAuthorizer');
  publicKey(token, 'token');
  if (!Number.isInteger(withdrawDelay) || withdrawDelay <= 0) throw new Error('withdrawDelay must be a positive integer');
  const config = {
    payer,
    payerAuthorizer,
    receiver,
    token,
    withdrawDelay,
    salt: u64Decimal(salt, 'salt'),
    openSlot: Number(u64Decimal(openSlot, 'openSlot'))
  };
  if (!Number.isSafeInteger(config.openSlot)) throw new Error('openSlot exceeds safe integer range');
  if (receiverAuthorizer) config.receiverAuthorizer = receiverAuthorizer;
  return config;
}

export function validateChannelAgainstRequirements({ requirements, channelConfig }) {
  assertRequirements(requirements);
  if (!channelConfig) throw new Error('channelConfig required');
  const feePayer = publicKey(requirements.extra.feePayer, 'feePayer');
  if (channelConfig.payer === feePayer) throw new Error('payer must differ from feePayer');
  if (channelConfig.payerAuthorizer === feePayer) throw new Error('payerAuthorizer must differ from feePayer');
  if (channelConfig.receiver !== requirements.payTo) throw new Error('receiver must equal payTo');
  if (channelConfig.token !== requirements.asset) throw new Error('token must equal asset');
  if (channelConfig.withdrawDelay !== requirements.extra.withdrawDelay) throw new Error('withdrawDelay mismatch');
  const expectedReceiverAuthorizer = requirements.extra.receiverAuthorizer;
  if ((channelConfig.receiverAuthorizer ?? null) !== (expectedReceiverAuthorizer ?? null)) throw new Error('receiverAuthorizer mismatch');
  return true;
}

export function createDepositPaymentPayload({ requirements, channelConfig, voucher, depositAmount, transactionBase64 }) {
  validateChannelAgainstRequirements({ requirements, channelConfig });
  const amount = u64Decimal(depositAmount, 'depositAmount');
  if (!voucher?.channelId || !voucher?.signature) throw new Error('voucher required');
  if (voucher.expiresAt !== 0) throw new Error('batch voucher expiresAt must be 0');
  if (typeof transactionBase64 !== 'string' || transactionBase64.length < 8) throw new Error('signed transaction base64 required');
  return {
    x402Version: 2,
    accepted: structuredClone(requirements),
    payload: {
      type: 'deposit',
      channelConfig: structuredClone(channelConfig),
      voucher: structuredClone(voucher),
      deposit: { amount, transaction: transactionBase64 }
    }
  };
}

export function createVoucherPaymentPayload({ requirements, channelConfig, voucher }) {
  validateChannelAgainstRequirements({ requirements, channelConfig });
  if (!voucher?.channelId || !voucher?.signature || voucher.expiresAt !== 0) throw new Error('valid batch voucher required');
  return {
    x402Version: 2,
    accepted: structuredClone(requirements),
    payload: { type: 'voucher', channelConfig: structuredClone(channelConfig), voucher: structuredClone(voucher) }
  };
}

function normalizeBuilderResult(value, operation) {
  const transaction = typeof value === 'string' ? value : value?.transaction;
  if (typeof transaction !== 'string' || transaction.length < 8) throw new Error(`${operation} builder did not return signed transaction base64`);
  const publicEvidence = typeof value === 'object' && value ? value.publicEvidence : undefined;
  return Object.freeze({ transaction, ...(publicEvidence ? { publicEvidence } : {}) });
}

export function createTrustedSvmTransactionBoundary({ buildOpenTransaction, buildTopUpTransaction } = {}) {
  return Object.freeze({
    async buildOpen(input) {
      if (typeof buildOpenTransaction !== 'function') throw new Error('trusted SVM open transaction builder unavailable');
      return normalizeBuilderResult(await buildOpenTransaction(structuredClone(input)), 'open');
    },
    async buildTopUp(input) {
      if (typeof buildTopUpTransaction !== 'function') throw new Error('trusted SVM top-up transaction builder unavailable');
      return normalizeBuilderResult(await buildTopUpTransaction(structuredClone(input)), 'top-up');
    }
  });
}
