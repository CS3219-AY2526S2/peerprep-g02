import { SignUp } from "@clerk/clerk-react";
import { ROUTES } from "@/constants/routes";

export default function RegisterView() {
    return (
        <section className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8">
            <SignUp
                appearance={{
                    elements: {
                        card: "shadow-lg border border-border",
                    },
                }}
                routing="path"
                path={ROUTES.REGISTER}
                signInUrl={ROUTES.LOGIN}
                forceRedirectUrl={ROUTES.PROFILE}
            />
        </section>
    );
}