import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";

export default function Profile() {
    const backendApiEndpoint = import.meta.env.VITE_BACKEND_API_ENDPOINT;
    return (
        <main className="app-shell">
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
                    <a href={`${backendApiEndpoint}/users/auth/me`}>
                        Check backend profile details
                    </a>
                </div>
            </SignedIn>
        </main>
    );
}
