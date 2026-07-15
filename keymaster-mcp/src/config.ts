export const DEFAULT_KEYMASTER_URL = "https://akari-keymaster.fly.dev";

export interface KeymasterConfig {
  url: string;
  token: string;
}

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.length > 0);
}

export function resolveKeymasterConfig(
  urlOverride?: string,
  environment: RuntimeEnvironment = process.env,
): KeymasterConfig {
  const connectorToken = firstNonEmpty(environment.USER_KEYMASTER_TOKEN);
  const legacyToken = firstNonEmpty(environment.KEYMASTER_TOKEN);
  if (connectorToken) {
    return {
      url: firstNonEmpty(urlOverride, environment.USER_KEYMASTER_URL) ?? DEFAULT_KEYMASTER_URL,
      token: connectorToken,
    };
  }
  if (legacyToken) {
    return {
      url: firstNonEmpty(urlOverride, environment.KEYMASTER_URL) ?? DEFAULT_KEYMASTER_URL,
      token: legacyToken,
    };
  }
  return {
    url: firstNonEmpty(
      urlOverride,
      environment.USER_KEYMASTER_URL,
      environment.KEYMASTER_URL,
    ) ?? DEFAULT_KEYMASTER_URL,
    token: "",
  };
}

export function environmentWithoutKeymasterCredentials(
  environment: RuntimeEnvironment = process.env,
): Record<string, string | undefined> {
  const allowed = new Set([
    "APPDATA",
    "COMSPEC",
    "DBUS_SESSION_BUS_ADDRESS",
    "DISPLAY",
    "HOME",
    "HOMEDRIVE",
    "HOMEPATH",
    "LOCALAPPDATA",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "PATH",
    "PATHEXT",
    "PROGRAMDATA",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "TMPDIR",
    "USERPROFILE",
    "WINDIR",
    "WAYLAND_DISPLAY",
    "XAUTHORITY",
    "XDG_CONFIG_HOME",
    "XDG_RUNTIME_DIR",
  ]);
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([key, value]) => value !== undefined && allowed.has(key.toUpperCase()),
    ),
  );
}
