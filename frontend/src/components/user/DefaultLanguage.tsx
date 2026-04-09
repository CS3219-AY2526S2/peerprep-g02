import { useMemo, useState } from "react";

import { useUser } from "@clerk/clerk-react";

import { Language, LANGUAGE_OPTIONS } from "@/models/matching/matchingDetailsType";

const CLERK_FONT_FAMILY = "var(--clerk-font-family, inherit)";

function languageIcon(language: Language): string {
    switch (language) {
        case "Python":
            return "\u{1F40D}";
        case "Java":
            return "\u2615";
        case "C++":
            return "\u{1F4A0}";
        case "JavaScript":
            return "\u{1F7E8}";
        case "TypeScript":
            return "\u{1F7E6}";
        case "Go":
            return "\u{1F439}";
        case "Rust":
            return "\u{1F980}";
        default:
            return "\u{1F4BB}";
    }
}

export default function DefaultLanguage() {
    const { isLoaded, user } = useUser();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const currentLanguage = useMemo((): Language => {
        const metadata = (user?.unsafeMetadata || {}) as Record<string, unknown>;
        const value = metadata.defaultLanguage;

        const isValidLanguage =
            typeof value === "string" && (LANGUAGE_OPTIONS as readonly string[]).includes(value);

        return isValidLanguage ? (value as Language) : "Python";
    }, [user]);

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
            // keep UI unchanged on failure
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
