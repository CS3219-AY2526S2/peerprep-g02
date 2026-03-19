import { useAuth } from "@clerk/clerk-react";
import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch } from "@/utils/apiClient";
import { ROUTES } from "@/constants/routes";
import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { pushToast } from "@/utils/toast";

type UserRole = "user" | "admin" | "super_user";

interface ProtectedRouteProps {
    allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
    const [isCheckingRole, setIsCheckingRole] = useState(Boolean(allowedRoles?.length));
    const requiresRoleCheck = Boolean(allowedRoles?.length);

    useEffect(() => {
        if (!requiresRoleCheck || !isLoaded || !isSignedIn) {
            setCurrentRole(null);
            setIsCheckingRole(false);
            return;
        }

        let isCancelled = false;
        setIsCheckingRole(true);

        void apiFetch(API_ENDPOINTS.USERS.ME, { method: "GET" })
            .then(async (response) => {
                if (isCancelled) {
                    return;
                }

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
                    return;
                }

                setCurrentRole(null);
                pushToast({
                    tone: "error",
                    message: "Unable to determine your account role.",
                });
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
                    setIsCheckingRole(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [isLoaded, isSignedIn, userId, requiresRoleCheck, allowedRoles]);

    if (!isLoaded || (requiresRoleCheck && isSignedIn && isCheckingRole)) {
        return null;
    }

    if (!isSignedIn) {
        return <Navigate to={ROUTES.LOGIN} replace />;
    }

    if (requiresRoleCheck && (!currentRole || !allowedRoles?.includes(currentRole))) {
        return <Navigate to={ROUTES.PROFILE} replace />;
    }

    return <Outlet />;
};
