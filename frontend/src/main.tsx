import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ClerkProvider } from "@clerk/clerk-react";

import ToastHost from "@/components/toast/ToastHost";

import "./index.css";

import { TopicProvider } from "./context/TopicProvider";
import { UseCaseProvider } from "./context/UsecaseContext";
import App from "@/App";
import { AuthInterceptorProvider } from "@/context/AuthInterceptorProvider";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
    throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in frontend environment.");
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/account/login">
            <AuthInterceptorProvider>
                <TopicProvider>
                    <UseCaseProvider>
                        <App />
                        <ToastHost />
                    </UseCaseProvider>
                </TopicProvider>
            </AuthInterceptorProvider>
        </ClerkProvider>
    </StrictMode>,
);
