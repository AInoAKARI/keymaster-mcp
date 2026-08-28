import http from 'node:http';
import { sha256 } from '../agent_wallet/index.mjs';
import { verifyChannelOffer, verifyVoucher } from './channel.mjs';

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.reduce((n, chunk) => n + chunk.length, 0) > 1_000_000) throw new Error('request too large');
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function createAtaGateway({ identity, settlement }) {
  const channels = new Map();

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/.well-known/ata-agent.json') {
        return json(res, 200, {
          protocol: 'ata/0.2',
          did: identity.did,
          address: identity.address,
          publicKey: identity.publicKey,
          payment: { asset: 'JPY_MICROS', defaultIncrementJpyMicros: '10000', settlement: ['notary', 'x402-v2'] },
          endpoints: { handshake: '/v1/handshake', relay: '/v1/relay' }
        });
      }

      if (req.method === 'POST' && req.url === '/v1/handshake') {
        const body = await readJson(req);
        verifyChannelOffer(body.channel);
        if (body.channel.payee.did !== identity.did || body.channel.payee.publicKey !== identity.publicKey) throw new Error('gateway is not channel payee');
        channels.set(body.channel.channelId, { channel: body.channel, lastVoucher: null });
        return json(res, 200, { accepted: true, channelId: body.channel.channelId, payeeDid: identity.did });
      }

      if (req.method === 'POST' && req.url === '/v1/relay') {
        const body = await readJson(req);
        const entry = channels.get(body.channelId);
        if (!entry) throw new Error('unknown channel');
        const payloadHash = sha256(body.payload);
        if (body.payloadHash && body.payloadHash !== payloadHash) throw new Error('payload hash mismatch');
        const verified = verifyVoucher({ channel: entry.channel, voucher: body.voucher, previousVoucher: entry.lastVoucher });
        const receipt = await settlement.settle({
          channel: entry.channel,
          voucher: body.voucher,
          deltaJpyMicros: verified.deltaJpyMicros,
          payloadHash
        });
        entry.lastVoucher = body.voucher;
        return json(res, 200, {
          accepted: true,
          channelId: entry.channel.channelId,
          provider: body.provider ?? 'unknown',
          model: body.model ?? 'unknown',
          payloadHash,
          voucherHash: verified.voucherHash,
          deltaJpyMicros: verified.deltaJpyMicros,
          cumulativeJpyMicros: body.voucher.cumulativeJpyMicros,
          receipt
        });
      }

      return json(res, 404, { error: 'not found' });
    } catch (error) {
      return json(res, 400, { error: error instanceof Error ? error.message : 'bad request' });
    }
  });

  return {
    listen(port = 0, host = '127.0.0.1') {
      return new Promise((resolve) => server.listen(port, host, () => resolve(server.address())));
    },
    close() {
      return new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
  };
}
