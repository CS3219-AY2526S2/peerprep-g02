import { UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { CollaborationParticipant } from "@/models/collaboration/collaborationType";
import { getInitials } from "@/components/collaboration/utils";

interface ParticipantsPanelProps {
    participants: CollaborationParticipant[];
    getDisplayName: (userId: string) => string;
}

export default function ParticipantsPanel({
    participants,
    getDisplayName,
}: ParticipantsPanelProps) {
    return (
        <Card className="border border-white/10 bg-white/[0.03] py-0 shadow-none ring-0">
            <CardHeader className="px-6 pt-5 pb-0">
                <div className="flex items-center gap-3">
                    <UsersRound className="size-5 text-blue-300" />
                    <CardTitle className="text-xl font-semibold text-white">Participants</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pt-4 pb-5">
                {participants.map((participant) => {
                    const name = getDisplayName(participant.userId);
                    return (
                        <div
                            key={participant.userId}
                            className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3"
                        >
                            <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-sm font-bold text-slate-950">
                                {getInitials(name, participant.userId)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate font-semibold text-white">{name}</p>
                                    <Badge
                                        variant={
                                            participant.status === "connected"
                                                ? "success"
                                                : participant.status === "disconnected"
                                                  ? "warning"
                                                  : "destructive"
                                        }
                                        className="rounded-full"
                                    >
                                        {participant.status}
                                    </Badge>
                                </div>
                                <p className="mt-1 text-sm text-slate-400">
                                    {participant.connectionCount} active connection
                                    {participant.connectionCount === 1 ? "" : "s"}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
