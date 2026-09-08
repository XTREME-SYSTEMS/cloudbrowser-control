import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StepIndicator({ steps, currentIndex }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((s, i) => {
        const completed = i < currentIndex;
        const isCurrent = i === currentIndex;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center">
            <div className={cn("flex flex-col items-center gap-1", !isCurrent && !completed && "opacity-40")}>
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                completed ? "bg-primary text-primary-foreground" :
                isCurrent ? "bg-primary/20 border-2 border-primary text-primary" :
                "bg-accent text-muted-foreground"
              )}>
                {completed ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider hidden md:block">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("w-8 md:w-12 h-0.5 mx-1", completed ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}