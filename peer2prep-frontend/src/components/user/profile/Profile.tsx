import { useAuth } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../lib/apiClient";
import AccountUserButton from "./AccountUserButton";

export default function Profile() {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const lastSyncedUserIdRef = useRef<string | null>(null);
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoaded || !isSignedIn || !userId) {
            return;
        }

        if (lastSyncedUserIdRef.current === userId) {
            return;
        }

        lastSyncedUserIdRef.current = userId;

        void apiFetch("/users/me", { method: "GET" })
            .then(async (response) => {
                if (response.ok) {
                    const payload = await response.json().catch(() => null);
                    const fetchedRole = payload?.data?.user?.role;
                    if (typeof fetchedRole === "string") {
                        setRole(fetchedRole);
                    }
                    return;
                }

                const payload = await response.json().catch(() => null);
                const message = payload?.error || `Sync failed with status ${response.status}.`;
                console.error(message);
            })
            .catch((error) => {
                const message =
                    error instanceof Error ? error.message : "Failed to auto-sync profile.";
                console.error(message);
            });
    }, [isLoaded, isSignedIn, userId]);

    return (
        <section className="app-shell relative">
            <div className="fixed right-4 top-4 z-50">
                <AccountUserButton role={role} />
            </div>
            <h1>HOME PAGE</h1>
            {role === "admin" || role === "super_user" ? (
                <div className="mb-3 mt-5 flex justify-center">
                    <a
                        href="/account/admin"
                        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                        Open Admin Page
                    </a>
                </div>
            ) : null}
        </section>
    );
}
