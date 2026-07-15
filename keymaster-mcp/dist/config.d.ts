export declare const DEFAULT_KEYMASTER_URL = "https://akari-keymaster.fly.dev";
export interface KeymasterConfig {
    url: string;
    token: string;
}
type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;
export declare function resolveKeymasterConfig(urlOverride?: string, environment?: RuntimeEnvironment): KeymasterConfig;
export declare function resolveIntakeToken(environment?: RuntimeEnvironment): string;
export declare function environmentWithoutKeymasterCredentials(environment?: RuntimeEnvironment): Record<string, string | undefined>;
export {};
