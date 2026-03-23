import React, { useEffect } from "react";

import { useAuth } from "@clerk/clerk-react";

import { injectAuthInterceptor } from "@/utils/apiClient";

type Props = {
    children: React.ReactNode;
};

export function AuthInterceptorProvider({ children }: Props) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

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

        return () => {
            injectAuthInterceptor(undefined);
        };
    }, [getToken, isLoaded, isSignedIn]);

    if (!isLoaded || !isSignedIn) {
        return null;
    }

    return <>{children}</>;
}
