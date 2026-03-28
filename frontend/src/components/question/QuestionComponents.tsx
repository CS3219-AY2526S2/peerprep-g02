// components/CustomDiv.tsx
import { cn } from "@/lib/utils";

interface CustomDivProps extends React.HTMLAttributes<HTMLDivElement> {}

export function BorderedDiv({ className, ...props }: CustomDivProps) {
  return (
    <div
      className={cn(
        "mx-8 my-4 border-4 border-grey-200 rounded-[25px] p-[25px] bg-white",
        className
      )}
      {...props}
    />
  );
}