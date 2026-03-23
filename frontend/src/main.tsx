import { ClerkProvider } from "@clerk/clerk-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/App";
import "./index.css";
import { AuthInterceptorProvider } from "@/context/AuthInterceptorProvider";
import ToastHost from "@/components/toast/ToastHost";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
    throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in frontend environment.");
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/account/login">
            <AuthInterceptorProvider>
                <App />
                <ToastHost />
            </AuthInterceptorProvider>
        </ClerkProvider>
    </StrictMode>,
);
