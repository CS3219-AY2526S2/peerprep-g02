declare module "pino" {
    export interface LoggerOptions {
        level?: string;
        transport?: {
            target: string;
            options?: Record<string, unknown>;
        };
    }

    export interface Logger {
        child(bindings: Record<string, unknown>): Logger;
        info(...args: unknown[]): void;
        warn(...args: unknown[]): void;
        error(...args: unknown[]): void;
    }

    export default function pino(options?: LoggerOptions): Logger;
}
