import readline from 'node:readline';

const VERSION = '2026-07-28';

function response(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function failure(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export function createAtaMcpHandler({ notion, openChannel, relay }) {
  const tools = [
    {
      name: 'notion_search',
      description: 'Search an approved Notion-derived local index. This tool does not hide side effects; payment, when used, is returned explicitly as an AtA receipt.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 20 } }, required: ['query'], additionalProperties: false }
    },
    {
      name: 'ata_open_channel',
      description: 'Open an explicit signed AtA micropayment channel with the configured peer.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }
    },
    {
      name: 'ata_relay',
      description: 'Relay one AI payload with an explicit ¥0.01-class signed voucher and return the notarized settlement receipt.',
      inputSchema: { type: 'object', properties: { provider: { type: 'string' }, model: { type: 'string' }, payload: {} }, required: ['payload'], additionalProperties: false }
    }
  ];

  return async function handle(message) {
    const id = message.id ?? null;
    try {
      if (message.method === 'server/discover') {
        return response(id, {
          protocolVersion: VERSION,
          serverInfo: { name: 'ai-akari-ata-mcp', version: '0.2.0' },
          capabilities: { tools: {} },
          extensions: { 'io.ai-akari.ata': { version: '0.2', paymentSideEffects: 'explicit' } }
        });
      }
      if (message.method === 'tools/list') return response(id, { tools });
      if (message.method === 'tools/call') {
        const name = message.params?.name;
        const args = message.params?.arguments ?? {};
        if (name === 'notion_search') {
          const matches = await notion.search(args.query, args.limit);
          return response(id, { content: [{ type: 'text', text: JSON.stringify({ matches, payment: null }) }] });
        }
        if (name === 'ata_open_channel') {
          const result = await openChannel();
          return response(id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
        }
        if (name === 'ata_relay') {
          const result = await relay(args);
          return response(id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
        }
        return failure(id, -32602, 'unknown tool');
      }
      return failure(id, -32601, 'method not found');
    } catch (error) {
      return failure(id, -32000, error instanceof Error ? error.message : 'server error');
    }
  };
}

export function runStdioServer(handler, input = process.stdin, output = process.stdout) {
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return output.write(`${JSON.stringify(failure(null, -32700, 'parse error'))}\n`); }
    const result = await handler(msg);
    if (msg.id !== undefined) output.write(`${JSON.stringify(result)}\n`);
  });
  return rl;
}
