/*
FRONTEND
Use apiFetch everywhere:
import { apiFetch } from "../../lib/apiClient";
const res = await apiFetch("/users/auth/me", { method: "GET" });

BACKEND
const r = await fetch("http://localhost:3001/v1/api/users/internal/authz/context", {
  headers: {
    authorization: req.headers.authorization ?? "",
    "x-internal-service-key": process.env.INTERNAL_SERVICE_API_KEY ?? "",
  },
});

if (!r.ok) return res.status(r.status).json(await r.json());

const authz = await r.json();

// Active check
if (authz.data.status !== "active") {
  return res.status(403).json({ error: "Forbidden: account is not active." });
}

// Admin check
if (authz.data.role !== "admin") {
  return res.status(403).json({ error: "Forbidden: admin role required." });
}

TYPICAL RESPONSE FORMAT (JSON)
{
    "data": {
        "clerkUserId": "user_3AF6zTXUjTaLyJWrXbE2PnfcVC6",
        "role": "user" / "admin",
        "status": "active"
    }
}
*/
