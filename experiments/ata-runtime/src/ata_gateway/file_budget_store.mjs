import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
  fsyncSync,
  renameSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';

const VERSION = 1;
const sleepArray = new Int32Array(new SharedArrayBuffer(4));

function sleep(ms) { Atomics.wait(sleepArray, 0, 0, ms); }
function amount(value, label) {
  if (typeof value === 'bigint') return value;
  if (!/^\d+$/.test(String(value))) throw new Error(`${label} must be an unsigned atomic integer`);
  return BigInt(value);
}
function zeroBucket() { return { committed: '0', reserved: '0' }; }
function initialState() { return { version: VERSION, sessions: {}, days: {}, reservations: {} }; }
function parseState(text) {
  const state = JSON.parse(text);
  if (!state || state.version !== VERSION || typeof state.sessions !== 'object' || typeof state.days !== 'object' || typeof state.reservations !== 'object') {
    throw new Error('durable budget state invalid');
  }
  return state;
}
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === 'EPERM'; }
}
function lockIsRecoverable(lockPath, staleLockMs) {
  try {
    const owner = JSON.parse(readFileSync(`${lockPath}/owner.json`, 'utf8'));
    const age = Date.now() - Number(owner.createdAtMs || 0);
    return !pidAlive(Number(owner.pid)) && age >= staleLockMs;
  } catch {
    try { return Date.now() - statSync(lockPath).mtimeMs >= staleLockMs; } catch { return false; }
  }
}
function acquireLock(lockPath, { lockTimeoutMs, staleLockMs, pollMs }) {
  const deadline = Date.now() + lockTimeoutMs;
  while (true) {
    try {
      mkdirSync(lockPath, { mode: 0o700 });
      writeFileSync(`${lockPath}/owner.json`, JSON.stringify({ pid: process.pid, createdAtMs: Date.now() }), { mode: 0o600 });
      return;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      if (lockIsRecoverable(lockPath, staleLockMs)) {
        try { rmSync(lockPath, { recursive: true, force: true }); continue; } catch {}
      }
      if (Date.now() >= deadline) throw new Error('durable budget store busy');
      sleep(pollMs);
    }
  }
}
function writeState(filePath, state) {
  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temp = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const fd = openSync(temp, 'wx', 0o600);
  try {
    writeSync(fd, JSON.stringify(state));
    fsyncSync(fd);
  } finally { closeSync(fd); }
  renameSync(temp, filePath);
}
function readState(filePath) {
  if (!existsSync(filePath)) return initialState();
  try { return parseState(readFileSync(filePath, 'utf8')); }
  catch (error) { throw new Error(`durable budget state unreadable; refusing spend: ${error instanceof Error ? error.message : String(error)}`); }
}
function bucket(map, key) { return map[key] ?? (map[key] = zeroBucket()); }
function add(bucketValue, field, delta) { bucketValue[field] = (BigInt(bucketValue[field]) + delta).toString(); }

export function createFileBudgetStore({ filePath, sessionId, lockTimeoutMs = 5000, staleLockMs = 30000, pollMs = 10 } = {}) {
  if (!filePath) throw new Error('filePath is required');
  if (typeof sessionId !== 'string' || sessionId.length < 1) throw new Error('sessionId is required');
  const statePath = resolve(filePath);
  const lockPath = `${statePath}.lock`;

  function transact(fn) {
    acquireLock(lockPath, { lockTimeoutMs, staleLockMs, pollMs });
    try {
      const state = readState(statePath);
      const result = fn(state);
      if (result?.write !== false) writeState(statePath, state);
      return result?.value;
    } finally { rmSync(lockPath, { recursive: true, force: true }); }
  }

  return Object.freeze({
    durability: 'durable',
    durabilityScope: 'host-filesystem',
    statePath,
    sessionId,
    reserve({ amount: rawAmount, dayKey, maxSession, maxDay }) {
      const n = amount(rawAmount, 'amount');
      return transact((state) => {
        const session = bucket(state.sessions, sessionId);
        const day = bucket(state.days, dayKey);
        const sessionNext = BigInt(session.committed) + BigInt(session.reserved) + n;
        if (maxSession != null && sessionNext > amount(maxSession, 'maxSession')) throw new Error('x402 session budget exceeded');
        const dayNext = BigInt(day.committed) + BigInt(day.reserved) + n;
        if (maxDay != null && dayNext > amount(maxDay, 'maxDay')) throw new Error('x402 daily budget exceeded');
        const id = randomUUID();
        state.reservations[id] = { sessionId, dayKey, amount: n.toString(), state: 'reserved', createdAt: new Date().toISOString() };
        add(session, 'reserved', n);
        add(day, 'reserved', n);
        return { value: id };
      });
    },
    commit(id) {
      return transact((state) => {
        const r = state.reservations[id];
        if (!r || r.state !== 'reserved') return { value: false, write: false };
        const n = BigInt(r.amount);
        const session = bucket(state.sessions, r.sessionId);
        const day = bucket(state.days, r.dayKey);
        add(session, 'reserved', -n); add(session, 'committed', n);
        add(day, 'reserved', -n); add(day, 'committed', n);
        r.state = 'committed'; r.resolvedAt = new Date().toISOString();
        return { value: true };
      });
    },
    cancel(id) {
      return transact((state) => {
        const r = state.reservations[id];
        if (!r || r.state !== 'reserved') return { value: false, write: false };
        const n = BigInt(r.amount);
        const session = bucket(state.sessions, r.sessionId);
        const day = bucket(state.days, r.dayKey);
        add(session, 'reserved', -n); add(day, 'reserved', -n);
        r.state = 'cancelled'; r.resolvedAt = new Date().toISOString();
        return { value: true };
      });
    },
    snapshot(dayKey) {
      return transact((state) => {
        const session = state.sessions[sessionId] ?? zeroBucket();
        const day = state.days[dayKey] ?? zeroBucket();
        return { value: Object.freeze({
          durability: 'durable',
          durabilityScope: 'host-filesystem',
          sessionId,
          sessionCommittedAtomic: session.committed,
          sessionReservedAtomic: session.reserved,
          dayCommittedAtomic: day.committed,
          dayReservedAtomic: day.reserved,
          unresolvedReservations: Object.values(state.reservations).filter((r) => r.state === 'reserved').length
        }), write: false };
      });
    }
  });
}
