import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileBudgetStore } from '../src/ata_gateway/file_budget_store.mjs';

test('persists committed and reserved counters across store instances', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ata-budget-'));
  const filePath = join(dir, 'budget.json');
  const a = createFileBudgetStore({ filePath, sessionId: 's1' });
  const id = a.reserve({ amount: 1000n, dayKey: '2026-08-29', maxSession: 2000n, maxDay: 3000n });
  const b = createFileBudgetStore({ filePath, sessionId: 's1' });
  assert.equal(b.snapshot('2026-08-29').sessionReservedAtomic, '1000');
  assert.equal(b.commit(id), true);
  const c = createFileBudgetStore({ filePath, sessionId: 's1' });
  assert.equal(c.snapshot('2026-08-29').sessionCommittedAtomic, '1000');
});

test('two store instances cannot oversubscribe the same session budget', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ata-budget-'));
  const filePath = join(dir, 'budget.json');
  const a = createFileBudgetStore({ filePath, sessionId: 's1' });
  const b = createFileBudgetStore({ filePath, sessionId: 's1' });
  a.reserve({ amount: 1000n, dayKey: '2026-08-29', maxSession: 1000n, maxDay: 5000n });
  assert.throws(() => b.reserve({ amount: 1n, dayKey: '2026-08-29', maxSession: 1000n, maxDay: 5000n }), /session budget exceeded/);
});

test('unresolved reservation survives restart and fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ata-budget-'));
  const filePath = join(dir, 'budget.json');
  createFileBudgetStore({ filePath, sessionId: 's1' }).reserve({ amount: 800n, dayKey: '2026-08-29', maxSession: 1000n, maxDay: 1000n });
  const restarted = createFileBudgetStore({ filePath, sessionId: 's1' });
  assert.equal(restarted.snapshot('2026-08-29').unresolvedReservations, 1);
  assert.throws(() => restarted.reserve({ amount: 201n, dayKey: '2026-08-29', maxSession: 1000n, maxDay: 1000n }), /session budget exceeded/);
});

test('corrupt durable state refuses new spend', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ata-budget-'));
  const filePath = join(dir, 'budget.json');
  writeFileSync(filePath, '{bad');
  const store = createFileBudgetStore({ filePath, sessionId: 's1' });
  assert.throws(() => store.reserve({ amount: 1n, dayKey: '2026-08-29', maxSession: 10n, maxDay: 10n }), /refusing spend/);
});
