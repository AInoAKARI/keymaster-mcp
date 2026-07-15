"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_KEYMASTER_URL = void 0;
exports.resolveKeymasterConfig = resolveKeymasterConfig;
exports.resolveIntakeToken = resolveIntakeToken;
exports.environmentWithoutKeymasterCredentials = environmentWithoutKeymasterCredentials;
exports.DEFAULT_KEYMASTER_URL = "https://akari-keymaster.fly.dev";
function firstNonEmpty(...values) {
    return values.find((value) => value !== undefined && value.length > 0);
}
function resolveKeymasterConfig(urlOverride, environment = process.env) {
    const connectorToken = firstNonEmpty(environment.USER_KEYMASTER_TOKEN);
    const legacyToken = firstNonEmpty(environment.KEYMASTER_TOKEN);
    if (connectorToken) {
        return {
            url: firstNonEmpty(urlOverride, environment.USER_KEYMASTER_URL) ?? exports.DEFAULT_KEYMASTER_URL,
            token: connectorToken,
        };
    }
    if (legacyToken) {
        return {
            url: firstNonEmpty(urlOverride, environment.KEYMASTER_URL) ?? exports.DEFAULT_KEYMASTER_URL,
            token: legacyToken,
        };
    }
    return {
        url: firstNonEmpty(urlOverride, environment.USER_KEYMASTER_URL, environment.KEYMASTER_URL) ?? exports.DEFAULT_KEYMASTER_URL,
        token: "",
    };
}
function resolveIntakeToken(environment = process.env) {
    return firstNonEmpty(environment.KEYMASTER_TOKEN) ?? "";
}
function environmentWithoutKeymasterCredentials(environment = process.env) {
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
    return Object.fromEntries(Object.entries(environment).filter(([key, value]) => value !== undefined && allowed.has(key.toUpperCase())));
}
//# sourceMappingURL=config.js.map