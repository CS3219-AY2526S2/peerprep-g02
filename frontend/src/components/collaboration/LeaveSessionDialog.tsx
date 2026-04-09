import { useEffect, useRef } from "react";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

interface LeaveSessionDialogProps {
    open: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function LeaveSessionDialog({ open, onCancel, onConfirm }: LeaveSessionDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null);

    // Focus the cancel button when the dialog opens
    useEffect(() => {
        if (open) {
            cancelRef.current?.focus();
        }
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-dialog-title"
            onClick={onCancel}
            onKeyDown={(e) => {
                if (e.key === "Escape") onCancel();
            }}
        >
            <Card
                className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#1e293b] p-0 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <CardContent className="p-8">
                    <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-red-500/15">
                        <LogOut className="size-7 text-red-400" />
                    </div>
                    <CardTitle id="leave-dialog-title" className="mb-2 text-2xl font-bold text-white">
                        Leave Session?
                    </CardTitle>
                    <CardDescription className="text-base text-slate-400">
                        Are you sure you want to leave this collaboration session? You will not be
                        able to rejoin once you leave.
                    </CardDescription>
                    <div className="mt-8 flex items-center justify-end gap-3">
                        <Button
                            ref={cancelRef}
                            variant="ghost"
                            size="lg"
                            className="rounded-2xl px-6 text-slate-300 hover:bg-white/10 hover:text-white"
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="lg"
                            className="rounded-2xl bg-red-500 px-6 text-white hover:bg-red-400"
                            onClick={onConfirm}
                        >
                            Leave Session
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
