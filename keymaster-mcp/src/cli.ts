#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createConnection, type AddressInfo } from "node:net";
import { environmentWithoutKeymasterCredentials, resolveIntakeToken } from "./config.js";

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_BODY_BYTES = 65_536;
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/;
const FLY_APP = "akari-keymaster";
const FLY_INTAKE_PORT = 8001;

export interface DropConfig {
  service: string;
  keyName: string;
  keymasterUrl: string;
  token: string;
  replace?: boolean;
  ttlMs?: number;
}

interface DropServer {
  url: string;
  completion: Promise<void>;
  close: () => Promise<void>;
}

function validateName(value: string, label: string): string {
  if (!NAME_PATTERN.test(value)) {
    throw new Error(`${label} must match ${NAME_PATTERN}`);
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderDropForm(service: string, keyName: string): string {
  const label = `${escapeHtml(service)} / ${escapeHtml(keyName)}`;
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>AIﾉアカリ☆ 鍵ポスト</title></head>
<body><main><h1>AIﾉアカリ☆ 鍵ポスト</h1><p>${label}</p>
<form method="post" autocomplete="off">
<label>秘密値 <input type="password" name="value" required autofocus autocomplete="off" data-1p-ignore="true" data-lpignore="true" spellcheck="false"></label>
<button type="submit">Vaultへ一度だけ投函</button>
</form><p>値はlocalhostから直接Keymasterへ送られ、このページは送信後に自壊します。</p></main></body></html>`;
}

function secureHeaders(response: ServerResponse, contentType: string): void {
  response.setHeader("Content-Type", contentType);
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function reply(response: ServerResponse, status: number, body: string): void {
  secureHeaders(response, "text/plain; charset=utf-8");
  response.writeHead(status);
  response.end(body);
}

async function readFormValue(request: IncomingMessage): Promise<string> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.startsWith("application/x-www-form-urlencoded")) {
    throw new Error("Unsupported content type");
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new Error("Payload too large");
    chunks.push(buffer);
  }
  const value = new URLSearchParams(Buffer.concat(chunks).toString("utf8")).get("value") ?? "";
  if (!value || value.length > MAX_BODY_BYTES) throw new Error("Secret value is required");
  return value;
}

function validatedKeymasterBaseUrl(value: string): URL {
  const baseUrl = new URL(value);
  const isLoopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(baseUrl.hostname);
  if (!isLoopback || !["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("Intake URL must be a loopback HTTP(S) address");
  }
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error("Intake URL must not contain credentials, query parameters, or a fragment");
  }
  return baseUrl;
}

async function requestWriteGrant(config: DropConfig): Promise<string> {
  const endpoint = new URL("/vault/intake-grant", validatedKeymasterBaseUrl(config.keymasterUrl)).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_name: config.service,
      key_name: config.keyName,
      replace: config.replace ?? false,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Keymaster rejected intake preflight (HTTP ${response.status})`);
  const body = (await response.json()) as Record<string, unknown>;
  if (typeof body.grant !== "string" || !body.grant) throw new Error("Keymaster returned no intake grant");
  return body.grant;
}

async function storeSecret(config: DropConfig, writeGrant: string, value: string): Promise<void> {
  const endpoint = new URL("/vault/api-key", validatedKeymasterBaseUrl(config.keymasterUrl)).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-Keymaster-Write-Grant": writeGrant,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_name: config.service,
      key_name: config.keyName,
      value,
      replace: config.replace ?? false,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Keymaster rejected the write (HTTP ${response.status})`);
}

export async function createDropServer(config: DropConfig): Promise<DropServer> {
  validateName(config.service, "service");
  validateName(config.keyName, "key name");
  if (!config.token) throw new Error("Keymaster authentication is unavailable");
  const writeGrant = await requestWriteGrant(config);
  const nonce = randomBytes(24).toString("base64url");
  const path = `/${nonce}`;
  let settled = false;
  let resolveCompletion!: () => void;
  let rejectCompletion!: (error: Error) => void;
  const completion = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const server = createServer(async (request, response) => {
    const address = server.address() as AddressInfo | null;
    const expectedOrigin = address ? `http://127.0.0.1:${address.port}` : "";
    const expectedHost = address ? `127.0.0.1:${address.port}` : "";
    const requestPath = new URL(request.url ?? "/", expectedOrigin || "http://127.0.0.1").pathname;
    if (requestPath !== path) return reply(response, 404, "Not found");

    if (request.method === "GET") {
      secureHeaders(response, "text/html; charset=utf-8");
      response.writeHead(200);
      response.end(renderDropForm(config.service, config.keyName));
      return;
    }
    if (request.method !== "POST") return reply(response, 405, "Method not allowed");
    if (settled) return reply(response, 410, "This key post has already self-destructed");
    if (request.headers.host !== expectedHost) return reply(response, 403, "Host rejected");
    if (request.headers.origin !== expectedOrigin) return reply(response, 403, "Origin rejected");

    settled = true;
    try {
      const value = await readFormValue(request);
      await storeSecret(config, writeGrant, value);
      reply(response, 200, "投函完了。このページは閉じてください。秘密値は表示・保存していません。");
      resolveCompletion();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Key post failed";
      reply(response, 502, message);
      rejectCompletion(new Error(message));
    } finally {
      setImmediate(() => server.close());
    }
  });

  server.on("clientError", (_error, socket) => socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}${path}`;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    server.close();
    rejectCompletion(new Error("Key post expired before submission"));
  }, config.ttlMs ?? DEFAULT_TTL_MS);
  completion.finally(() => clearTimeout(timer)).catch(() => undefined);

  return {
    url,
    completion,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export function openBrowser(url: string): void {
  const command = process.platform === "win32" ? "rundll32.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const child = spawn(command, args, {
    detached: true,
    env: environmentWithoutKeymasterCredentials(),
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", () => undefined);
  child.unref();
}

export interface IntakeTunnel {
  url: string;
  close: () => Promise<void>;
}

async function reserveLoopbackPort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address() as AddressInfo;
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(250);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 2_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

export async function openFlyIntakeTunnel(): Promise<IntakeTunnel> {
  const localPort = await reserveLoopbackPort();
  const executable = process.platform === "win32" ? "flyctl.exe" : "flyctl";
  const child = spawn(
    executable,
    ["proxy", `${localPort}:${FLY_INTAKE_PORT}`, "-a", FLY_APP, "-b", "127.0.0.1", "-q"],
    {
      env: environmentWithoutKeymasterCredentials(),
      stdio: "ignore",
      windowsHide: true,
    },
  );
  let startupError: Error | undefined;
  child.once("error", (error) => {
    startupError = error;
  });
  child.once("exit", (code, signal) => {
    startupError ??= new Error(`Fly intake tunnel exited before readiness (${code ?? signal ?? "unknown"})`);
  });

  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (startupError) {
      await stopChild(child);
      throw new Error("Unable to open the Fly-authenticated intake tunnel");
    }
    if (await isPortOpen(localPort)) {
      return {
        url: `http://127.0.0.1:${localPort}`,
        close: () => stopChild(child),
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await stopChild(child);
  throw new Error("Fly-authenticated intake tunnel did not become ready");
}

function usage(): string {
  return [
    "Usage: keymaster drop <service> [--key-name <field>] [--replace] [--intake-url <loopback-url>]",
    "",
    "The secret is accepted only by a one-time localhost form.",
    "By default, intake travels through a Fly-authenticated loopback tunnel to the private port.",
    "Authentication is reused from the existing Keymaster runtime binding.",
    "No token or secret-value CLI argument is accepted.",
  ].join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage());
    return;
  }
  if (args[0] !== "drop" || !args[1]) throw new Error(usage());

  const service = validateName(args[1], "service");
  let keyName = "api_key";
  let replace = false;
  let intakeUrl: string | undefined;
  for (let index = 2; index < args.length; index += 1) {
    if (args[index] === "--key-name" && args[index + 1]) {
      keyName = validateName(args[++index], "key name");
    } else if (args[index] === "--replace") {
      replace = true;
    } else if (args[index] === "--intake-url" && args[index + 1]) {
      intakeUrl = validatedKeymasterBaseUrl(args[++index]).toString();
    } else {
      throw new Error("Unknown or incomplete argument");
    }
  }

  const token = resolveIntakeToken();
  let tunnel: IntakeTunnel | undefined;
  let drop: DropServer | undefined;
  try {
    if (!intakeUrl) {
      tunnel = await openFlyIntakeTunnel();
      intakeUrl = tunnel.url;
    }
    drop = await createDropServer({
      service,
      keyName,
      token,
      keymasterUrl: intakeUrl,
      replace,
    });
    if (service === "npm") openBrowser("https://www.npmjs.com/settings/akari-os/tokens");
    openBrowser(drop.url);
    console.log(`鍵ポストを開きました: ${service}/${keyName}（10分・一回限り）`);
    await drop.completion;
    console.log(`投函完了: ${service}/${keyName}`);
  } finally {
    await drop?.close();
    await tunnel?.close();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Key post failed");
    process.exitCode = 1;
  });
}
