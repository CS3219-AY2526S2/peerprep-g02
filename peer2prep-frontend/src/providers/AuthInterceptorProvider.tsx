import { useAuth } from "@clerk/clerk-react";
import React, { useEffect, useState } from "react";

import { injectAuthInterceptor } from "@/lib/apiClient";

type Props = {
    children: React.ReactNode;
};

export function AuthInterceptorProvider({ children }: Props) {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const [ready, setReady] = useState(false);

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

        setReady(true);

        return () => {
            injectAuthInterceptor(undefined);
        };
    }, [getToken, isLoaded, isSignedIn]);

    if (!ready) {
        return null;
    }

    return <>{children}</>;
}
