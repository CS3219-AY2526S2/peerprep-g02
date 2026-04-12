export type ActiveSession = {
    collaborationId: string;
    topic: string;
    difficulty: string;
};

export interface RejoinSessionCardProps {
    session: ActiveSession;
    onRejoin: (id: string) => void;
}
