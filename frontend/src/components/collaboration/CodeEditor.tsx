import { Textarea } from "@/components/ui/textarea";

const EDITOR_PLACEHOLDERS: Record<string, string> = {
    javascript: "// Start coding in JavaScript...",
    typescript: "// Start coding in TypeScript...",
    python: "# Start coding in Python...",
    java: "// Start coding in Java...",
};

interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    language: string;
    disabled: boolean;
}

export default function CodeEditor({ value, onChange, language, disabled }: CodeEditorProps) {
    const placeholder =
        EDITOR_PLACEHOLDERS[language.toLowerCase()] ?? "// Start collaborating here...";

    return (
        <div className="border-b border-white/10 bg-black">
            <Textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="h-full min-h-[360px] resize-none rounded-none border-0 bg-black px-6 py-5 font-mono text-base leading-7 text-slate-100 shadow-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
            />
        </div>
    );
}
