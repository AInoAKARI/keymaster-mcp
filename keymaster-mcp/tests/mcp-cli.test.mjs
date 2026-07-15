import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("MCP CLI rejects token arguments without echoing the value", () => {
  const marker = "secret-marker-must-not-appear";
  const result = spawnSync(process.execPath, ["dist/index.js", "--token", marker], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(marker));
  assert.match(result.stderr, /Secret CLI arguments are not supported/);

  const inline = spawnSync(process.execPath, ["dist/index.js", `--token=${marker}`], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.notEqual(inline.status, 0);
  assert.doesNotMatch(`${inline.stdout}${inline.stderr}`, new RegExp(marker));
});

test("key post CLI rejects secret-like positional arguments without echoing them", () => {
  const marker = "positional-marker-must-not-appear";
  const result = spawnSync(process.execPath, ["dist/cli.js", "drop", "npm", marker], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(marker));
  assert.match(result.stderr, /Unknown or incomplete argument/);
});
