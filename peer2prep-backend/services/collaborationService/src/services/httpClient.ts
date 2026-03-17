import { collaborationConfig } from "@/services/config.js";

export class DependencyUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DependencyUnavailableError";
    }
}

export async function gatewayFetch(
    path: string,
    init?: RequestInit,
): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        collaborationConfig.requestTimeoutMs,
    );

    try {
        return await fetch(`${collaborationConfig.apiGatewayUrl}${path}`, {
            ...init,
            signal: controller.signal,
            headers: {
                "content-type": "application/json",
                ...(init?.headers ?? {}),
            },
        });
    } catch (error) {
        throw new DependencyUnavailableError(
            error instanceof Error ? error.message : "Dependency request failed.",
        );
    } finally {
        clearTimeout(timeout);
    }
}
