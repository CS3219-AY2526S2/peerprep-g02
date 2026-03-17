import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
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
        <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex flex-col gap-2">
            {toasts.map((toast) => (
                <Card
                    key={toast.id}
                    className="max-w-sm border-0 px-4 py-3 text-sm leading-5 text-white shadow-2xl"
                    style={{ background: toneBackground(toast.tone) }}
                >
                    {toast.message}
                </Card>
            ))}
        </div>
    );
}
