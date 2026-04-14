type TokenGetter = (options?: { template?: string }) => Promise<string | null>;
type AuthFailureHandler = (reason: "unauthorized" | "inactive") => void;

type ApiRequestInit = RequestInit & {
    tokenTemplate?: string;
    skipAuth?: boolean;
};

let getTokenRef: TokenGetter | undefined;
let authFailureHandlerRef: AuthFailureHandler | undefined;
let resolveAuthInterceptorReady: ((value: TokenGetter | undefined) => void) | undefined;
let authInterceptorReady = false;
const authInterceptorReadyPromise = new Promise<TokenGetter | undefined>((resolve) => {
    resolveAuthInterceptorReady = resolve;
});

export function injectAuthInterceptor(getToken?: TokenGetter): void {
    getTokenRef = getToken;

    if (!authInterceptorReady) {
        authInterceptorReady = true;
        resolveAuthInterceptorReady?.(getToken);
        resolveAuthInterceptorReady = undefined;
    }
}

export function injectAuthFailureHandler(handler?: AuthFailureHandler): void {
    authFailureHandlerRef = handler;
}

async function waitForAuthInterceptor(): Promise<TokenGetter | undefined> {
    if (getTokenRef) {
        return getTokenRef;
    }

    if (authInterceptorReady) {
        return undefined;
    }

    return authInterceptorReadyPromise;
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
    const response = await fetch(url, {
        ...rest,
        headers,
        credentials: credentials ?? "include",
    });

    if (response.status === 401) {
        authFailureHandlerRef?.("unauthorized");
        return response;
    }

    if (response.status === 403) {
        const payload = await response
            .clone()
            .json()
            .catch(() => null) as { error?: string } | null;

        if (payload?.error === "Forbidden: account is not active.") {
            authFailureHandlerRef?.("inactive");
        }
    }

    return response;
}

export async function getAuthToken(): Promise<string | null> {
    const tokenGetter = await waitForAuthInterceptor();
    return tokenGetter ? await tokenGetter({ template: "jwt" }) : null;
}
