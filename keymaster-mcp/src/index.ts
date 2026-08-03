#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fatalErrorLine, publicRequestError } from "./security.js";

const VERSION = "1.1.0";
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/;
const MAX_HEALTHCHECK_CONCURRENCY = 5;
const safeName = z.string().regex(NAME_PATTERN, "Invalid service or key name");

type CliArgs = { vaultUrl?: string; help?: boolean };

function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {};
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      result.help = true;
    } else if (argument === "--vault-url" && argv[index + 1]) {
      result.vaultUrl = argv[++index];
    } else if (argument === "--token" || argument.startsWith("--token=")) {
      throw new Error("Secret CLI arguments are not supported");
    } else {
      throw new Error("Unknown or incomplete option");
    }
  }
  return result;
}

function validatedKeymasterUrl(value: string): URL {
  const url = new URL(value);
  const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  const acceptedProtocol = url.protocol === "https:" || (url.protocol === "http:" && loopback);
  if (!acceptedProtocol || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid Keymaster URL");
  }
  return url;
}

let cliArgs: CliArgs;
try {
  cliArgs = parseArgs(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : "Invalid command line";
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (cliArgs.help) {
  process.stdout.write([
    "Keymaster MCP — non-disclosing credential status for AI agents",
    "",
    "Usage:",
    "  keymaster-mcp [--vault-url <https-url>]",
    "",
    "Runtime bindings:",
    "  USER_KEYMASTER_URL    Keymaster proxy URL",
    "  USER_KEYMASTER_TOKEN  Read-only bearer token supplied by the MCP host",
    "",
    "Raw tokens are never accepted as command-line arguments.",
  ].join("\n") + "\n");
  process.exit(0);
}

const KEYMASTER_URL = cliArgs.vaultUrl ?? process.env.USER_KEYMASTER_URL ?? "";
const KEYMASTER_TOKEN = process.env.USER_KEYMASTER_TOKEN ?? "";

interface ServiceEntry {
  service: string;
  key_name: string;
  check_method: "GET" | "NONE";
  endpoint: string;
  auth_type: "bearer" | "bot" | "x-api-key" | "notion" | "query" | "url" | "basic" | "";
}

const KNOWN_SERVICES: ServiceEntry[] = [
  { service: "groq", key_name: "api_key", check_method: "GET", endpoint: "https://api.groq.com/openai/v1/models", auth_type: "bearer" },
  { service: "moonshot", key_name: "api_key", check_method: "GET", endpoint: "https://api.moonshot.ai/v1/models", auth_type: "bearer" },
  { service: "moonshot", key_name: "api_key_openclaw", check_method: "GET", endpoint: "https://api.moonshot.ai/v1/models", auth_type: "bearer" },
  { service: "openai", key_name: "api_key", check_method: "GET", endpoint: "https://api.openai.com/v1/models", auth_type: "bearer" },
  { service: "deepseek", key_name: "api_key", check_method: "GET", endpoint: "https://api.deepseek.com/models", auth_type: "bearer" },
  { service: "discord", key_name: "api_key", check_method: "GET", endpoint: "https://discord.com/api/v10/users/@me", auth_type: "bot" },
  { service: "discord_bot", key_name: "api_key", check_method: "GET", endpoint: "https://discord.com/api/v10/users/@me", auth_type: "bot" },
  { service: "gemini", key_name: "api_key", check_method: "GET", endpoint: "https://generativelanguage.googleapis.com/v1/models?key={KEY}", auth_type: "query" },
  { service: "github", key_name: "api_key", check_method: "GET", endpoint: "https://api.github.com/user", auth_type: "bearer" },
  { service: "google", key_name: "api_key", check_method: "NONE", endpoint: "", auth_type: "" },
  { service: "claude", key_name: "api_key", check_method: "GET", endpoint: "https://api.anthropic.com/v1/models", auth_type: "x-api-key" },
  { service: "claude_openclaw", key_name: "api_key", check_method: "GET", endpoint: "https://api.anthropic.com/v1/models", auth_type: "x-api-key" },
  { service: "notion", key_name: "api_key", check_method: "GET", endpoint: "https://api.notion.com/v1/users/me", auth_type: "notion" },
  { service: "ibm_quantum", key_name: "api_key", check_method: "NONE", endpoint: "", auth_type: "" },
  { service: "stripe", key_name: "api_key", check_method: "GET", endpoint: "https://api.stripe.com/v1/balance", auth_type: "basic" },
  { service: "stripe", key_name: "secret_key", check_method: "GET", endpoint: "https://api.stripe.com/v1/balance", auth_type: "basic" },
  { service: "stripe", key_name: "webhook_secret", check_method: "NONE", endpoint: "", auth_type: "" },
  { service: "twitter", key_name: "api_key", check_method: "GET", endpoint: "https://api.twitter.com/2/users/me", auth_type: "bearer" },
  { service: "vercel", key_name: "api_key", check_method: "GET", endpoint: "https://api.vercel.com/v2/user", auth_type: "bearer" },
  { service: "shopify", key_name: "api_key", check_method: "NONE", endpoint: "", auth_type: "" },
  { service: "youtube", key_name: "api_key", check_method: "NONE", endpoint: "", auth_type: "" },
  { service: "slack", key_name: "api_key", check_method: "GET", endpoint: "https://slack.com/api/auth.test", auth_type: "bearer" },
  { service: "telegram", key_name: "api_key", check_method: "GET", endpoint: "https://api.telegram.org/bot{KEY}/getMe", auth_type: "url" },
  { service: "render", key_name: "api_key", check_method: "GET", endpoint: "https://api.render.com/v1/owners", auth_type: "bearer" },
  { service: "cloudflare", key_name: "api_key", check_method: "GET", endpoint: "https://api.cloudflare.com/client/v4/user/tokens/verify", auth_type: "bearer" },
  { service: "sendgrid", key_name: "api_key", check_method: "GET", endpoint: "https://api.sendgrid.com/v3/user/profile", auth_type: "bearer" },
  { service: "spotify", key_name: "api_key", check_method: "NONE", endpoint: "", auth_type: "" },
  { service: "line", key_name: "api_key", check_method: "NONE", endpoint: "", auth_type: "" },
  { service: "huggingface", key_name: "api_key", check_method: "GET", endpoint: "https://huggingface.co/api/whoami-v2", auth_type: "bearer" },
  { service: "replicate", key_name: "api_key", check_method: "GET", endpoint: "https://api.replicate.com/v1/account", auth_type: "bearer" },
  { service: "supabase", key_name: "api_key", check_method: "NONE", endpoint: "", auth_type: "" },
  { service: "supabase", key_name: "service_role_key", check_method: "NONE", endpoint: "", auth_type: "" },
  { service: "resend", key_name: "api_key", check_method: "GET", endpoint: "https://api.resend.com/api-keys", auth_type: "bearer" },
  { service: "daily", key_name: "api_key", check_method: "GET", endpoint: "https://api.daily.co/v1/rooms", auth_type: "bearer" },
];

type FetchResult = { ok: boolean; status: number; value?: string; error?: string };

async function keymasterFetch(service: string, keyName: string): Promise<FetchResult> {
  if (!NAME_PATTERN.test(service) || !NAME_PATTERN.test(keyName)) {
    return { ok: false, status: 400, error: "Invalid service or key name" };
  }
  if (!KEYMASTER_URL || !KEYMASTER_TOKEN) {
    return { ok: false, status: 0, error: "Keymaster authentication is unavailable" };
  }

  try {
    const endpoint = new URL("/vault/api-key", validatedKeymasterUrl(KEYMASTER_URL));
    endpoint.searchParams.set("api_name", service);
    endpoint.searchParams.set("key_name", keyName);
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${KEYMASTER_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    }
    const body = (await response.json()) as Record<string, unknown>;
    const value = typeof body.api_key === "string" ? body.api_key : undefined;
    return value
      ? { ok: true, status: response.status, value }
      : { ok: false, status: response.status, error: "Credential unavailable" };
  } catch {
    return { ok: false, status: 0, error: publicRequestError() };
  }
}

async function validateCredential(
  credential: string,
  entry: ServiceEntry,
): Promise<{ status: "valid" | "exists" | "invalid" | "error" | "unreachable"; http_code: number | null }> {
  if (entry.check_method === "NONE") {
    return { status: "exists", http_code: null };
  }

  try {
    const headers: Record<string, string> = {};
    let endpoint = entry.endpoint;
    switch (entry.auth_type) {
      case "bearer": headers.Authorization = `Bearer ${credential}`; break;
      case "bot": headers.Authorization = `Bot ${credential}`; break;
      case "x-api-key": headers["x-api-key"] = credential; headers["anthropic-version"] = "2023-06-01"; break;
      case "notion": headers.Authorization = `Bearer ${credential}`; headers["Notion-Version"] = "2022-06-28"; break;
      case "query":
      case "url": endpoint = entry.endpoint.replace("{KEY}", encodeURIComponent(credential)); break;
      case "basic": headers.Authorization = `Basic ${Buffer.from(`${credential}:`).toString("base64")}`; break;
    }

    const response = await fetch(endpoint, { headers, redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const code = response.status;
    if (code >= 200 && code < 300) return { status: "valid", http_code: code };
    if (code === 401 || code === 403) return { status: "invalid", http_code: code };
    return { status: "error", http_code: code };
  } catch {
    return { status: "unreachable", http_code: null };
  }
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  async function consume(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return output;
}

const server = new McpServer({ name: "keymaster-mcp", version: VERSION });

server.tool("secret_status", "Check whether an approved credential is available through Keymaster. Credential values are never returned.", {
  service: safeName.describe("Service name, such as openai, stripe, or github"),
  key_name: safeName.default("api_key").describe("Credential field name"),
}, async ({ service, key_name }) => {
  const result = await keymasterFetch(service, key_name);
  if (!result.ok) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ service, key_name, status: "unavailable", reason: result.error }) }],
      isError: result.status === 0,
    };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify({ service, key_name, status: "available" }) }] };
});

server.tool("healthcheck", "Validate approved credentials against known upstream services without disclosing credential values.", {}, async () => {
  const results = await mapLimit(KNOWN_SERVICES, MAX_HEALTHCHECK_CONCURRENCY, async (entry) => {
    const fetched = await keymasterFetch(entry.service, entry.key_name);
    if (!fetched.ok || !fetched.value) {
      return { service: entry.service, key_name: entry.key_name, key_status: fetched.status === 0 ? "fetch_error" : "not_found", api_status: "skipped", http_code: null };
    }
    const validation = await validateCredential(fetched.value, entry);
    return { service: entry.service, key_name: entry.key_name, key_status: "available", api_status: validation.status, http_code: validation.http_code };
  });

  const summary = {
    checked_at: new Date().toISOString(),
    keymaster_configured: Boolean(KEYMASTER_URL && KEYMASTER_TOKEN),
    total: results.length,
    valid: results.filter((item) => item.api_status === "valid").length,
    exists_only: results.filter((item) => item.api_status === "exists").length,
    invalid: results.filter((item) => item.api_status === "invalid").length,
    errors: results.filter((item) => ["fetch_error", "unreachable", "error"].includes(item.api_status) || item.key_status === "fetch_error").length,
    results,
  };
  return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
});

server.tool("list_services", "List supported service and credential-name pairs as non-secret metadata.", {}, async () => ({
  content: [{ type: "text" as const, text: JSON.stringify({
    total: KNOWN_SERVICES.length,
    services: KNOWN_SERVICES.map(({ service, key_name, check_method }) => ({ service, key_name, verifiable: check_method !== "NONE" })),
  }, null, 2) }],
}));

server.tool("list_secrets", "List approved credential paths as metadata only. No credential values are returned.", {}, async () => {
  const unique = KNOWN_SERVICES.map(({ service, key_name, check_method }) => ({
    service, key_name, path: `${service}/${key_name}`, verifiable: check_method !== "NONE",
  })).filter((item, index, array) => array.findIndex((candidate) => candidate.path === item.path) === index);
  return { content: [{ type: "text" as const, text: JSON.stringify({ total: unique.length, secrets: unique }, null, 2) }] };
});

server.tool("rotate_secret", "Return safe rotation guidance. This read-only MCP server never accepts or writes credential values.", {
  service: safeName.describe("Service name"),
  key_name: safeName.default("api_key").describe("Credential field name"),
}, async ({ service, key_name }) => ({
  content: [{ type: "text" as const, text: [
    `Rotation required for ${service}/${key_name}.`,
    "Use the privileged Keymaster intake plane or your Vault operator workflow.",
    "Never paste a replacement credential into chat, an MCP argument, a command-line argument, or a public issue.",
  ].join("\n") }],
}));

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(fatalErrorLine(error));
  process.exit(1);
});
