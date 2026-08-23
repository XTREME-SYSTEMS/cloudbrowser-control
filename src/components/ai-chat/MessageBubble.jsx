import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { CheckCircle, Loader2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";

function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const isFailed = ["failed", "error"].includes(toolCall.status);
  const isInProgress = ["pending", "running", "in_progress"].includes(toolCall.status);
  const StatusIcon = isFailed ? AlertCircle : isInProgress ? Loader2 : CheckCircle;
  const statusColor = isFailed ? "text-red-500" : isInProgress ? "text-yellow-500" : "text-green-500";

  let parsedResults = toolCall.results;
  if (typeof toolCall.results === "string") {
    try { parsedResults = JSON.parse(toolCall.results); } catch { /* keep raw */ }
  }

  const proj = toolCall.display_projection;
  if (proj?.hide_details && proj?.details_redacted) {
    return <div className={`mt-2 text-xs font-medium ${statusColor}`}>{isInProgress ? proj.active_label : isFailed ? proj.error_label : proj.label}</div>;
  }

  return (
    <div className="mt-2 text-xs border rounded-md p-2 bg-muted/50">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 w-full text-left">
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
        <StatusIcon className={`w-3 h-3 shrink-0 ${statusColor} ${isInProgress ? "animate-spin" : ""}`} />
        <span className="font-medium truncate">{toolCall.name}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1 ml-5">
          {toolCall.arguments_string && (
            <div><span className="text-muted-foreground">Args:</span> <pre className="mt-1 p-1 bg-muted rounded text-xs overflow-x-auto">{toolCall.arguments_string}</pre></div>
          )}
          {parsedResults != null && (
            <div><span className="text-muted-foreground">Result:</span> <pre className="mt-1 p-1 bg-muted rounded text-xs overflow-x-auto">{JSON.stringify(parsedResults, null, 2)}</pre></div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={`max-w-[80%] rounded-lg p-3 ${isUser ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
        {message.content && (isUser
          ? <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          : <ReactMarkdown className="text-sm prose prose-sm max-w-none">{message.content}</ReactMarkdown>
        )}
        {message.tool_calls?.map((tc, i) => <ToolCallDisplay key={i} toolCall={tc} />)}
      </div>
    </div>
  );
}