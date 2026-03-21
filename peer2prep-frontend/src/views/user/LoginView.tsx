import { SignIn } from "@clerk/clerk-react";
import { ROUTES } from "@/constants/routes";

export default function LoginView() {
    return (
        <section className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8">
            <SignIn
                appearance={{
                    elements: {
                        card: "shadow-lg border border-border",
                    },
                }}
                routing="path"
                path={ROUTES.LOGIN}
                signUpUrl={ROUTES.REGISTER}
                forceRedirectUrl={ROUTES.DASHBOARD}
            />
        </section>
    );
}
