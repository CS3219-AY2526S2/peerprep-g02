export type ToastTone = "info" | "success" | "error";

export type Toast = {
    id: number;
    message: string;
    tone?: ToastTone;
    durationMs?: number;
};

type ToastListener = (toast: Toast) => void;

const listeners = new Set<ToastListener>();

export function subscribeToToast(listener: ToastListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function pushToast(input: Omit<Toast, "id">): void {
    const toast: Toast = {
        id: Date.now() + Math.floor(Math.random() * 100000),
        tone: input.tone ?? "info",
        durationMs: input.durationMs ?? 3500,
        message: input.message,
    };

    listeners.forEach((listener) => listener(toast));
}
