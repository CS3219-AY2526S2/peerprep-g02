import { MouseEvent, PointerEvent, useState } from "react";

import { useClerk } from "@clerk/clerk-react";

import { apiFetch } from "@/utils/apiClient";
import { pushToast } from "@/utils/toast";

const CLERK_FONT_FAMILY = "var(--clerk-font-family, inherit)";

export default function DeleteAccount() {
    const { signOut } = useClerk();
    const [isDeleting, setIsDeleting] = useState(false);

    const deleteAccount = async () => {
        if (isDeleting) {
            return;
        }

        const confirmed = window.confirm(
            "Delete your account permanently? This action cannot be undone.",
        );
        if (!confirmed) {
            return;
        }

        setIsDeleting(true);

        try {
            const response = await apiFetch("/users/me", { method: "DELETE" });
            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                const message =
                    payload?.error || `Failed to delete account (status ${response.status}).`;
                pushToast({ message, tone: "error" });
                return;
            }

            await signOut({ redirectUrl: "/account/login" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete account.";
            pushToast({ message, tone: "error" });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
        // Keep the Clerk profile page open so inline error states remain visible.
        event.preventDefault();
        event.stopPropagation();
        void deleteAccount();
    };

    const stopPointerInteraction = (
        event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
    ) => {
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <div
            style={{ fontFamily: CLERK_FONT_FAMILY, paddingTop: "0.4rem" }}
            onMouseDown={stopPointerInteraction}
            onPointerDown={stopPointerInteraction}
        >
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#4b5563" }}>
                Permanently delete your PeerPrep account.
            </p>
            <button
                type="button"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                style={{
                    marginTop: "0.8rem",
                    border: "1px solid #ef4444",
                    background: "#ef4444",
                    color: "#ffffff",
                    borderRadius: "0.45rem",
                    padding: "0.45rem 0.7rem",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: CLERK_FONT_FAMILY,
                    opacity: isDeleting ? 0.6 : 1,
                }}
            >
                {isDeleting ? "Deleting..." : "Delete account"}
            </button>
        </div>
    );
}
