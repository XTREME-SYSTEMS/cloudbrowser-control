import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Goal", "Target", "Details", "Generate", "Launch"];

export default function Timeline({ current, completed = [] }) {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center justify-between min-w-[640px] px-2">
        {STEPS.map((label, i) => {
          const isComplete = completed.includes(i);
          const isActive = current === i;
          const isFuture = !isComplete && !isActive;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              {/* Circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 shrink-0",
                    isComplete && "bg-primary border-primary text-primary-foreground",
                    isActive && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20 scale-110",
                    isFuture && "bg-background border-muted text-muted-foreground"
                  )}
                >
                  {isComplete ? <Check className="w-5 h-5" /> : <span className="text-sm font-bold">{i + 1}</span>}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    isActive ? "text-primary" : isComplete ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 -mt-5 rounded-full transition-colors duration-300">
                  <div className={cn("h-full rounded-full transition-colors duration-500", isComplete ? "bg-primary" : "bg-muted")} style={{ width: isComplete ? "100%" : isActive ? "50%" : "0%" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}