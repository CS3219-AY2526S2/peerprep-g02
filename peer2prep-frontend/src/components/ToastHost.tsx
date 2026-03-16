import { useEffect, useMemo, useRef, useState } from "react";
import { subscribeToToast, Toast } from "@/lib/toast";

type ActiveToast = Toast;

function toneBackground(tone: Toast["tone"]): string {
    switch (tone) {
        case "success":
            return "#166534";
        case "error":
            return "#b91c1c";
        default:
            return "#1f2937";
    }
}

export default function ToastHost() {
    const [toasts, setToasts] = useState<ActiveToast[]>([]);
    const timeoutIdsRef = useRef<number[]>([]);

    useEffect(() => {
        const unsubscribe = subscribeToToast((toast) => {
            setToasts((current) => [...current, toast]);

            const timeoutId = window.setTimeout(() => {
                setToasts((current) => current.filter((item) => item.id !== toast.id));
                timeoutIdsRef.current = timeoutIdsRef.current.filter((id) => id !== timeoutId);
            }, toast.durationMs ?? 3500);

            timeoutIdsRef.current.push(timeoutId);
        });

        return () => {
            unsubscribe();
            timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
            timeoutIdsRef.current = [];
        };
    }, []);

    const hasToasts = useMemo(() => toasts.length > 0, [toasts.length]);
    if (!hasToasts) {
        return null;
    }

    return (
        <div
            style={{
                position: "fixed",
                top: "1rem",
                right: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                zIndex: 9999,
                pointerEvents: "none",
            }}
        >
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    style={{
                        maxWidth: "22rem",
                        background: toneBackground(toast.tone),
                        color: "#fff",
                        borderRadius: "0.5rem",
                        padding: "0.6rem 0.8rem",
                        boxShadow: "0 10px 20px rgba(0,0,0,0.25)",
                        fontSize: "0.85rem",
                        lineHeight: 1.3,
                    }}
                >
                    {toast.message}
                </div>
            ))}
        </div>
    );
}
