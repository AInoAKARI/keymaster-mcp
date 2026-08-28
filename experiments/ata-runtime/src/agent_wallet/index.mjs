import crypto from 'node:crypto';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(input) {
  const bytes = Buffer.from(input);
  if (bytes.length === 0) return '';
  let value = BigInt(`0x${bytes.toString('hex') || '0'}`);
  let out = '';
  while (value > 0n) {
    const mod = Number(value % 58n);
    out = B58[mod] + out;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = '1' + out;
  }
  return out || '1';
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalBytes(value) {
  return Buffer.from(stable(value));
}

export function sha256(value) {
  return crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');
}

export function createAgentWallet(name = 'AtA Agent') {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' });
  const raw = Buffer.from(jwk.x, 'base64url');
  const address = base58Encode(raw);
  const did = `did:akari:${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)}`;
  const publicKeyB64 = raw.toString('base64url');

  return Object.freeze({
    name,
    did,
    address,
    publicKey: publicKeyB64,
    sign(value) {
      return crypto.sign(null, canonicalBytes(value), privateKey).toString('base64url');
    }
  });
}

export function verifyAgentSignature({ publicKey, value, signature }) {
  const raw = Buffer.from(publicKey, 'base64url');
  if (raw.length !== 32) return false;
  const key = crypto.createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: publicKey },
    format: 'jwk'
  });
  return crypto.verify(null, canonicalBytes(value), key, Buffer.from(signature, 'base64url'));
}

export function didFromPublicKey(publicKey) {
  const raw = Buffer.from(publicKey, 'base64url');
  return `did:akari:${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)}`;
}

export { base58Encode };
