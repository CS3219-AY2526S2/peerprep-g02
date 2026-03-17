type TokenGetter = (options?: { template?: string }) => Promise<string | null>;

type ApiRequestInit = RequestInit & {
    baseUrl?: string;
    tokenTemplate?: string;
    skipAuth?: boolean;
};

let getTokenRef: TokenGetter | undefined;

export function injectAuthInterceptor(getToken?: TokenGetter): void {
    getTokenRef = getToken;
}

function resolveUrl(
    path: string,
    baseUrl: string = import.meta.env.VITE_BACKEND_API_ENDPOINT,
): string {
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }

    const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
}

export function getOriginFromApiBase(
    baseUrl: string = import.meta.env.VITE_BACKEND_API_ENDPOINT,
): string {
    return new URL(baseUrl).origin;
}

// automatically injects auth token from Clerk
export async function apiFetch(path: string, init: ApiRequestInit = {}): Promise<Response> {
    const {
        baseUrl,
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

    return fetch(resolveUrl(path, baseUrl), {
        ...rest,
        headers,
        credentials: credentials ?? "include",
    });
}
