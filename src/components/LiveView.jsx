import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

export default function LiveView({ sessionId }) {
  const [screenshot, setScreenshot] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const fetchScreenshot = async () => {
      try {
        const res = await base44.functions.invoke("engineAction", { action: "get_screenshot", sessionId });
        if (res.data?.base64) {
          setScreenshot(`data:image/png;base64,${res.data.base64}`);
          setError(null);
        }
      } catch (e) { setError(e.message); }
    };
    fetchScreenshot();
    timerRef.current = setInterval(fetchScreenshot, 3000);
    return () => clearInterval(timerRef.current);
  }, [sessionId]);

  if (error) return <p className="text-center py-8 text-red-600 text-sm">Error: {error}</p>;

  return (
    <div className="space-y-2">
      {screenshot ? (
        <img src={screenshot} alt="Live view" className="w-full rounded-lg border" />
      ) : (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      )}
      <p className="text-xs text-muted-foreground text-center">Refreshing every 3 seconds</p>
    </div>
  );
}