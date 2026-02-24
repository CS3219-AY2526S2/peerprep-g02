import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import Login from "./Login";
import Profile from "./Profile";
import Register from "./Register";

function HomeUserView() {
    const backendApiEndpoint = import.meta.env.VITE_BACKEND_API_ENDPOINT;

    return (
        <section className="app-shell">
            <h1>PeerPrep</h1>
            <p>Clerk testing</p>

            <SignedOut>
                <div className="link-row">
                    <a href="/account/login">Login</a>
                    <a href="/account/register">Register</a>
                </div>
            </SignedOut>

            <SignedIn>
                <div className="signed-in-row">
                    <UserButton />
                    <a href={`${backendApiEndpoint}/users/auth/me`}>
                        Check backend profile details
                    </a>
                </div>
            </SignedIn>
        </section>
    );
}

export function UserLoginView() {
    const pathname = window.location.pathname;

    if (pathname.startsWith("/account/login")) {
        return <Login />;
    }

    if (pathname.startsWith("/account/register")) {
        return <Register />;
    }

    if (pathname === "/account/profile") {
        return <Profile />;
    }

    return <HomeUserView />;
}

export default UserLoginView;
