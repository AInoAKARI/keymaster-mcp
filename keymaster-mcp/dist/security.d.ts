/**
 * Errors from network clients can echo request URLs, headers, or credentials.
 * Never expose the original error to MCP clients or stderr.
 */
export declare function publicRequestError(_error?: unknown): string;
export declare function fatalErrorLine(_error?: unknown): string;
