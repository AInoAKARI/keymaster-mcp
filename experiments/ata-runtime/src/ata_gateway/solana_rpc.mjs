export const DEFAULT_SOLANA_DEVNET_RPC = 'https://api.devnet.solana.com';

export function createSolanaRpcClient({ endpoint = DEFAULT_SOLANA_DEVNET_RPC, fetchImpl = fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation required');
  const rpcEndpoint = new URL(endpoint);
  let id = 0;

  async function call(method, params = []) {
    let response;
    try {
      response = await fetchImpl(rpcEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params })
      });
    } catch (error) {
      throw new Error(`solana rpc unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) throw new Error(`solana rpc HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(`solana rpc ${method} failed: ${body.error.message || JSON.stringify(body.error)}`);
    return body.result;
  }

  return Object.freeze({
    endpoint: rpcEndpoint.toString(),
    getSlot(commitment = 'confirmed') { return call('getSlot', [{ commitment }]); },
    async getLatestBlockhash(commitment = 'confirmed') {
      const result = await call('getLatestBlockhash', [{ commitment }]);
      return result?.value ?? result;
    },
    async getSignatureStatus(signature) {
      const result = await call('getSignatureStatuses', [[signature], { searchTransactionHistory: true }]);
      return result?.value?.[0] ?? null;
    },
    async getTokenAccountBalance(tokenAccount, commitment = 'confirmed') {
      const result = await call('getTokenAccountBalance', [tokenAccount, { commitment }]);
      const amount = result?.value?.amount;
      if (!/^\d+$/.test(String(amount))) throw new Error('token balance response missing atomic amount');
      return BigInt(amount);
    }
  });
}
