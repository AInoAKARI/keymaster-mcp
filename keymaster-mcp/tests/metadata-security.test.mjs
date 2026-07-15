import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const VERSION = "1.0.4";
const textFiles = [
  "README.md",
  "docs/a2a-design.md",
  "marketing/README-v2.md",
  "marketing/mcp-so-listing.md",
  "mcpize.yaml",
  "src/index.ts",
  "src/cli.ts",
  ".well-known/agent-card.json",
  ".well-known/agent.json",
  "marketing/agent-card.json",
];

test("published metadata versions stay synchronized", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const server = JSON.parse(await readFile("server.json", "utf8"));
  const canonicalCard = JSON.parse(await readFile(".well-known/agent-card.json", "utf8"));
  const legacyCard = JSON.parse(await readFile(".well-known/agent.json", "utf8"));
  const marketingCard = JSON.parse(await readFile("marketing/agent-card.json", "utf8"));
  const mcpize = await readFile("mcpize.yaml", "utf8");

  assert.equal(packageJson.version, VERSION);
  assert.equal(server.version, VERSION);
  assert.equal(server.packages[0].version, VERSION);
  assert.equal(canonicalCard.version, VERSION);
  assert.equal(legacyCard.version, VERSION);
  assert.equal(marketingCard.version, VERSION);
  assert.match(mcpize, new RegExp(`version: ["']${VERSION.replaceAll(".", "\\.")}["']`));

  const expectedTools = ["healthcheck", "list_secrets", "list_services", "rotate_secret", "secret_status"];
  const names = (skills) => skills.map((skill) => skill.id).sort();
  assert.deepEqual(names(canonicalCard.skills), expectedTools);
  assert.deepEqual(names(legacyCard.skills), expectedTools);
  assert.deepEqual(names(marketingCard.skills), expectedTools);
  const mcpizeTools = [...mcpize.matchAll(/^  - name: ([a-z_]+)$/gm)].map((match) => match[1]).sort();
  assert.deepEqual(mcpizeTools, expectedTools);
});

test("MCP and published docs never advertise or emit raw credential values", async () => {
  const contents = await Promise.all(textFiles.map((file) => readFile(file, "utf8")));
  const joined = contents.join("\n");

  assert.doesNotMatch(joined, /get_secret/);
  assert.doesNotMatch(joined, /vault\s+kv\s+put/i);
  assert.doesNotMatch(joined, /YOUR_TOKEN/);
  assert.doesNotMatch(joined, /autocomplete="new-password"/);
  assert.doesNotMatch(joined, /"api_key"\s*:\s*"sk[_-]/);
  assert.doesNotMatch(await readFile("src/index.ts", "utf8"), /api_key:\s*result\.value/);
  assert.doesNotMatch(await readFile("src/index.ts", "utf8"), /keymaster_url:\s*KEYMASTER_URL/);
  assert.doesNotMatch(await readFile("src/index.ts", "utf8"), /console\.error\([^\n]*(?:\be\b|error)/i);
  assert.doesNotMatch(await readFile("src/index.ts", "utf8"), /process\.env/);
  assert.doesNotMatch(await readFile("src/cli.ts", "utf8"), /process\.env/);
});

test("repository-root release workflow publishes npm before MCP metadata", async () => {
  const workflow = await readFile("../.github/workflows/publish-npm.yml", "utf8");
  assert.ok(workflow.indexOf("npm publish") < workflow.indexOf("mcp-publisher publish"));
  await assert.rejects(readFile(".github/workflows/publish-mcp-registry.yml", "utf8"));
});

test("human intake defaults to the Fly private port and explicit URLs stay loopback-only", async () => {
  const cli = await readFile("src/cli.ts", "utf8");
  assert.match(cli, /FLY_INTAKE_PORT = 8001/);
  assert.match(cli, /"127\.0\.0\.1"/);
  assert.match(cli, /Intake URL must be a loopback/);
  assert.match(cli, /spawn\(command, args, \{[\s\S]*?env: environmentWithoutKeymasterCredentials\(\)/);
  assert.doesNotMatch(cli, /spawn\([^)]*(?:token|secret)/is);
});
