type TokenGetter = (options?: { template?: string }) => Promise<string | null>;

type ApiRequestInit = RequestInit & {
    tokenTemplate?: string;
    skipAuth?: boolean;
};

let getTokenRef: TokenGetter | undefined;

export function injectAuthInterceptor(getToken?: TokenGetter): void {
    getTokenRef = getToken;
}

// automatically injects auth token from Clerk
export async function apiFetch(url: string, init: ApiRequestInit = {}): Promise<Response> {
    const {
        tokenTemplate = "jwt",
        skipAuth = false,
        headers: rawHeaders,
        credentials,
        ...rest
    } = init;

    const headers = new Headers(rawHeaders);

    // Standardize Content-Type and Accept headers
    if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
    }
    if (!headers.has("Content-Type") && rest.body) {
        headers.set("Content-Type", "application/json");
    }

    // Inject Authorization header if not skipped
    if (!skipAuth && getTokenRef && !headers.has("Authorization")) {
        const token = await getTokenRef({ template: tokenTemplate });
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
    }

    // Since API_ENDPOINTS already contain the full gateway URL, 
    // we just fetch the URL directly.
    return fetch(url, {
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
