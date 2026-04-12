import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProblemDescriptionProps {
    description: string | null;
}

export default function ProblemDescription({ description }: ProblemDescriptionProps) {
    return (
        <Card className="border border-white/10 bg-white/[0.03] py-0 shadow-none ring-0">
            <CardHeader className="px-6 pt-6">
                <CardTitle className="text-2xl font-semibold text-white">Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6 text-lg leading-8 text-slate-300">
                {(description ?? "Joining session and loading prompt...")
                    .split(/\n+/)
                    .filter(Boolean)
                    .map((paragraph, index) => (
                        <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
                    ))}
            </CardContent>
        </Card>
    );
}
