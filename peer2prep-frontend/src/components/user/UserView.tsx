import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import Login from "./Login";
import Profile from "./Profile";
import Register from "./Register";

export function UserLoginView() {
    const pathname = window.location.pathname;
    const { isLoaded, isSignedIn } = useAuth();

    useEffect(() => {
        if (pathname === "/account/profile" && isLoaded && !isSignedIn) {
            window.location.replace("/account/login");
        }
    }, [pathname, isLoaded, isSignedIn]);

    if (pathname.startsWith("/account/login")) {
        return <Login />;
    }

    if (pathname.startsWith("/account/register")) {
        return <Register />;
    }

    if (pathname === "/account/profile") {
        if (!isLoaded) {
            return null;
        }

        if (!isSignedIn) {
            return (
                <section className="app-shell">
                    <p>You are signed out.</p>
                    <div className="link-row">
                        <a href="/account/login">Login</a>
                        <a href="/account/register">Register</a>
                    </div>
                </section>
            );
        }

        return <Profile />;
    }

    return (
        <section className="app-shell">
            <h1>PeerPrep</h1>
            <p>Clerk testing</p>

            <div className="link-row">
                <a href="/account/login">Login</a>
                <a href="/account/register">Register</a>
            </div>
        </section>
    );
}

export default UserLoginView;
