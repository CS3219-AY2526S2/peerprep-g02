import { SignedIn, SignedOut } from "@clerk/clerk-react";
import AccountUserButton from "./AccountUserButton";
import Login from "./Login";
import Profile from "./Profile";
import Register from "./Register";

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
                    <AccountUserButton />
                </div>
            </SignedIn>
        </section>
    );
}

export default UserLoginView;
