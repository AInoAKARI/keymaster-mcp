import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentWallet, verifyAgentSignature } from '../src/agent_wallet/index.mjs';

test('agent wallet exposes public Solana-compatible address and signs without exporting private key', () => {
  const wallet = createAgentWallet('test');
  assert.match(wallet.address, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  assert.equal('privateKey' in wallet, false);
  const value = { hello: 'world' };
  const signature = wallet.sign(value);
  assert.equal(verifyAgentSignature({ publicKey: wallet.publicKey, value, signature }), true);
  assert.equal(verifyAgentSignature({ publicKey: wallet.publicKey, value: { hello: 'tampered' }, signature }), false);
});
