import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { useState } from "react";
import { apiFetch } from "../../lib/apiClient";

export default function Profile() {
    const [isLoading, setIsLoading] = useState(false);
    const [responseMessage, setResponseMessage] = useState("");

    const fetchProfile = async () => {
        setIsLoading(true);
        setResponseMessage("");

        try {
            const response = await apiFetch("/users/auth/me", {
                method: "GET",
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                setResponseMessage(
                    payload?.error || `Request failed with status ${response.status}.`,
                );
                return;
            }

            setResponseMessage(JSON.stringify(payload, null, 2));
        } catch (error) {
            setResponseMessage(
                error instanceof Error ? error.message : "Failed to call backend profile endpoint.",
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="app-shell">
            <SignedOut>
                <p>You are signed out.</p>
                <div className="link-row">
                    <a href="/account/login">Login</a>
                    <a href="/account/register">Register</a>
                </div>
            </SignedOut>

            <SignedIn>
                <h1>Your Profile</h1>
                <div className="signed-in-row">
                    <UserButton />
                    <button onClick={fetchProfile} disabled={isLoading} type="button">
                        Check backend profile details
                    </button>
                </div>
                {responseMessage ? <pre>{responseMessage}</pre> : null}
            </SignedIn>
        </section>
    );
}
