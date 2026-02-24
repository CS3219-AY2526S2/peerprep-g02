import { SignIn } from "@clerk/clerk-react";

export default function Login() {
    return (
        <section className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8">
            <SignIn
                appearance={{
                    elements: {
                        card: "shadow-lg border border-border",
                    },
                }}
                routing="path"
                path="/account/login"
                signUpUrl="/account/register"
                forceRedirectUrl="/account/profile"
            />
        </section>
    );
}
