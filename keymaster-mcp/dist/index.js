#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const KEYMASTER_URL = process.env.KEYMASTER_URL || "https://akari-vault-keymaster.onrender.com";
const KEYMASTER_AUTH_TOKEN = process.env.KEYMASTER_AUTH_TOKEN || "";
async function keymasterFetch(path, opts) {
    const url = `${KEYMASTER_URL}${path}`;
    const headers = {
        ...opts?.headers,
    };
    if (KEYMASTER_AUTH_TOKEN) {
        headers["Authorization"] = `Bearer ${KEYMASTER_AUTH_TOKEN}`;
    }
    return fetch(url, { ...opts, headers });
}
const server = new mcp_js_1.McpServer({
    name: "keymaster-mcp",
    version: "1.0.0",
});
// --- Tool: health_check ---
server.tool("health_check", "Check if the Keymaster server is reachable and healthy", {}, async () => {
    try {
        const res = await keymasterFetch("/health");
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
// --- Tool: get_secret ---
server.tool("get_secret", "Retrieve a secret from Vault via Keymaster. Use `service` for the api_name (stored under api_keys/{service}), or `path` for a custom Vault path. Optionally specify `key_name` (defaults to 'api_key').", {
    service: zod_1.z.string().optional().describe("The service/api name (e.g. 'stripe', 'openai'). Maps to Vault path api_keys/{service}"),
    path: zod_1.z.string().optional().describe("Custom Vault path (overrides service)"),
    key_name: zod_1.z.string().optional().describe("Key within the secret (default: 'api_key')"),
}, async ({ service, path, key_name }) => {
    if (!service && !path) {
        return { content: [{ type: "text", text: "Error: either 'service' or 'path' is required" }], isError: true };
    }
    const params = new URLSearchParams();
    if (service)
        params.set("api_name", service);
    if (path)
        params.set("path", path);
    if (key_name)
        params.set("key_name", key_name);
    try {
        const res = await keymasterFetch(`/vault/api-key?${params.toString()}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            return { content: [{ type: "text", text: `Error ${res.status}: ${err.detail || res.statusText}` }], isError: true };
        }
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
// --- Tool: list_services ---
server.tool("list_services", "List known service names that can be used with get_secret. Note: this returns a static discovery endpoint; actual service enumeration depends on Vault configuration.", {
    name: zod_1.z.string().optional().describe("If provided, returns the form URL for registering a new service"),
}, async ({ name }) => {
    if (name) {
        try {
            const res = await keymasterFetch("/vault/discover", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const data = await res.json();
            return { content: [{ type: "text", text: JSON.stringify(data) }] };
        }
        catch (e) {
            return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
    }
    return {
        content: [{
                type: "text",
                text: "Use get_secret with a service name (e.g. 'stripe', 'openai') to retrieve secrets. Use list_services with a 'name' parameter to discover/register a new service.",
            }],
    };
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});
//# sourceMappingURL=index.js.map