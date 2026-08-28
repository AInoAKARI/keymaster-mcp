import crypto from 'node:crypto';
import { didFromPublicKey, sha256, verifyAgentSignature } from '../agent_wallet/index.mjs';
import { DEFAULT_MICROPAYMENT_JPY_MICROS, parseJpyMicros } from './amounts.mjs';

export function createChannelOffer({ payer, payee, maxBudgetJpyMicros = '1000000', minIncrementJpyMicros = DEFAULT_MICROPAYMENT_JPY_MICROS.toString(), ttlSeconds = 900 }) {
  const now = Date.now();
  const unsigned = {
    version: 'ata-channel/0.1',
    channelId: crypto.randomUUID(),
    payer: { did: payer.did, address: payer.address, publicKey: payer.publicKey },
    payee: { did: payee.did, address: payee.address, publicKey: payee.publicKey },
    asset: 'JPY_MICROS',
    maxBudgetJpyMicros: parseJpyMicros(maxBudgetJpyMicros).toString(),
    minIncrementJpyMicros: parseJpyMicros(minIncrementJpyMicros).toString(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlSeconds * 1000).toISOString()
  };
  return { ...unsigned, signature: payer.sign(unsigned) };
}

export function verifyChannelOffer(offer) {
  if (offer?.version !== 'ata-channel/0.1') throw new Error('unsupported channel version');
  if (didFromPublicKey(offer.payer.publicKey) !== offer.payer.did) throw new Error('payer DID mismatch');
  if (!verifyAgentSignature({ publicKey: offer.payer.publicKey, value: stripSignature(offer), signature: offer.signature })) {
    throw new Error('invalid channel signature');
  }
  if (Date.parse(offer.expiresAt) <= Date.now()) throw new Error('channel expired');
  if (parseJpyMicros(offer.minIncrementJpyMicros) <= 0n) throw new Error('invalid minimum increment');
  if (parseJpyMicros(offer.maxBudgetJpyMicros) < parseJpyMicros(offer.minIncrementJpyMicros)) throw new Error('budget below minimum increment');
  return true;
}

function stripSignature(value) {
  const { signature, ...unsigned } = value;
  return unsigned;
}

export function createVoucher({ wallet, channel, sequence, cumulativeJpyMicros, previousVoucherHash = null, memoHash = null }) {
  verifyChannelOffer(channel);
  if (wallet.did !== channel.payer.did || wallet.publicKey !== channel.payer.publicKey) throw new Error('wallet is not channel payer');
  const unsigned = {
    version: 'ata-voucher/0.1',
    channelId: channel.channelId,
    payerDid: channel.payer.did,
    payeeDid: channel.payee.did,
    sequence: Number(sequence),
    cumulativeJpyMicros: parseJpyMicros(cumulativeJpyMicros).toString(),
    previousVoucherHash,
    memoHash,
    issuedAt: new Date().toISOString(),
    expiresAt: channel.expiresAt
  };
  return { ...unsigned, signature: wallet.sign(unsigned) };
}

export function verifyVoucher({ channel, voucher, previousVoucher = null }) {
  verifyChannelOffer(channel);
  if (voucher?.version !== 'ata-voucher/0.1') throw new Error('unsupported voucher version');
  if (voucher.channelId !== channel.channelId) throw new Error('channel mismatch');
  if (voucher.payerDid !== channel.payer.did || voucher.payeeDid !== channel.payee.did) throw new Error('party mismatch');
  if (!Number.isInteger(voucher.sequence) || voucher.sequence < 1) throw new Error('invalid sequence');
  if (Date.parse(voucher.expiresAt) <= Date.now()) throw new Error('voucher expired');
  if (!verifyAgentSignature({ publicKey: channel.payer.publicKey, value: stripSignature(voucher), signature: voucher.signature })) {
    throw new Error('invalid voucher signature');
  }

  const cumulative = parseJpyMicros(voucher.cumulativeJpyMicros);
  const maxBudget = parseJpyMicros(channel.maxBudgetJpyMicros);
  const minIncrement = parseJpyMicros(channel.minIncrementJpyMicros);
  if (cumulative > maxBudget) throw new Error('voucher exceeds channel budget');

  if (!previousVoucher) {
    if (voucher.sequence !== 1) throw new Error('first voucher sequence must be 1');
    if (voucher.previousVoucherHash !== null) throw new Error('first voucher must not reference a predecessor');
    if (cumulative < minIncrement) throw new Error('voucher below minimum increment');
    return { deltaJpyMicros: cumulative.toString(), voucherHash: sha256(voucher) };
  }

  const previousCumulative = parseJpyMicros(previousVoucher.cumulativeJpyMicros);
  if (voucher.sequence !== previousVoucher.sequence + 1) throw new Error('non-monotonic sequence');
  if (voucher.previousVoucherHash !== sha256(previousVoucher)) throw new Error('voucher chain mismatch');
  if (cumulative <= previousCumulative) throw new Error('non-monotonic cumulative amount');
  const delta = cumulative - previousCumulative;
  if (delta < minIncrement) throw new Error('voucher increment below minimum');
  return { deltaJpyMicros: delta.toString(), voucherHash: sha256(voucher) };
}
