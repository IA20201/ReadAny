/**
 * StreamingIndicator — shows current AI processing status with animation
 */
import { Brain, Loader2, Wrench } from "lucide-react";

interface StreamingIndicatorProps {
  step: "thinking" | "tool_calling" | "responding" | "idle";
  className?: string;
}

const STEP_LABELS = {
  thinking: "正在思考...",
  tool_calling: "调用工具中...",
  responding: "正在回复...",
  idle: "",
};

export function StreamingIndicator({ step, className }: StreamingIndicatorProps) {
  if (step === "idle") return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${className || ""}`}>
      {step === "thinking" && (
        <>
          <Brain className="h-4 w-4 animate-pulse text-violet-500" />
          <span className="text-xs text-violet-600">{STEP_LABELS.thinking}</span>
        </>
      )}
      {step === "tool_calling" && (
        <>
          <Wrench className="h-4 w-4 animate-spin text-blue-500" />
          <span className="text-xs text-blue-600">{STEP_LABELS.tool_calling}</span>
        </>
      )}
      {step === "responding" && (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          <span className="text-xs text-emerald-600">{STEP_LABELS.responding}</span>
        </>
      )}
    </div>
  );
}
