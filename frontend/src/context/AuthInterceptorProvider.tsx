import React, { useEffect } from "react";

import { useAuth, useClerk } from "@clerk/clerk-react";

import { injectAuthFailureHandler, injectAuthInterceptor } from "@/utils/apiClient";
import { pushToast } from "@/utils/toast";

type Props = {
    children: React.ReactNode;
};

export function AuthInterceptorProvider({ children }: Props) {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const { signOut } = useClerk();

    useEffect(() => {
        if (!isLoaded) {
            return;
        }

        if (isSignedIn) {
            injectAuthInterceptor(async (options?: { template?: string }) => {
                return getToken(options);
            });
        } else {
            injectAuthInterceptor(undefined);
        }
    }, [getToken, isLoaded, isSignedIn]);

    useEffect(() => {
        if (!isLoaded) {
            return;
        }

        let hasHandledAuthFailure = false;

        injectAuthFailureHandler((reason) => {
            if (hasHandledAuthFailure || !isSignedIn) {
                return;
            }

            hasHandledAuthFailure = true;

            pushToast({
                tone: "error",
                message:
                    reason === "inactive"
                        ? "Your account has been suspended. Signing you out."
                        : "Your session has expired. Signing you out.",
            });

            void signOut({ redirectUrl: "/account/login" });
        });

        return () => {
            injectAuthFailureHandler(undefined);
        };
    }, [isLoaded, isSignedIn, signOut]);

    if (!isLoaded) {
        return null;
    }

    return <>{children}</>;
}
