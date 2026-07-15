import assert from "node:assert/strict";
import test from "node:test";

import { fatalErrorLine, publicRequestError } from "../dist/security.js";

const secrets = [
  "sk-test-super-secret",
  "ghp_test_personal_access_token",
  "https://user:password@example.com/?token=secret",
  "Bearer vault-root-token",
];

test("public request failures never include the original exception", () => {
  const output = publicRequestError(new Error(secrets.join(" ")));

  assert.equal(output, "Request failed");
  for (const secret of secrets) assert.doesNotMatch(output, new RegExp(secret));
});

test("fatal stderr output is constant and secret-free", () => {
  const output = fatalErrorLine(new Error(secrets.join(" ")));

  assert.equal(output, "Fatal: keymaster-mcp terminated\n");
  for (const secret of secrets) assert.doesNotMatch(output, new RegExp(secret));
});
