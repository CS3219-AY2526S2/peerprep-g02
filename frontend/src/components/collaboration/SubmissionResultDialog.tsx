import { useEffect, useState } from "react";

import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import type { SubmissionCompletePayload } from "@/models/collaboration/collaborationType";

interface SubmissionResultDialogProps {
    submissionResult: SubmissionCompletePayload | null;
    onReturnHome: () => void;
}

const REDIRECT_SECONDS = 5;

export function SubmissionResultDialog({
    submissionResult,
    onReturnHome,
}: SubmissionResultDialogProps) {
    const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

    useEffect(() => {
        if (!submissionResult) return;

        // Use a local counter and only call setState inside the interval callback
        let remaining = REDIRECT_SECONDS;
        const interval = setInterval(() => {
            remaining -= 1;
            setCountdown(Math.max(0, remaining));
            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 1000);

        return () => {
            clearInterval(interval);
            setCountdown(REDIRECT_SECONDS);
        };
    }, [submissionResult]);

    if (!submissionResult) return null;

    const passed = submissionResult.success;

    return (
        <Dialog open onOpenChange={() => {}}>
            <DialogContent
                showCloseButton={false}
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                className="sm:max-w-md bg-[#1e293b] border border-white/10 text-slate-100"
            >
                <DialogHeader className="items-center text-center">
                    {passed ? (
                        <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                    ) : (
                        <XCircle className="h-16 w-16 text-red-500" />
                    )}
                    <DialogTitle className="text-xl text-white">
                        {passed ? "All Tests Passed!" : "Some Tests Failed"}
                    </DialogTitle>
                    <DialogDescription className="text-base text-slate-300">
                        {submissionResult.testCasesPassed}/{submissionResult.totalTestCases} test
                        cases passed
                    </DialogDescription>
                </DialogHeader>

                <p className="text-center text-sm text-slate-400">
                    Returning to dashboard in {countdown}s...
                </p>

                <DialogFooter className="bg-[#162032] border-white/10">
                    <Button
                        onClick={onReturnHome}
                        className={
                            passed
                                ? "w-full bg-emerald-600 hover:bg-emerald-700"
                                : "w-full bg-red-600 hover:bg-red-700"
                        }
                    >
                        Return Home
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
