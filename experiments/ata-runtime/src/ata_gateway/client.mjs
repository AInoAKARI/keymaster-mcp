import { sha256 } from '../agent_wallet/index.mjs';

async function post(baseUrl, path, body, fetchImpl = fetch) {
  const response = await fetchImpl(new URL(path, baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

export function createGatewayClient({ baseUrl, fetchImpl = fetch }) {
  return {
    handshake(channel) {
      return post(baseUrl, '/v1/handshake', { channel }, fetchImpl);
    },
    relay({ channelId, voucher, provider, model, payload }) {
      return post(baseUrl, '/v1/relay', { channelId, voucher, provider, model, payload, payloadHash: sha256(payload) }, fetchImpl);
    }
  };
}
