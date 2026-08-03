import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const syntheticCredential = "demo-value-never-returned";
const hostToken = "demo-runtime-token";
const responses = [];
let stdoutBuffer = "";

const proxy = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  if (request.headers.authorization !== `Bearer ${hostToken}`) {
    response.writeHead(401).end();
    return;
  }
  if (
    requestUrl.pathname !== "/vault/api-key" ||
    requestUrl.searchParams.get("api_name") !== "openai" ||
    requestUrl.searchParams.get("key_name") !== "api_key"
  ) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ api_key: syntheticCredential }));
});

await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
const address = proxy.address();
assert(address && typeof address === "object");

const child = spawn(process.execPath, ["dist/index.js"], {
  cwd: new URL("../../keymaster-mcp/", import.meta.url),
  env: {
    ...process.env,
    USER_KEYMASTER_URL: `http://127.0.0.1:${address.port}`,
    USER_KEYMASTER_TOKEN: hostToken,
  },
  stdio: ["pipe", "pipe", "pipe"],
});

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk;
  for (;;) {
    const newline = stdoutBuffer.indexOf("\n");
    if (newline < 0) break;
    const line = stdoutBuffer.slice(0, newline).trim();
    stdoutBuffer = stdoutBuffer.slice(newline + 1);
    if (line) responses.push(JSON.parse(line));
  }
});

let stderr = "";
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => { stderr += chunk; });

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

async function waitFor(ids, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (ids.every((id) => responses.some((response) => response.id === id))) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for MCP responses: ${ids.join(", ")}`);
}

try {
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "keymaster-local-demo", version: "1.0.0" },
    },
  });
  send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "secret_status",
      arguments: { service: "openai", key_name: "api_key" },
    },
  });

  await waitFor([1, 2, 3]);

  const toolList = responses.find((response) => response.id === 2)?.result?.tools ?? [];
  const statusResult = responses.find((response) => response.id === 3);
  const visibleTranscript = JSON.stringify({ toolList, statusResult });

  assert(toolList.some((tool) => tool.name === "secret_status"));
  assert(!toolList.some((tool) => tool.name === "get_secret"));
  assert.match(visibleTranscript, /available/);
  assert.doesNotMatch(visibleTranscript, new RegExp(syntheticCredential));
  assert.doesNotMatch(stderr, new RegExp(syntheticCredential));

  console.log("Keymaster local boundary demo: PASS");
  console.log("- secret_status returned: available");
  console.log("- get_secret exposed: no");
  console.log("- synthetic credential crossed MCP output: no");
  console.log("- real credentials used: none");
} finally {
  child.kill();
  await new Promise((resolve) => proxy.close(resolve));
}
