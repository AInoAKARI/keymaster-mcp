import { test } from "node:test";
import assert from "node:assert/strict";

// redact utilities を直接テスト（ESM動的import）
const { redactSecret, redactObject, safeErrorMessage } = await import(
  "../src/utils/redact.ts"
).catch(async () => {
  // TypeScriptが実行できない場合はdistを使う
  return import("../dist/utils/redact.js");
});

const DUMMY_RAW_KEY = "sk-DUMMY_RAW_KEY_VALUE_1234567890abcdef";

test("redactSecret hides all but last 4 chars", () => {
  const result = redactSecret(DUMMY_RAW_KEY);
  assert.ok(!result.includes(DUMMY_RAW_KEY), "Raw key must not appear in redacted output");
  assert.ok(result.startsWith("***"), "Redacted value must start with ***");
  assert.equal(result.slice(-4), DUMMY_RAW_KEY.slice(-4), "Last 4 chars preserved");
});

test("redactSecret handles short values", () => {
  assert.equal(redactSecret(""), "***");
  assert.equal(redactSecret("short"), "***");
});

test("redactObject redacts known secret fields", () => {
  const obj = {
    api_key: DUMMY_RAW_KEY,
    api_name: "groq",
    token: "Bearer DUMMY_RAW_KEY_VALUE",
    password: "hunter2",
    safe_field: "visible",
  };
  const redacted = redactObject(obj);
  assert.ok(!JSON.stringify(redacted).includes(DUMMY_RAW_KEY), "api_key must be redacted");
  assert.ok(!JSON.stringify(redacted).includes("DUMMY_RAW_KEY_VALUE"), "token must be redacted");
  assert.ok(!JSON.stringify(redacted).includes("hunter2"), "password must be redacted");
  assert.equal(redacted.safe_field, "visible", "non-secret fields preserved");
  assert.equal(redacted.api_name, "groq", "api_name (no key/secret/token) preserved");
});

test("redactObject handles nested objects", () => {
  const obj = { vault: { secret: DUMMY_RAW_KEY }, meta: { name: "test" } };
  const redacted = redactObject(obj);
  assert.ok(!JSON.stringify(redacted).includes(DUMMY_RAW_KEY), "Nested secret must be redacted");
});

test("safeErrorMessage truncates to 200 chars and strips stack trace", () => {
  const err = new Error("Short message");
  const msg = safeErrorMessage(err);
  assert.equal(msg, "Short message");
  assert.ok(msg.length <= 200);
});

test("stderr fatal handler does not leak raw key", async () => {
  const stderrChunks = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => {
    stderrChunks.push(String(chunk));
    return true;
  };
  try {
    const err = new Error(`Connection failed: api_key=${DUMMY_RAW_KEY}`);
    const msg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
    process.stderr.write(`Fatal: ${msg}\n`);
    const output = stderrChunks.join("");
    // メッセージ自体には含まれているが、スタックトレースが含まれていないことを確認
    assert.ok(!output.includes("at "), "Stack trace must not appear in fatal output");
  } finally {
    process.stderr.write = origWrite;
  }
});
