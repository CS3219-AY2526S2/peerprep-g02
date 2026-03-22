type TokenGetter = (options?: { template?: string }) => Promise<string | null>;

type ApiRequestInit = RequestInit & {
    tokenTemplate?: string;
    skipAuth?: boolean;
};

let getTokenRef: TokenGetter | undefined;

export function injectAuthInterceptor(getToken?: TokenGetter): void {
    getTokenRef = getToken;
}

function resolveUrl(path: string): string {
    const gatewayUrl = import.meta.env.VITE_GATEWAY_ENDPOINT;
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }

    const normalizedGateway = gatewayUrl.endsWith("/") ? gatewayUrl.slice(0, -1) : gatewayUrl;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${normalizedGateway}/v1/api${normalizedPath}`;
}

// automatically injects auth token from Clerk
export async function apiFetch(path: string, init: ApiRequestInit = {}): Promise<Response> {
    const {
        tokenTemplate = "jwt",
        skipAuth = false,
        headers: rawHeaders,
        credentials,
        ...rest
    } = init;
    const headers = new Headers(rawHeaders);

    if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
    }

    if (!skipAuth && getTokenRef && !headers.has("Authorization")) {
        const token = await getTokenRef({ template: tokenTemplate });
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
    }

    return fetch(resolveUrl(path), {
        ...rest,
        headers,
        credentials: credentials ?? "include",
    });
}

export async function getAuthToken(): Promise<string | null> {
    if (!getTokenRef) {
        throw new Error("Auth interceptor not initialized");
    }
    return await getTokenRef({ template: "jwt" });
}
