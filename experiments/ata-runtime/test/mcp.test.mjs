import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createNotionIndexAdapter } from '../src/ata_mcp/notion-adapter.mjs';
import { createAtaMcpHandler } from '../src/ata_mcp/server.mjs';

test('MCP discover/list/search exposes AtA explicitly', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ata-notion-'));
  const indexPath = path.join(dir, 'index.json');
  await fs.writeFile(indexPath, JSON.stringify([{ id: '1', title: 'AtA', text: 'Agent to Agent micropayment', url: 'local://1' }]));
  const notion = createNotionIndexAdapter({ indexPath });
  const handler = createAtaMcpHandler({ notion, openChannel: async () => ({ channelId: 'c1' }), relay: async () => ({ receipt: 'r1' }) });

  const discover = await handler({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: {} });
  assert.equal(discover.result.protocolVersion, '2026-07-28');
  assert.equal(discover.result.extensions['io.ai-akari.ata'].paymentSideEffects, 'explicit');

  const list = await handler({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  assert.deepEqual(list.result.tools.map((tool) => tool.name), ['notion_search', 'ata_open_channel', 'ata_relay']);

  const search = await handler({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'notion_search', arguments: { query: 'micropayment' } } });
  const body = JSON.parse(search.result.content[0].text);
  assert.equal(body.matches[0].title, 'AtA');
  assert.equal(body.payment, null);
});
