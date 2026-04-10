import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth, useUser } from "@clerk/clerk-react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import AccountUserButton from "@/components/user/AccountUserButton";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { ROUTES } from "@/constants/routes";
import { apiFetch } from "@/utils/apiClient";
import { pushToast } from "@/utils/toast";

import { RecentActivityView } from "@/views/dashboard/RecentActivityView";
import { MatchingView } from "@/views/matching/MatchingView";

type UserRole = "user" | "admin" | "super_user";

export default function HomeView() {
    const { isLoaded: isAuthLoaded, isSignedIn, userId } = useAuth();
    const { user } = useUser();
    const lastSyncedUserIdRef = useRef<string | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);

    const firstName = user?.firstName?.trim() || user?.username || "PeerPrep";
    const isAdmin = isSignedIn && (role === "admin" || role === "super_user");

    useEffect(() => {
        if (!isAuthLoaded || !isSignedIn || !userId) {
            lastSyncedUserIdRef.current = null;
            return;
        }

        if (lastSyncedUserIdRef.current === userId) {
            return;
        }

        lastSyncedUserIdRef.current = userId;

        void apiFetch(API_ENDPOINTS.USERS.ME, { method: "GET" })
            .then(async (response) => {
                const payload = await response.json().catch(() => null);

                if (!response.ok) {
                    pushToast({
                        tone: "error",
                        message: payload?.error || `Sync failed (status ${response.status})`,
                    });
                    return;
                }

                const fetchedRole = payload?.data?.user?.role;

                if (
                    fetchedRole === "user" ||
                    fetchedRole === "admin" ||
                    fetchedRole === "super_user"
                ) {
                    setRole(fetchedRole);
                }
            })
            .catch((error) => {
                const message =
                    error instanceof Error ? error.message : "Failed to sync account role.";
                pushToast({ message, tone: "error" });
            });
    }, [isAuthLoaded, isSignedIn, userId]);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.10),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#f4f7fb_100%)] text-slate-900">
            {/* Header Section */}
            <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5 lg:px-10">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                            <span className="text-2xl font-semibold">&lt;/&gt;</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                            <p className="text-3xl font-extrabold tracking-tight">PeerPrep</p>

                            <div className="flex flex-wrap items-center gap-2">
                                {isAdmin ? (
                                    <>
                                        <Button
                                            asChild
                                            variant="outline"
                                            className="rounded-full border-slate-300 bg-white px-4"
                                        >
                                            <Link to={ROUTES.USER_ADMIN}>User Admin</Link>
                                        </Button>
                                        <Button
                                            asChild
                                            variant="outline"
                                            className="rounded-full border-slate-300 bg-white px-4"
                                        >
                                            <Link to={ROUTES.QUESTION_ADMIN}>Question Admin</Link>
                                        </Button>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-5">
                        <Button
                            variant="ghost"
                            size="icon-lg"
                            className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                            <Bell className="size-5" />
                            <span className="sr-only">Notifications</span>
                        </Button>

                        <AccountUserButton role={role} />
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-12">
                <section className="mb-10">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
                        Welcome back, {firstName}! <span className="inline-block">👋</span>
                    </h1>
                    <p className="mt-3 text-lg text-slate-600">
                        Ready to sharpen your coding skills with a peer?
                    </p>
                </section>

                <div className="space-y-8">
                    <MatchingView />
                    <RecentActivityView />
                </div>
            </main>
        </div>
    );
}
