import { cn } from "@/lib/utils";

export function BorderedDiv({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "mx-8 my-4 border-4 border-grey-200 rounded-[25px] p-[25px] bg-white",
                className,
            )}
            {...props}
        />
    );
}
