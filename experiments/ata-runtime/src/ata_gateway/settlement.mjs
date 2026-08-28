import crypto from 'node:crypto';
import { sha256 } from '../agent_wallet/index.mjs';

export function createNotarySettlement({ notaryWallet }) {
  return {
    async settle({ channel, voucher, deltaJpyMicros, payloadHash }) {
      const unsigned = {
        version: 'ata-settlement/0.1',
        rail: 'notary',
        finality: 'notary-only',
        settlementId: `ata:notary:${crypto.randomUUID()}`,
        channelId: channel.channelId,
        voucherHash: sha256(voucher),
        cumulativeJpyMicros: voucher.cumulativeJpyMicros,
        deltaJpyMicros,
        payloadHash,
        settledAt: new Date().toISOString(),
        notary: { did: notaryWallet.did, address: notaryWallet.address, publicKey: notaryWallet.publicKey }
      };
      return { ...unsigned, signature: notaryWallet.sign(unsigned) };
    }
  };
}

export function createX402FacilitatorAdapter({ facilitatorUrl, paymentPayloadFactory, evidenceCollector, fetchImpl = fetch }) {
  const base = new URL(facilitatorUrl);
  return {
    async settle({ requirement, context }) {
      const paymentPayload = await paymentPayloadFactory(requirement, context);
      const verifyResponse = await fetchImpl(new URL('/verify', base), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentPayload, paymentRequirements: requirement })
      });
      const verifyBody = await verifyResponse.json();
      if (!verifyResponse.ok || verifyBody.isValid === false) throw new Error(verifyBody.invalidReason || `x402 verify failed: HTTP ${verifyResponse.status}`);

      const settleResponse = await fetchImpl(new URL('/settle', base), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentPayload, paymentRequirements: requirement })
      });
      const settleBody = await settleResponse.json();
      if (!settleResponse.ok || settleBody.success === false) throw new Error(settleBody.errorReason || `x402 settle failed: HTTP ${settleResponse.status}`);

      const result = {
        version: 'ata-settlement/0.2',
        rail: 'x402-v2',
        finality: 'facilitator-reported',
        externalVerified: false,
        paymentPayloadHash: sha256(paymentPayload),
        verification: verifyBody,
        settlement: settleBody
      };

      if (typeof evidenceCollector === 'function') {
        const evidence = await evidenceCollector({ requirement, context, paymentPayload, verification: verifyBody, settlement: settleBody });
        result.evidence = evidence;
        result.externalVerified = evidence?.externalTxVerified === true;
        result.finality = evidence?.settled === true
          ? 'external-settled'
          : evidence?.externalTxVerified === true
            ? 'external-tx-confirmed'
            : 'facilitator-reported';
      }
      return result;
    }
  };
}
