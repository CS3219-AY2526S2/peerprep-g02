type TokenGetter = (options?: { template?: string }) => Promise<string | null>;

type ApiRequestInit = RequestInit & {
    tokenTemplate?: string;
    skipAuth?: boolean;
};

let getTokenRef: TokenGetter | undefined;
const AUTH_INTERCEPTOR_WAIT_MS = 1500;
const AUTH_INTERCEPTOR_POLL_MS = 25;

export function injectAuthInterceptor(getToken?: TokenGetter): void {
    getTokenRef = getToken;
}

async function waitForAuthInterceptor(): Promise<TokenGetter | undefined> {
    if (getTokenRef) {
        return getTokenRef;
    }

    const start = Date.now();

    while (!getTokenRef && Date.now() - start < AUTH_INTERCEPTOR_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, AUTH_INTERCEPTOR_POLL_MS));
    }

    return getTokenRef;
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
    if (!skipAuth && !headers.has("Authorization")) {
        const tokenGetter = await waitForAuthInterceptor();
        const token = tokenGetter ? await tokenGetter({ template: tokenTemplate }) : null;
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
        console.warn("Auth interceptor not yet initialized. Retrying...");
        return null;
    }
    return await getTokenRef({ template: "jwt" });
}
