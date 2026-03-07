import { UserButton, useUser } from "@clerk/clerk-react";
import { useMemo, useState } from "react";

const LANGUAGE_OPTIONS = ["Python", "Java", "C++", "JavaScript", "TypeScript", "Go", "Rust"];
const CLERK_FONT_FAMILY = "var(--clerk-font-family, inherit)";

const DotIcon = () => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
            <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z" />
        </svg>
    );
};

function DefaultLanguageSection() {
    const { isLoaded, user } = useUser();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const currentLanguage = useMemo(() => {
        const metadata = (user?.unsafeMetadata || {}) as Record<string, unknown>;
        const value = metadata.defaultLanguage;
        return typeof value === "string" ? value : "";
    }, [user]);

    const languageIcon = (language: string) => {
        switch (language) {
            case "Python":
                return "🐍";
            case "Java":
                return "☕";
            case "C++":
                return "💠";
            case "JavaScript":
                return "🟨";
            case "TypeScript":
                return "🟦";
            case "Go":
                return "🐹";
            case "Rust":
                return "🦀";
            default:
                return "💻";
        }
    };

    const saveDefaultLanguage = async (language: string) => {
        if (!isLoaded || !user || !language) {
            return;
        }

        setIsSaving(true);
        try {
            const unsafeMetadata = (user.unsafeMetadata || {}) as Record<string, unknown>;
            await user.update({
                unsafeMetadata: {
                    ...unsafeMetadata,
                    defaultLanguage: language,
                },
            });
            setIsEditing(false);
        } catch {
            // noop: keep UI unchanged on save failure
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{ paddingTop: "0.35rem", fontFamily: CLERK_FONT_FAMILY }}>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr",
                    gap: "0.9rem",
                    alignItems: "start",
                }}
            >
                <p style={{ margin: 0, color: "#252525", fontSize: "0.84rem", fontWeight: 500 }}>
                    Default Language
                </p>
                <div>
                    <p
                        style={{
                            margin: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: "0.45rem",
                            fontWeight: 500,
                        }}
                    >
                        <span aria-hidden="true">{languageIcon(currentLanguage)}</span>
                        <span>{currentLanguage || "Not set"}</span>
                    </p>

                    {!isEditing ? (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            disabled={!isLoaded || !user || isSaving}
                            style={{
                                marginTop: "0.4rem",
                                border: "none",
                                background: "transparent",
                                color: "#252525",
                                fontSize: "0.74rem",
                                fontWeight: 600,
                                padding: 0,
                                cursor: "pointer",
                                fontFamily: CLERK_FONT_FAMILY,
                            }}
                        >
                            Change default language
                        </button>
                    ) : (
                        <div
                            style={{
                                marginTop: "0.55rem",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-start",
                                gap: "0.45rem",
                            }}
                        >
                            {LANGUAGE_OPTIONS.map((language) => (
                                <button
                                    key={language}
                                    type="button"
                                    onClick={() => void saveDefaultLanguage(language)}
                                    disabled={!isLoaded || !user || isSaving}
                                    style={{
                                        fontFamily: CLERK_FONT_FAMILY,
                                        padding: "0.25rem 0.55rem",
                                        borderRadius: "0.4rem",
                                        border: "1px solid #d1d5db",
                                        background:
                                            currentLanguage === language ? "#f3f4f6" : "#ffffff",
                                        cursor: "pointer",
                                        fontSize: "0.78rem",
                                    }}
                                >
                                    {language}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AccountUserButton() {
    return (
        <UserButton>
            <UserButton.UserProfilePage label="account" />
            <UserButton.UserProfilePage label="security" />
            <UserButton.UserProfilePage
                label="Default language"
                labelIcon={<DotIcon />}
                url="default-language"
            >
                <DefaultLanguageSection />
            </UserButton.UserProfilePage>
        </UserButton>
    );
}
