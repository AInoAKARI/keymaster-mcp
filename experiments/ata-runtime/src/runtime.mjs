import http from 'node:http';
import crypto from 'node:crypto';

const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const fromB64 = (s) => Buffer.from(s, 'base64url');
const hash = (value) => crypto.createHash('sha256').update(stable(value)).digest('hex');

export function createIdentity(name) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicDer = publicKey.export({ type: 'spki', format: 'der' });
  const id = `did:akari:${crypto.createHash('sha256').update(publicDer).digest('hex').slice(0, 32)}`;
  return { name, id, publicKey, privateKey, publicKeyB64: b64(publicDer) };
}

export function createCard(identity, endpoint, capabilities = []) {
  return {
    protocolVersion: 'ata/0.1',
    id: identity.id,
    name: identity.name,
    endpoint,
    publicKey: identity.publicKeyB64,
    transports: ['https+a2a'],
    capabilities,
    payments: [{ protocol: 'x402', version: 2, networks: ['eip155:84532', 'eip155:8453'] }]
  };
}

export function signEnvelope(identity, type, body) {
  const unsigned = {
    version: 'ata/0.1',
    type,
    sender: identity.id,
    publicKey: identity.publicKeyB64,
    nonce: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    body
  };
  const signature = crypto.sign(null, Buffer.from(stable(unsigned)), identity.privateKey);
  return { ...unsigned, signature: b64(signature) };
}

export function verifyEnvelope(envelope) {
  const { signature, ...unsigned } = envelope;
  const publicDer = fromB64(envelope.publicKey);
  const expectedId = `did:akari:${crypto.createHash('sha256').update(publicDer).digest('hex').slice(0, 32)}`;
  if (expectedId !== envelope.sender) throw new Error('sender/publicKey mismatch');
  const publicKey = crypto.createPublicKey({ key: publicDer, type: 'spki', format: 'der' });
  const ok = crypto.verify(null, Buffer.from(stable(unsigned)), publicKey, fromB64(signature));
  if (!ok) throw new Error('invalid signature');
  return true;
}

export function createDemoSettlement() {
  return {
    async authorize(requirement) {
      return {
        rail: 'demo-settlement',
        protocolTarget: 'x402-v2',
        network: requirement.network,
        asset: requirement.asset,
        amount: requirement.amount,
        receiptId: `demo:${crypto.randomUUID()}`,
        settledAt: new Date().toISOString()
      };
    }
  };
}

export function createAgentServer({ identity, card, price = '0.001', skill = 'echo' }) {
  const quotes = new Map();

  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/.well-known/agent-card.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(card));
    }

    if (req.method !== 'POST' || req.url !== '/a2a') {
      res.writeHead(404);
      return res.end();
    }

    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const message = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      verifyEnvelope(message);

      if (message.type === 'task.advertise') {
        if (message.body.skill !== skill) throw new Error('unsupported skill');
        const quoteId = crypto.randomUUID();
        const terms = {
          taskId: message.body.taskId,
          quoteId,
          skill,
          price: { asset: 'USDC', amount: price, network: 'eip155:84532' },
          paymentRequirement: {
            protocol: 'x402',
            version: 2,
            scheme: 'exact',
            network: 'eip155:84532',
            asset: 'USDC',
            amount: price
          }
        };
        quotes.set(quoteId, terms);
        const reply = signEnvelope(identity, 'task.quote', { ...terms, termsHash: hash(terms) });
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(reply));
      }

      if (message.type === 'task.award') {
        const terms = quotes.get(message.body.quoteId);
        if (!terms) throw new Error('unknown quote');
        if (message.body.termsHash !== hash(terms)) throw new Error('terms changed');
        const proof = message.body.paymentProof;
        if (!proof || proof.amount !== terms.price.amount || proof.asset !== terms.price.asset) {
          throw new Error('payment proof mismatch');
        }
        const output = { echo: message.body.input };
        const receipt = {
          taskId: terms.taskId,
          quoteId: terms.quoteId,
          settlement: proof,
          output,
          outputHash: hash(output),
          completedAt: new Date().toISOString()
        };
        quotes.delete(message.body.quoteId);
        const reply = signEnvelope(identity, 'task.receipt', receipt);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(reply));
      }

      throw new Error('unsupported message type');
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });

  return {
    listen(port, host = '127.0.0.1') {
      return new Promise((resolve) => server.listen(port, host, resolve));
    },
    close() {
      return new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
  };
}

export async function postEnvelope(endpoint, envelope) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  verifyEnvelope(payload);
  return payload;
}

export { hash };
