#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolveKeymasterConfig } from "./config.js";

// ── CLI argument parsing ──
function parseArgs(argv: string[]): { vaultUrl?: string; help?: boolean } {
  const result: { vaultUrl?: string; help?: boolean } = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--vault-url" && i + 1 < argv.length) {
      result.vaultUrl = argv[++i];
    } else if (arg === "--token" || arg.startsWith("--token=")) {
      throw new Error("Secret CLI arguments are not supported");
    } else {
      throw new Error("Unknown or incomplete option");
    }
  }
  return result;
}

const cliArgs = parseArgs(process.argv);
const VERSION = "1.0.4";

if (cliArgs.help) {
const help = `
Keymaster MCP Server - The Vault for AI Agents

Usage:
  keymaster-mcp [options]

Options:
  --vault-url <url>   Keymaster proxy URL (overrides USER_KEYMASTER_URL env var)
  -h, --help          Show this help message

Environment Variables:
  USER_KEYMASTER_URL    Keymaster proxy URL
  USER_KEYMASTER_TOKEN  Keymaster bearer token

Claude Code:
  claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp --vault-url <url>
`.trim();
  console.log(help);
  process.exit(0);
}

// ── Existing runtime/connector credentials ──
const keymasterConfig = resolveKeymasterConfig(cliArgs.vaultUrl);
const KEYMASTER_URL = keymasterConfig.url;
const KEYMASTER_TOKEN = keymasterConfig.token;
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/;
const safeName = z.string().regex(NAME_PATTERN, "Invalid service or key name");

// ── Known services (mirrors ~/keymaster/services.conf) ──
interface ServiceEntry {
  service: string;
  key_name: string;
  check_method: string;
  endpoint: string;
  auth_type: string;
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

// ── Keymaster HTTP helper ──
async function keymasterFetch(
  service: string,
  keyName: string,
): Promise<{ ok: boolean; status: number; value?: string; error?: string }> {
  if (!NAME_PATTERN.test(service) || !NAME_PATTERN.test(keyName)) {
    return { ok: false, status: 400, error: "Invalid service or key name" };
  }
  if (!KEYMASTER_URL || !KEYMASTER_TOKEN) {
    return { ok: false, status: 0, error: "Keymaster authentication is unavailable" };
  }
  try {
    const baseUrl = new URL(KEYMASTER_URL);
    const isLoopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(baseUrl.hostname);
    if (
      baseUrl.username
      || baseUrl.password
      || baseUrl.search
      || baseUrl.hash
      || (baseUrl.protocol !== "https:" && !(baseUrl.protocol === "http:" && isLoopback))
    ) {
      return { ok: false, status: 0, error: "Invalid Keymaster URL" };
    }
    const endpoint = new URL("/vault/api-key", baseUrl);
    endpoint.searchParams.set("api_name", service);
    endpoint.searchParams.set("key_name", keyName);
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${KEYMASTER_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    const value = typeof data.api_key === "string" ? data.api_key : undefined;
    if (!value) {
      return { ok: false, status: res.status, error: "Empty value in response" };
    }
    return { ok: true, status: res.status, value };
  } catch {
    return { ok: false, status: 0, error: "Keymaster request failed" };
  }
}

// ── Validate a key against its service API ──
async function validateKey(
  key: string,
  entry: ServiceEntry,
): Promise<{ status: string; http_code: number | null }> {
  if (entry.check_method === "NONE") {
    return { status: "exists", http_code: null };
  }
  try {
    const headers: Record<string, string> = {};
    let url = entry.endpoint;

    switch (entry.auth_type) {
      case "bearer":
        headers["Authorization"] = `Bearer ${key}`;
        break;
      case "bot":
        headers["Authorization"] = `Bot ${key}`;
        break;
      case "x-api-key":
        headers["x-api-key"] = key;
        headers["anthropic-version"] = "2023-06-01";
        break;
      case "notion":
        headers["Authorization"] = `Bearer ${key}`;
        headers["Notion-Version"] = "2022-06-28";
        break;
      case "query":
      case "url":
        url = entry.endpoint.replace("{KEY}", key);
        break;
      case "basic":
        headers["Authorization"] = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
        break;
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    const code = res.status;
    if (code >= 200 && code < 300) return { status: "valid", http_code: code };
    if (code === 401 || code === 403) return { status: "invalid", http_code: code };
    return { status: "error", http_code: code };
  } catch {
    return { status: "unreachable", http_code: null };
  }
}

// ── MCP Server ──
const server = new McpServer({
  name: "keymaster-mcp",
  version: VERSION,
});

// Tool: secret_status
server.tool(
  "secret_status",
  "Check whether a credential is available through Keymaster without returning its value.",
  {
    service: safeName.describe("Service name (e.g. 'openai', 'stripe', 'groq')"),
    key_name: safeName.default("api_key").describe("Key field name (default: 'api_key')"),
  },
  async ({ service, key_name }) => {
    const result = await keymasterFetch(service, key_name);
    if (!result.ok) {
      return {
        content: [{ type: "text" as const, text: `Error: ${result.error}` }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ service, key_name, status: "available" }),
        },
      ],
    };
  },
);

// Tool: healthcheck
server.tool(
  "healthcheck",
  "Check Keymaster connectivity and validate all known API keys against their service endpoints. Returns a full status report.",
  {},
  async () => {
    const results: Array<{
      service: string;
      key_name: string;
      key_status: string;
      api_status: string;
      http_code: number | null;
    }> = [];

    // Check Keymaster reachability first
    const ping = await keymasterFetch("groq", "api_key");
    if (!ping.ok && ping.status === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Keymaster unreachable: ${ping.error}`,
          },
        ],
        isError: true,
      };
    }

    // Check each known service
    for (const entry of KNOWN_SERVICES) {
      const fetched = await keymasterFetch(entry.service, entry.key_name);
      if (!fetched.ok) {
        results.push({
          service: entry.service,
          key_name: entry.key_name,
          key_status: fetched.status === 0 ? "fetch_error" : "not_found",
          api_status: "skipped",
          http_code: null,
        });
        continue;
      }

      const validation = await validateKey(fetched.value!, entry);
      results.push({
        service: entry.service,
        key_name: entry.key_name,
        key_status: "retrieved",
        api_status: validation.status,
        http_code: validation.http_code,
      });
    }

    const summary = {
      checked_at: new Date().toISOString(),
      total: results.length,
      valid: results.filter((r) => r.api_status === "valid").length,
      exists_only: results.filter((r) => r.api_status === "exists").length,
      invalid: results.filter((r) => r.api_status === "invalid").length,
      errors: results.filter((r) =>
        ["not_found", "fetch_error", "unreachable", "error"].includes(r.api_status),
      ).length,
      results,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
    };
  },
);

// Tool: list_services
server.tool(
  "list_services",
  "List all known services and key names that can be checked with secret_status.",
  {},
  async () => {
    const services = KNOWN_SERVICES.map((s) => ({
      service: s.service,
      key_name: s.key_name,
      verifiable: s.check_method !== "NONE",
    }));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ total: services.length, services }, null, 2),
        },
      ],
    };
  },
);

// Tool: list_secrets
server.tool(
  "list_secrets",
  "List approved credential paths as metadata only. No credential values are returned.",
  {},
  async () => {
    const secrets = KNOWN_SERVICES.map((s) => ({
      service: s.service,
      key_name: s.key_name,
      path: `${s.service}/${s.key_name}`,
      verifiable: s.check_method !== "NONE",
    }));

    // Deduplicate by path
    const unique = [...new Map(secrets.map((s) => [s.path, s])).values()];

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              total: unique.length,
              usage: "Use secret_status with the service and key_name values to check availability without receiving a value.",
              secrets: unique,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// Tool: rotate_secret
server.tool(
  "rotate_secret",
  "Rotate (replace) a secret in Vault. For security, this operation is not available through the read-only Keymaster proxy.",
  {
    service: safeName.describe("Service name (e.g. 'openai', 'stripe')"),
    key_name: safeName.default("api_key").describe("Key field name (default: 'api_key')"),
  },
  async ({ service, key_name }) => {
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Secret rotation for ${service}/${key_name} is not available via this MCP server.`,
            "",
            "Use the Fly-authenticated localhost intake command:",
            `  keymaster drop ${service} --key-name ${key_name} --replace`,
            "The replacement value must be entered only in the one-time browser form, never in a CLI argument, chat, or log.",
          ].join("\n"),
        },
      ],
      isError: true,
    };
  },
);

// ── Start ──
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(() => {
  console.error("Fatal: Keymaster MCP failed");
  process.exit(1);
});
