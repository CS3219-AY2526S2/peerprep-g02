import { useAuth } from "@clerk/clerk-react";
import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch } from "@/utils/apiClient";
import { ROUTES } from "@/constants/routes";
import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { pushToast } from "@/utils/toast";

interface ProtectedRouteProps {
    adminOnly?: boolean;
}

export const ProtectedRoute = ({ adminOnly = false }: ProtectedRouteProps) => {
    const { isLoaded, isSignedIn } = useAuth();
    const [adminRouteAllowed, setAdminRouteAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        if (!adminOnly || !isLoaded || !isSignedIn) {
            setAdminRouteAllowed(null);
            return;
        }

        let isCancelled = false;
        setAdminRouteAllowed(null);

        void apiFetch(API_ENDPOINTS.USERS.ME, { method: "GET" })
            .then(async (response) => {
                if (isCancelled) return;

                if (!response.ok) {
                    setAdminRouteAllowed(false);
                    pushToast({
                        tone: "error",
                        message: "Failed to verify administrator permissions.",
                    });
                    return;
                }

                const payload = await response.json().catch(() => null);
                const role = payload?.data?.user?.role;

                if (role === "admin" || role === "super_user") {
                    setAdminRouteAllowed(true);
                } else {
                    setAdminRouteAllowed(false);
                    pushToast({
                        tone: "error",
                        message: "Access denied: This area is for administrators only.",
                    });
                }
            })
            .catch(() => {
                if (!isCancelled) {
                    setAdminRouteAllowed(false);
                    pushToast({
                        tone: "error",
                        message: "A network error occurred while verifying your role.",
                    });
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [adminOnly, isLoaded, isSignedIn]);

    if (!isLoaded || (adminOnly && adminRouteAllowed === null)) {
        return null;
    }

    if (!isSignedIn) {
        return <Navigate to={ROUTES.LOGIN} replace />;
    }

    if (adminOnly && adminRouteAllowed === false) {
        return <Navigate to={ROUTES.PROFILE} replace />;
    }

    return <Outlet />;
};
