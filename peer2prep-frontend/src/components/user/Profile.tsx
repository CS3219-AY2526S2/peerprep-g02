import { useAuth } from "@clerk/clerk-react";
import { useEffect, useRef } from "react";
import { apiFetch } from "../../lib/apiClient";
import AccountUserButton from "./AccountUserButton";

export default function Profile() {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const lastSyncedUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isLoaded || !isSignedIn || !userId) {
            return;
        }

        if (lastSyncedUserIdRef.current === userId) {
            return;
        }

        lastSyncedUserIdRef.current = userId;

        void apiFetch("/users/auth/me", { method: "GET" }).then(async (response) => {
            if (response.ok) {
                return;
            }

            const payload = await response.json().catch(() => null);
            const message = payload?.error || `Sync failed with status ${response.status}.`;
            console.error(message);
        }).catch((error) => {
            const message =
                error instanceof Error ? error.message : "Failed to auto-sync profile.";
            console.error(message);
        });
    }, [isLoaded, isSignedIn, userId]);

    return (
        <section className="app-shell">
            <h1>Your Profile</h1>
            <div className="signed-in-row">
                <AccountUserButton />
            </div>
        </section>
    );
}
