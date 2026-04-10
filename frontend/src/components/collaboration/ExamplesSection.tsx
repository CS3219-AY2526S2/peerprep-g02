import { Card, CardContent } from "@/components/ui/card";

interface ExampleCase {
    id: number;
    input: string;
    expectedOutput: string;
}

interface ExamplesSectionProps {
    testCases: ExampleCase[];
}

export default function ExamplesSection({ testCases }: ExamplesSectionProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Examples</h2>
            {testCases.length > 0 ? (
                testCases.map((testCase) => (
                    <Card
                        key={testCase.id}
                        className="border border-white/10 bg-white/[0.03] py-0 shadow-none ring-0"
                    >
                        <CardContent className="space-y-3 px-6 py-5 text-base text-slate-300">
                            <p className="text-lg font-semibold text-white">
                                Example {testCase.id}
                            </p>
                            <p>
                                <span className="font-semibold text-slate-200">Input:</span>{" "}
                                {testCase.input}
                            </p>
                            <p>
                                <span className="font-semibold text-slate-200">Output:</span>{" "}
                                {testCase.expectedOutput}
                            </p>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <Card className="border border-dashed border-white/10 bg-white/[0.02] py-0 shadow-none ring-0">
                    <CardContent className="px-6 py-5 text-slate-400">
                        Example cases will appear here once the problem details are loaded.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
