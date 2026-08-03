import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const serverJson = JSON.parse(await readFile("server.json", "utf8"));
const source = await readFile("src/index.ts", "utf8");
const readme = await readFile("README.md", "utf8");

const version = packageJson.version;
assert.match(version, /^\d+\.\d+\.\d+$/);
assert.equal(serverJson.version, version);
assert.equal(serverJson.packages[0].version, version);
assert.equal(packageJson.mcpName, serverJson.name);
assert.match(source, new RegExp(`const VERSION = ["']${version.replaceAll(".", "\\.")}["']`));

assert.doesNotMatch(source, /server\.tool\(\s*["']get_secret["']/);
assert.doesNotMatch(source, /api_key\s*:\s*result\.value/);
assert.doesNotMatch(source, /keymaster_url\s*:\s*KEYMASTER_URL/);
assert.match(source, /server\.tool\(\s*["']secret_status["']/);
assert.match(source, /Secret CLI arguments are not supported/);
assert.match(readme, /Credential values are never returned|never returns credential values/i);

console.log(JSON.stringify({
  version,
  mcpName: packageJson.mcpName,
  nonDisclosing: true,
  metadataAligned: true
}));
