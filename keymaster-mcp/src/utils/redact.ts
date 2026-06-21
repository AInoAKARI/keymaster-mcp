const SECRET_KEY_PATTERN = /api.?key|secret|token|password|auth|credential/i;

export function redactSecret(s: string): string {
  if (!s || s.length <= 8) return "***";
  return "***" + s.slice(-4);
}

export function redactObject<T>(obj: T): T {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(redactObject) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(k) && typeof v === "string") {
      out[k] = redactSecret(v);
    } else {
      out[k] = redactObject(v);
    }
  }
  return out as T;
}

export function safeErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    // スタックトレースを除き、メッセージのみ返す（最大200文字）
    return e.message.slice(0, 200);
  }
  return String(e).slice(0, 200);
}
