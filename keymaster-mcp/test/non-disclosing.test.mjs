import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { test } from "node:test";

function writeMessage(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

async function fakeKeymaster(secret) {
  let requestCount = 0;
  const server = createServer((request, response) => {
    requestCount += 1;
    assert.equal(request.headers.authorization, "Bearer test-runtime-token");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ api_key: secret }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    requestCount: () => requestCount,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function waitFor(messages, ids, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (ids.every((id) => messages.some((message) => message.id === id))) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for MCP responses: ${ids.join(",")}`);
}

test("secret-like CLI arguments are rejected without echoing values", () => {
  const marker = "cli-secret-marker-must-not-appear";
  for (const args of [["--token", marker], [`--token=${marker}`]]) {
    const result = spawnSync(process.execPath, ["dist/index.js", ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(marker));
    assert.match(result.stderr, /Secret CLI arguments are not supported/);
  }
});

test("MCP exposes status only and rejects path-like credential names", async () => {
  const marker = "credential-marker-must-never-return";
  const keymaster = await fakeKeymaster(marker);
  const environment = {
    ...process.env,
    USER_KEYMASTER_URL: keymaster.url,
    USER_KEYMASTER_TOKEN: "test-runtime-token",
  };
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: process.cwd(),
    env: environment,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const messages = [];
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    for (;;) {
      const newline = stdout.indexOf("\n");
      if (newline < 0) break;
      const line = stdout.slice(0, newline).trim();
      stdout = stdout.slice(newline + 1);
      if (line) messages.push(JSON.parse(line));
    }
  });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  try {
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "keymaster-security-test", version: "1.0.0" },
      },
    });
    writeMessage(child, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    writeMessage(child, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "secret_status", arguments: { service: "openai", key_name: "api_key" } },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "secret_status", arguments: { service: "../openai", key_name: "api_key" } },
    });

    await waitFor(messages, [2, 3, 4]);
    const listed = messages.find((message) => message.id === 2);
    const status = messages.find((message) => message.id === 3);
    const rejected = messages.find((message) => message.id === 4);
    const toolNames = listed.result.tools.map((tool) => tool.name);

    assert.ok(toolNames.includes("secret_status"));
    assert.ok(!toolNames.includes("get_secret"));
    assert.match(JSON.stringify(status), /available/);
    assert.doesNotMatch(JSON.stringify(status), new RegExp(marker));
    assert.match(JSON.stringify(rejected), /Invalid service or key name/);
    assert.equal(keymaster.requestCount(), 1);
    assert.doesNotMatch(stderr, new RegExp(marker));
  } finally {
    child.kill();
    await keymaster.close();
  }
});
