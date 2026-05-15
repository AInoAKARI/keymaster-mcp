"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactSecret = redactSecret;
exports.redactObject = redactObject;
exports.safeErrorMessage = safeErrorMessage;
const SECRET_KEY_PATTERN = /api.?key|secret|token|password|auth|credential/i;
function redactSecret(s) {
    if (!s || s.length <= 8)
        return "***";
    return "***" + s.slice(-4);
}
function redactObject(obj) {
    if (typeof obj !== "object" || obj === null)
        return obj;
    if (Array.isArray(obj))
        return obj.map(redactObject);
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (SECRET_KEY_PATTERN.test(k) && typeof v === "string") {
            out[k] = redactSecret(v);
        }
        else {
            out[k] = redactObject(v);
        }
    }
    return out;
}
function safeErrorMessage(e) {
    if (e instanceof Error) {
        // スタックトレースを除き、メッセージのみ返す（最大200文字）
        return e.message.slice(0, 200);
    }
    return String(e).slice(0, 200);
}
//# sourceMappingURL=redact.js.map