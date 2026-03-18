import { SignUp } from "@clerk/clerk-react";

export default function Register() {
    return (
        <section className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8">
            <SignUp
                appearance={{
                    elements: {
                        card: "shadow-lg border border-border",
                    },
                }}
                routing="path"
                path="/account/register"
                signInUrl="/account/login"
                forceRedirectUrl="/account/profile"
            />
        </section>
    );
}
