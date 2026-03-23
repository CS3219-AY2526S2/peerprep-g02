import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@clerk/clerk-react";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { ROUTES } from "@/constants/routes";
import { apiFetch } from "@/utils/apiClient";
import { pushToast } from "@/utils/toast";

type UserRole = "user" | "admin" | "super_user";

interface ProtectedRouteProps {
    allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
    const { isLoaded, isSignedIn, userId } = useAuth();

    const requiresRoleCheck = Boolean(allowedRoles?.length);

    const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
    const [hasFetchedRole, setHasFetchedRole] = useState(false);

    useEffect(() => {
        if (!requiresRoleCheck || !isLoaded || !isSignedIn) {
            return;
        }

        let isCancelled = false;

        void apiFetch(API_ENDPOINTS.USERS.ME, { method: "GET" })
            .then(async (response) => {
                if (isCancelled) return;

                const payload = await response.json().catch(() => null);

                if (!response.ok) {
                    setCurrentRole(null);
                    pushToast({
                        tone: "error",
                        message: payload?.error || "Failed to verify your account permissions.",
                    });
                    return;
                }

                const role = payload?.data?.user?.role;

                if (role === "user" || role === "admin" || role === "super_user") {
                    setCurrentRole(role);
                } else {
                    setCurrentRole(null);
                    pushToast({
                        tone: "error",
                        message: "Unable to determine your account role.",
                    });
                }
            })
            .catch(() => {
                if (!isCancelled) {
                    setCurrentRole(null);
                    pushToast({
                        tone: "error",
                        message: "A network error occurred while verifying your role.",
                    });
                }
            })
            .finally(() => {
                if (!isCancelled) {
                    setHasFetchedRole(true);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [isLoaded, isSignedIn, userId, requiresRoleCheck]);

    const isCheckingRole = requiresRoleCheck && isSignedIn && isLoaded && !hasFetchedRole;

    if (!isLoaded || isCheckingRole) {
        return null;
    }

    if (!isSignedIn) {
        return <Navigate to={ROUTES.LOGIN} replace />;
    }

    if (requiresRoleCheck && (!currentRole || !allowedRoles?.includes(currentRole))) {
        return <Navigate to={ROUTES.DASHBOARD} replace />;
    }

    return <Outlet />;
};
