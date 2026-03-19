import { useAuth } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/utils/apiClient";
import { ROUTES } from "@/constants/routes";
import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { pushToast } from "@/utils/toast";
import AccountUserButton from "@/components/user/AccountUserButton";

export default function ProfileView() {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const lastSyncedUserIdRef = useRef<string | null>(null);
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoaded || !isSignedIn || !userId) return;
        if (lastSyncedUserIdRef.current === userId) return;

        lastSyncedUserIdRef.current = userId;

        void apiFetch(API_ENDPOINTS.USERS.ME, { method: "GET" })
            .then(async (response) => {
                const payload = await response.json().catch(() => null);

                if (response.ok) {
                    const fetchedRole = payload?.data?.user?.role;
                    if (typeof fetchedRole === "string") {
                        setRole(fetchedRole);
                    }
                    return;
                }

                const message = payload?.error || `Sync failed (Status ${response.status})`;
                pushToast({ message, tone: "error" });
            })
            .catch((error) => {
                const message =
                    error instanceof Error ? error.message : "Failed to auto-sync profile.";
                pushToast({ message, tone: "error" });
            });
    }, [isLoaded, isSignedIn, userId]);

    const isAdmin = role === "admin" || role === "super_user";

    return (
        <section className="app-shell relative">
            <div className="fixed right-4 top-4 z-50">
                <AccountUserButton role={role} />
            </div>

            <div className="flex flex-col items-center pt-20">
                <h1 className="text-4xl font-bold text-gray-900">HOME PAGE</h1>

                {isAdmin && (
                    <div className="mb-3 mt-8 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-wrap justify-center gap-4">
                            <Link
                                to={ROUTES.USER_ADMIN}
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 focus:ring-2 focus:ring-gray-300"
                            >
                                Open User Admin
                            </Link>
                            <Link
                                to={ROUTES.QUESTION_ADMIN}
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 focus:ring-2 focus:ring-gray-300"
                            >
                                Open Question Admin
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
