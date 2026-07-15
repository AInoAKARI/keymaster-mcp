import assert from "node:assert/strict";
import { createServer } from "node:http";
import { afterEach, test } from "node:test";

import { createDropServer, renderDropForm } from "../dist/cli.js";

const closers = [];
afterEach(async () => {
  await Promise.allSettled(closers.splice(0).map((close) => close()));
});

async function fakeKeymaster({ grantStatus = 200, writeStatus = 200 } = {}) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push({
      path: request.url,
      authorization: request.headers.authorization,
      writeGrant: request.headers["x-keymaster-write-grant"],
      body,
    });

    if (request.url === "/vault/intake-grant") {
      response.writeHead(grantStatus, { "Content-Type": "application/json" });
      response.end(JSON.stringify(grantStatus === 200 ? { grant: "one-time-test-grant" } : { status: "rejected" }));
      return;
    }
    response.writeHead(writeStatus, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: writeStatus === 200 ? "stored" : "rejected" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  closers.push(() => new Promise((resolve) => server.close(resolve)));
  return { url: `http://127.0.0.1:${address.port}`, requests };
}

test("form uses password input and never embeds a value", () => {
  const html = renderDropForm("npm", "api_key");
  assert.match(html, /type="password"/);
  assert.match(html, /autocomplete="off"/);
  assert.match(html, /data-1p-ignore="true"/);
  assert.match(html, /data-lpignore="true"/);
  assert.doesNotMatch(html, /value=/);
});

test("one-time loopback post uses a purpose grant and self-destructs", async () => {
  const remote = await fakeKeymaster();
  const drop = await createDropServer({
    service: "npm",
    keyName: "api_key",
    keymasterUrl: remote.url,
    token: "test-auth-token",
    ttlMs: 2_000,
  });
  closers.push(drop.close);
  const origin = new URL(drop.url).origin;
  const form = await fetch(drop.url);
  assert.equal(form.status, 200);
  assert.equal(form.headers.get("cache-control"), "no-store, max-age=0");

  const response = await fetch(drop.url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin },
    body: new URLSearchParams({ value: "test-secret-never-returned" }),
  });
  assert.equal(response.status, 200);
  assert.doesNotMatch(await response.text(), /test-secret-never-returned/);
  await drop.completion;
  assert.deepEqual(remote.requests, [
    {
      path: "/vault/intake-grant",
      authorization: "Bearer test-auth-token",
      writeGrant: undefined,
      body: { api_name: "npm", key_name: "api_key", replace: false },
    },
    {
      path: "/vault/api-key",
      authorization: undefined,
      writeGrant: "one-time-test-grant",
      body: { api_name: "npm", key_name: "api_key", value: "test-secret-never-returned", replace: false },
    },
  ]);
  await new Promise((resolve) => setTimeout(resolve, 25));
  await assert.rejects(fetch(drop.url));
});

test("cross-origin submission is rejected without consuming the local post", async () => {
  const remote = await fakeKeymaster();
  const drop = await createDropServer({
    service: "npm",
    keyName: "api_key",
    keymasterUrl: remote.url,
    token: "test-auth-token",
    ttlMs: 2_000,
  });
  closers.push(drop.close);
  const blocked = await fetch(drop.url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://evil.invalid" },
    body: new URLSearchParams({ value: "blocked" }),
  });
  assert.equal(blocked.status, 403);
  assert.equal(remote.requests.length, 1);

  const accepted = await fetch(drop.url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: new URL(drop.url).origin },
    body: new URLSearchParams({ value: "accepted" }),
  });
  assert.equal(accepted.status, 200);
  await drop.completion;
  assert.equal(remote.requests.length, 2);
});

test("missing Keymaster authentication fails before opening a listener", async () => {
  await assert.rejects(
    createDropServer({ service: "npm", keyName: "api_key", keymasterUrl: "https://example.invalid", token: "" }),
    /authentication is unavailable/,
  );
});

test("rejected preflight never opens the localhost form", async () => {
  const remote = await fakeKeymaster({ grantStatus: 409 });
  await assert.rejects(
    createDropServer({ service: "npm", keyName: "api_key", keymasterUrl: remote.url, token: "test-auth-token" }),
    /preflight \(HTTP 409\)/,
  );
  assert.equal(remote.requests.length, 1);
});

test("replace intent is bound into both private intake requests", async () => {
  const remote = await fakeKeymaster();
  const drop = await createDropServer({
    service: "anthropic",
    keyName: "api_key",
    keymasterUrl: remote.url,
    token: "test-auth-token",
    replace: true,
    ttlMs: 2_000,
  });
  closers.push(drop.close);
  const response = await fetch(drop.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: new URL(drop.url).origin,
    },
    body: new URLSearchParams({ value: "replacement-never-returned" }),
  });
  assert.equal(response.status, 200);
  await drop.completion;
  assert.equal(remote.requests[0].body.replace, true);
  assert.equal(remote.requests[1].body.replace, true);
});

test("intake rejects non-loopback URLs before sending authentication", async () => {
  await assert.rejects(
    createDropServer({
      service: "npm",
      keyName: "api_key",
      keymasterUrl: "https://example.invalid",
      token: "test-auth-token",
    }),
    /loopback/,
  );
});

test("path-like service names are rejected before requesting a grant", async () => {
  const remote = await fakeKeymaster();
  await assert.rejects(
    createDropServer({
      service: "../npm",
      keyName: "api_key",
      keymasterUrl: remote.url,
      token: "test-auth-token",
    }),
    /must match/,
  );
  assert.equal(remote.requests.length, 0);
});
