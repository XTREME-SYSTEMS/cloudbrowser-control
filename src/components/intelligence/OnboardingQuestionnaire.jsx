import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Target, DollarSign, Clock, MapPin, Briefcase } from "lucide-react";

const INDUSTRIES = [
  "Emergency Home Services", "Epoxy / Flooring", "Roofing", "HVAC", "Plumbing",
  "Electrical", "Legal / Attorney", "Dental / Medical", "Real Estate",
  "Insurance", "Financial Services", "AI / Tech Consulting", "Marketing Agency",
  "E-commerce", "SaaS / Software", "Construction", "Solar / Energy",
  "Pest Control", "Landscaping", "Moving / Storage", "Auto Repair",
];

const GOALS = [
  "Identify new markets to enter", "Find qualified leads for my services",
  "Reverse engineer competitors", "Build brand and marketing campaigns",
  "Create content and ad creative", "Generate sales scripts and pitches",
  "Find investors or buyers", "Launch new products or services",
  "Dominate local search (SEO/GEO)", "Build automated lead gen systems",
];

const BUDGETS = ["< $5k/mo", "$5k-$25k/mo", "$25k-$100k/mo", "$100k+/mo"];
const TIMELINES = ["30 days", "90 days", "6 months", "1 year", "Ongoing"];

export default function OnboardingQuestionnaire({ onComplete }) {
  const [industry, setIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [geoFocus, setGeoFocus] = useState("National (all 50 states)");

  const toggleGoal = (g) => {
    setSelectedGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const handleStart = () => {
    const finalIndustry = industry === "Other" ? customIndustry : industry;
    if (!finalIndustry) return;
    onComplete({
      industry: finalIndustry,
      target_market: targetMarket,
      goals: selectedGoals.join(", "),
      budget_range: budget,
      timeline,
      geo_focus: geoFocus,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-5 h-5 text-primary" /> Step 1: Envision Your Intelligence Mission
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="flex items-center gap-1.5 mb-2"><Briefcase className="w-4 h-4" /> Industry Vertical</Label>
          <div className="flex flex-wrap gap-2">
            {INDUSTRIES.map(ind => (
              <button key={ind} onClick={() => setIndustry(ind)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  industry === ind ? "bg-primary/20 border-primary text-primary" : "bg-muted/30 border-border text-muted-foreground hover:border-primary/40"
                }`}>{ind}</button>
            ))}
          </div>
          {industry === "Other" && (
            <Input className="mt-2" placeholder="Enter your industry..." value={customIndustry} onChange={e => setCustomIndustry(e.target.value)} />
          )}
        </div>

        <div>
          <Label className="flex items-center gap-1.5 mb-2"><Target className="w-4 h-4" /> Target Market (who are you going after?)</Label>
          <Input placeholder="e.g. Roofing companies doing $2M+ revenue in storm-prone states" value={targetMarket} onChange={e => setTargetMarket(e.target.value)} />
        </div>

        <div>
          <Label className="flex items-center gap-1.5 mb-2"><Target className="w-4 h-4" /> What are your goals? (select all that apply)</Label>
          <div className="flex flex-wrap gap-2">
            {GOALS.map(g => (
              <button key={g} onClick={() => toggleGoal(g)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedGoals.includes(g) ? "bg-primary/20 border-primary text-primary" : "bg-muted/30 border-border text-muted-foreground hover:border-primary/40"
                }`}>{g}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="flex items-center gap-1.5 mb-2"><DollarSign className="w-4 h-4" /> Budget Range</Label>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map(b => (
                <button key={b} onClick={() => setBudget(b)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    budget === b ? "bg-primary/20 border-primary text-primary" : "bg-muted/30 border-border text-muted-foreground hover:border-primary/40"
                  }`}>{b}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1.5 mb-2"><Clock className="w-4 h-4" /> Timeline</Label>
            <div className="flex flex-wrap gap-2">
              {TIMELINES.map(t => (
                <button key={t} onClick={() => setTimeline(t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    timeline === t ? "bg-primary/20 border-primary text-primary" : "bg-muted/30 border-border text-muted-foreground hover:border-primary/40"
                  }`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1.5 mb-2"><MapPin className="w-4 h-4" /> Geographic Focus</Label>
            <Input placeholder="National, or specific states/regions" value={geoFocus} onChange={e => setGeoFocus(e.target.value)} />
          </div>
        </div>

        <Button onClick={handleStart} disabled={!industry || selectedGoals.length === 0} className="w-full">
          <Sparkles className="w-4 h-4 mr-2" /> Begin Intelligence Pipeline
        </Button>
      </CardContent>
    </Card>
  );
}