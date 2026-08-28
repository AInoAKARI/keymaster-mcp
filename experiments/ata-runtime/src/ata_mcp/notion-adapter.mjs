import fs from 'node:fs/promises';

export function createNotionIndexAdapter({ indexPath }) {
  return {
    async search(query, limit = 5) {
      const raw = await fs.readFile(indexPath, 'utf8');
      const rows = JSON.parse(raw);
      const needle = String(query ?? '').toLowerCase();
      return rows
        .filter((row) => JSON.stringify(row).toLowerCase().includes(needle))
        .slice(0, Math.max(1, Math.min(Number(limit) || 5, 20)))
        .map(({ id, title, text, url }) => ({ id, title, text, url }));
    }
  };
}
