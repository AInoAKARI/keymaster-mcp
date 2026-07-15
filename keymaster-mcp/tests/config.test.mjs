import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_KEYMASTER_URL,
  environmentWithoutKeymasterCredentials,
  resolveKeymasterConfig,
} from "../dist/config.js";

test("existing Keymaster bindings resolve in one place with stable precedence", () => {
  assert.deepEqual(resolveKeymasterConfig(undefined, {}), {
    url: DEFAULT_KEYMASTER_URL,
    token: "",
  });
  assert.deepEqual(
    resolveKeymasterConfig(undefined, {
      KEYMASTER_URL: "https://legacy.example.test",
      USER_KEYMASTER_URL: "https://connector.example.test",
      KEYMASTER_TOKEN: "legacy-token",
      USER_KEYMASTER_TOKEN: "connector-token",
    }),
    {
      url: "https://connector.example.test",
      token: "connector-token",
    },
  );
  assert.deepEqual(
    resolveKeymasterConfig(undefined, {
      KEYMASTER_URL: "https://legacy.example.test",
      KEYMASTER_TOKEN: "legacy-token",
      USER_KEYMASTER_URL: "https://connector.example.test",
    }),
    {
      url: "https://legacy.example.test",
      token: "legacy-token",
    },
  );
  assert.deepEqual(
    resolveKeymasterConfig(undefined, {
      KEYMASTER_URL: "https://legacy.example.test",
      USER_KEYMASTER_TOKEN: "connector-token",
    }),
    {
      url: DEFAULT_KEYMASTER_URL,
      token: "connector-token",
    },
  );
  assert.equal(
    resolveKeymasterConfig("https://argument.example.test", { KEYMASTER_URL: "https://binding.example.test" }).url,
    "https://argument.example.test",
  );
  assert.deepEqual(
    resolveKeymasterConfig(undefined, {
      KEYMASTER_URL: "",
      USER_KEYMASTER_URL: "https://connector.example.test",
      USER_KEYMASTER_TOKEN: "",
      KEYMASTER_TOKEN: "local-token",
    }),
    {
      url: DEFAULT_KEYMASTER_URL,
      token: "local-token",
    },
  );
});

test("credentials are not inherited by the Fly tunnel process", () => {
  assert.deepEqual(
    environmentWithoutKeymasterCredentials({
      PATH: "test-path",
      USERPROFILE: "test-profile",
      KEYMASTER_TOKEN: "local-token",
      USER_KEYMASTER_TOKEN: "connector-token",
      ANTHROPIC_API_KEY: "provider-token",
      FLY_API_TOKEN: "fly-token",
    }),
    { PATH: "test-path", USERPROFILE: "test-profile" },
  );
});
