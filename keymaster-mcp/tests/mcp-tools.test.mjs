import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { test } from "node:test";

async function startFakeKeymaster(value) {
  let requestCount = 0;
  const server = createServer((request, response) => {
    requestCount += 1;
    assert.equal(request.headers.authorization, "Bearer test-runtime-token");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ api_key: value }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    requestCount: () => requestCount,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function writeMessage(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

test("MCP exposes status only and never returns the fetched credential", async () => {
  const marker = "credential-marker-must-not-return";
  const keymaster = await startFakeKeymaster(marker);
  const environment = {
    ...process.env,
    USER_KEYMASTER_URL: keymaster.url,
    USER_KEYMASTER_TOKEN: "test-runtime-token",
  };
  delete environment.KEYMASTER_URL;
  delete environment.KEYMASTER_TOKEN;
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: process.cwd(),
    env: environment,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const messages = [];
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) messages.push(JSON.parse(line));
    }
  });

  try {
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "security-test", version: "1.0.0" },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "secret_status", arguments: { service: "../openai", key_name: "api_key" } },
    });
    writeMessage(child, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    writeMessage(child, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "secret_status", arguments: { service: "openai", key_name: "api_key" } },
    });

    const deadline = Date.now() + 5_000;
    while (!(messages.some((message) => message.id === 3) && messages.some((message) => message.id === 4)) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const listed = messages.find((message) => message.id === 2);
    const status = messages.find((message) => message.id === 3);
    const rejected = messages.find((message) => message.id === 4);
    assert.ok(listed);
    assert.ok(status);
    assert.ok(rejected);
    const names = listed.result.tools.map((tool) => tool.name);
    assert.ok(names.includes("secret_status"));
    assert.ok(!names.includes("get_secret"));
    assert.doesNotMatch(JSON.stringify(status), new RegExp(marker));
    assert.match(JSON.stringify(status), /available/);
    assert.match(JSON.stringify(rejected), /Invalid service or key name/);
    assert.equal(keymaster.requestCount(), 1);
  } finally {
    child.kill();
    await keymaster.close();
  }
});
