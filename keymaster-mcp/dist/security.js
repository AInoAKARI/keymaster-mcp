"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRequestError = publicRequestError;
exports.fatalErrorLine = fatalErrorLine;
/**
 * Errors from network clients can echo request URLs, headers, or credentials.
 * Never expose the original error to MCP clients or stderr.
 */
function publicRequestError(_error) {
    return "Request failed";
}
function fatalErrorLine(_error) {
    return "Fatal: keymaster-mcp terminated\n";
}
//# sourceMappingURL=security.js.map