# Internal Auth Usage

## Frontend

Use `apiFetch` for backend calls so Clerk bearer token is attached automatically via the
interceptor:

```ts
import { apiFetch } from "../../lib/apiClient";

const res = await apiFetch("/users/me", { method: "GET" });
```

## Backend (Service-to-Service)

For protected cross-service checks, call user service internal auth endpoint:

```ts
const r = await fetch("http://localhost:3001/v1/api/users/internal/authz/context", {
    headers: {
        authorization: req.headers.authorization ?? "",
        "x-internal-service-key": process.env.INTERNAL_SERVICE_API_KEY ?? "",
    },
});

if (!r.ok) return res.status(r.status).json(await r.json());

const authz = await r.json();

if (authz.data.status !== "active") {
    return res.status(403).json({ error: "Forbidden: account is not active." });
}

if (authz.data.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: admin role required." });
}
```

## Typical Response

```json
{
    "data": {
        "clerkUserId": "user_3AF6zTXUjTaLyJWrXbE2PnfcVC6",
        "role": "user",
        "status": "active"
    }
}
```
