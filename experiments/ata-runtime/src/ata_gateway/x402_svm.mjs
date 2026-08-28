import { base58Decode, verifyEd25519Bytes } from '../agent_wallet/index.mjs';

export const SOLANA_DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const SOLANA_DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
export const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const DEFAULT_ATOMIC_PRICE = '1000'; // 0.001 USDC

function u64le(value) {
  const n = BigInt(value);
  if (n < 0n || n > 0xffffffffffffffffn) throw new Error('u64 out of range');
  const out = Buffer.alloc(8); out.writeBigUInt64LE(n); return out;
}
function i64le(value) {
  const n = BigInt(value);
  if (n < -0x8000000000000000n || n > 0x7fffffffffffffffn) throw new Error('i64 out of range');
  const out = Buffer.alloc(8); out.writeBigInt64LE(n); return out;
}
function pubkey(value, label) {
  const bytes = base58Decode(value);
  if (bytes.length !== 32) throw new Error(`${label} must be a 32-byte base58 key`);
  return bytes;
}

export function createBatchVoucherMessage({ channelId, maxClaimableAmount, expiresAt = 0 }) {
  const message = Buffer.concat([Buffer.from([0x56, 0x01]), pubkey(channelId, 'channelId'), u64le(maxClaimableAmount), i64le(expiresAt)]);
  if (message.length !== 50) throw new Error('invalid voucher message length');
  return message;
}

export function createBatchVoucher({ wallet, channelId, maxClaimableAmount }) {
  const message = createBatchVoucherMessage({ channelId, maxClaimableAmount, expiresAt: 0 });
  return { channelId, maxClaimableAmount: String(maxClaimableAmount), expiresAt: 0, signature: wallet.signBytes(message, 'base58') };
}

export function verifyBatchVoucher({ payerAuthorizer, voucher }) {
  if (voucher?.expiresAt !== 0) return false;
  const bytes = createBatchVoucherMessage(voucher);
  return verifyEd25519Bytes({ address: payerAuthorizer, bytes, signature: voucher.signature });
}

export function createBatchPaymentRequirements({ payTo, feePayer, receiverAuthorizer, amount = DEFAULT_ATOMIC_PRICE, withdrawDelay = 3600, maxTimeoutSeconds = 300, memo }) {
  pubkey(payTo, 'payTo'); pubkey(feePayer, 'feePayer');
  if (receiverAuthorizer) pubkey(receiverAuthorizer, 'receiverAuthorizer');
  if (!/^\d+$/.test(String(amount)) || BigInt(amount) <= 0n) throw new Error('amount must be positive atomic units');
  if (!Number.isInteger(withdrawDelay) || withdrawDelay < 900 || withdrawDelay > 2_592_000 || withdrawDelay < maxTimeoutSeconds) throw new Error('invalid withdrawDelay');
  const extra = { paymentFlow: 'authorization', feePayer, withdrawDelay, tokenProgram: SPL_TOKEN_PROGRAM };
  if (receiverAuthorizer) extra.receiverAuthorizer = receiverAuthorizer;
  if (memo) extra.memo = memo;
  return { scheme: 'batch-settlement', network: SOLANA_DEVNET, amount: String(amount), asset: SOLANA_DEVNET_USDC, payTo, maxTimeoutSeconds, extra };
}

export function createPaymentRequired({ url, requirements, serviceName = 'AI no Akari AtA', description = 'OpenAI-compatible paid inference' }) {
  return { x402Version: 2, error: 'PAYMENT-SIGNATURE header is required', resource: { url, description, mimeType: 'application/json', serviceName, tags: ['ai-agent', 'x402'] }, accepts: [requirements], extensions: {} };
}

export function encodeX402Header(value) { return Buffer.from(JSON.stringify(value)).toString('base64'); }
export function decodeX402Header(value) { return JSON.parse(Buffer.from(value, 'base64').toString('utf8')); }
