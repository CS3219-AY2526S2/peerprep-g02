import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import SessionRoom from "@/components/collaboration/SessionRoom";
import { apiFetch } from "@/lib/apiClient";
import { pushToast } from "@/lib/toast";
import AdminPage from "@/components/user/admin/AdminPage";
import Login from "@/components/user/Login";
import Profile from "@/components/user/profile/Profile";
import Register from "@/components/user/Register";

export function UserLoginView() {
    const pathname = window.location.pathname;
    const { isLoaded, isSignedIn } = useAuth();
    const [adminRouteAllowed, setAdminRouteAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        if (pathname !== "/account/profile") {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get("unauthorized") !== "admin") {
            return;
        }

        // Defer to next tick so ToastHost is mounted and subscribed.
        window.setTimeout(() => {
            pushToast({
                tone: "error",
                message: "This route is only for admins.",
            });
        }, 0);

        window.history.replaceState({}, "", "/account/profile");
    }, [pathname]);

    useEffect(() => {
        if (pathname === "/account/profile" && isLoaded && !isSignedIn) {
            window.location.replace("/account/login");
        }
    }, [pathname, isLoaded, isSignedIn]);

    // admin route guard
    useEffect(() => {
        if (pathname !== "/account/admin") {
            setAdminRouteAllowed(null);
            return;
        }

        if (!isLoaded || !isSignedIn) {
            return;
        }

        let isCancelled = false;
        setAdminRouteAllowed(null);

        void apiFetch("/users/me", { method: "GET" })
            .then(async (response) => {
                if (isCancelled) {
                    return;
                }

                if (!response.ok) {
                    setAdminRouteAllowed(false);
                    window.location.replace("/account/profile");
                    return;
                }

                const payload = await response.json().catch(() => null);
                const role = payload?.data?.user?.role;
                if (role === "admin" || role === "super_user") {
                    setAdminRouteAllowed(true);
                    return;
                }

                setAdminRouteAllowed(false);
                window.location.replace("/account/profile?unauthorized=admin");
            })
            .catch(() => {
                if (isCancelled) {
                    return;
                }

                setAdminRouteAllowed(false);
                window.location.replace("/account/profile");
            });

        return () => {
            isCancelled = true;
        };
    }, [pathname, isLoaded, isSignedIn]);

    if (pathname.startsWith("/account/login")) {
        return <Login />;
    }

    if (pathname.startsWith("/account/register")) {
        return <Register />;
    }

    if (pathname === "/account/profile") {
        if (!isLoaded) {
            return null;
        }

        if (!isSignedIn) {
            return (
                <section className="app-shell">
                    <p>You are signed out.</p>
                    <div className="link-row">
                        <a href="/account/login">Login</a>
                        <a href="/account/register">Register</a>
                    </div>
                </section>
            );
        }

        return <Profile />;
    }

    if (pathname === "/account/admin") {
        if (!isLoaded) {
            return null;
        }

        if (!isSignedIn) {
            return (
                <section className="app-shell">
                    <p>You are signed out.</p>
                    <div className="link-row">
                        <a href="/account/login">Login</a>
                        <a href="/account/register">Register</a>
                    </div>
                </section>
            );
        }

        if (adminRouteAllowed !== true) {
            return null;
        }

        return <AdminPage />;
    }

    if (pathname.startsWith("/collaboration/session/")) {
        return <SessionRoom />;
    }

    return (
        <section className="app-shell">
            <h1>PeerPrep</h1>

            <div className="link-row">
                <a href="/account/login">Login</a>
                <a href="/account/register">Register</a>
            </div>
        </section>
    );
}

export default UserLoginView;
