import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";

export default function AiJobBuilder() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const generate = async () => {
    if (!prompt) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("aiBuildSteps", { prompt });
      setResult(res.data);
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  const useResult = async () => {
    if (!result?.steps) return;
    // Store in sessionStorage and navigate to JobBuilder
    sessionStorage.setItem("aiJobSteps", JSON.stringify(result));
    navigate("/jobs/new");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><Sparkles className="w-7 h-7" />AI Job Builder</h1>
        <p className="text-muted-foreground mt-1">Describe what you want to automate in plain English — AI generates the steps</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="e.g. Go to amazon.com, search for 'wireless headphones', sort by price low to high, and extract the top 10 product names and prices" />
          <Button onClick={generate} disabled={loading || !prompt} size="lg">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating steps...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Steps</>}
          </Button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Generated Steps</CardTitle>
              <Button onClick={useResult} size="sm"><ArrowRight className="w-4 h-4 mr-1" />Use in Job Builder</Button>
            </div>
          </CardHeader>
          <CardContent>
            {result.start_url && <p className="text-sm text-muted-foreground mb-3">Start URL: <code className="font-mono">{result.start_url}</code></p>}
            <div className="space-y-2">
              {(result.steps || []).map((step, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/40">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{step.name || step.action_type}</span>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {step.action_type}
                      {step.selector && ` → ${step.selector}`}
                      {step.value && ` → ${step.value}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}