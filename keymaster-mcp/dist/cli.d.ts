#!/usr/bin/env node
export interface DropConfig {
    service: string;
    keyName: string;
    keymasterUrl: string;
    token: string;
    replace?: boolean;
    ttlMs?: number;
}
interface DropServer {
    url: string;
    completion: Promise<void>;
    close: () => Promise<void>;
}
export declare function renderDropForm(service: string, keyName: string): string;
export declare function createDropServer(config: DropConfig): Promise<DropServer>;
export declare function openBrowser(url: string): void;
export interface IntakeTunnel {
    url: string;
    close: () => Promise<void>;
}
export declare function openFlyIntakeTunnel(): Promise<IntakeTunnel>;
export {};
