import { ArrowRight, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { RejoinSessionCardProps } from "@/models/matching/rejoinSessionType";

export function RejoinSessionView({ session, onRejoin }: RejoinSessionCardProps) {
    return (
        <Card className="overflow-hidden rounded-[24px] border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-violet-50 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-8">
                <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                        <Radio className="size-6" />
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-900">
                            You have an active session
                        </p>
                    </div>
                </div>
                <Button
                    className="h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 text-base font-semibold text-white shadow-md hover:from-indigo-500 hover:to-violet-500"
                    onClick={() => onRejoin(session.collaborationId)}
                >
                    Rejoin Session
                    <ArrowRight className="ml-2 size-4" />
                </Button>
            </div>
        </Card>
    );
}
