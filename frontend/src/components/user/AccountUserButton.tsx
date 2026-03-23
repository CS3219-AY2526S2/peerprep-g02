import { UserButton } from "@clerk/clerk-react";

import DefaultLanguage from "@/components/user/DefaultLanguage";
import DeleteAccount from "@/components/user/DeleteAccount";

const DotIcon = () => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
            <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z" />
        </svg>
    );
};

const TrashIcon = () => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor">
            <path d="M135.2 17.7C140.6 7.1 151.5 0 163.5 0h121c12 0 22.9 7.1 28.3 17.7L328 48H432c8.8 0 16 7.2 16 16s-7.2 16-16 16h-16L396.2 436.8C389.8 478.4 354.1 512 312 512H136c-42.1 0-77.8-33.6-84.2-75.2L32 80H16C7.2 80 0 72.8 0 64s7.2-16 16-16H120l15.2-30.3zM176 144c8.8 0 16 7.2 16 16V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V160c0-8.8 7.2-16 16-16zm96 16V400c0 8.8 7.2 16 16 16s16-7.2 16-16V160c0-8.8-7.2-16-16-16s-16 7.2-16 16z" />
        </svg>
    );
};

type AccountUserButtonProps = {
    role: string | null;
};

export default function AccountUserButton({ role }: AccountUserButtonProps) {
    return (
        <UserButton
            showName
            appearance={{
                elements: {
                    userButtonTrigger:
                        "rounded-full border border-slate-200 bg-white pl-2.5 pr-3 py-1.5 shadow-sm hover:bg-slate-50",
                    userButtonBox: "flex-row-reverse items-center gap-2",
                    userButtonOuterIdentifier: "text-left pr-0.5",
                    userButtonInnerIdentifier: "text-xs text-slate-500",
                },
            }}
        >
            <UserButton.UserProfilePage label="account" />
            <UserButton.UserProfilePage label="security" />
            <UserButton.UserProfilePage
                label="Default language"
                labelIcon={<DotIcon />}
                url="default-language"
            >
                <DefaultLanguage />
            </UserButton.UserProfilePage>
            {role && role !== "super_user" ? (
                <UserButton.UserProfilePage
                    label="Delete account"
                    labelIcon={<TrashIcon />}
                    url="delete-account"
                >
                    <DeleteAccount />
                </UserButton.UserProfilePage>
            ) : null}
        </UserButton>
    );
}
