import { XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { SessionEndedPayload } from "@/models/collaboration/collaborationType";

interface StatusBannersProps {
    sessionEnded: SessionEndedPayload | null;
    hasOfflineChanges: boolean;
    onReturnToDashboard: () => void;
    onSubmitOfflineChanges: () => void;
    onDiscardOfflineChanges: () => void;
}

export default function StatusBanners({
    sessionEnded,
    hasOfflineChanges,
    onReturnToDashboard,
    onSubmitOfflineChanges,
    onDiscardOfflineChanges,
}: StatusBannersProps) {
    return (
        <>
            {sessionEnded && (
                <div className="flex items-center justify-between border-b border-red-500/30 bg-red-500/10 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <XCircle className="size-5 text-red-400" />
                        <span className="font-medium text-red-300">
                            {sessionEnded.reason === "both_users_left"
                                ? "Session ended - both users have left"
                                : sessionEnded.reason === "inactivity_timeout"
                                  ? "Session ended due to inactivity"
                                  : "Session has ended"}
                        </span>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/50 bg-transparent text-red-300 hover:bg-red-500/20"
                        onClick={onReturnToDashboard}
                    >
                        Return to Dashboard
                    </Button>
                </div>
            )}

            {hasOfflineChanges && !sessionEnded && (
                <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-5 py-3">
                    <div className="flex items-center gap-3">
                        <span className="text-amber-300">
                            You have unsaved changes from when you were offline
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-500/50 bg-transparent text-amber-300 hover:bg-amber-500/20"
                            onClick={onSubmitOfflineChanges}
                        >
                            Submit Changes
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400 hover:text-slate-200"
                            onClick={onDiscardOfflineChanges}
                        >
                            Discard
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
