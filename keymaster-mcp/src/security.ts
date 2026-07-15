/**
 * Errors from network clients can echo request URLs, headers, or credentials.
 * Never expose the original error to MCP clients or stderr.
 */
export function publicRequestError(_error?: unknown): string {
  return "Request failed";
}

export function fatalErrorLine(_error?: unknown): string {
  return "Fatal: keymaster-mcp terminated\n";
}
