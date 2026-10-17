import { useState } from "react";
import { useNavigate } from "react-router-dom";
import OnboardingWizard from "@/components/client-lifecycle/OnboardingWizard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Shield, Zap, Clock } from "lucide-react";

export default function ClientOnboarding() {
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState(null);

  const handleComplete = (eng) => {
    setEngagement(eng);
    setTimeout(() => navigate(`/client-delivery?token=${eng.client_portal_token}`), 1500);
  };

  if (engagement) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-2xl font-heading">Engagement Initialized</h2>
        <p className="text-muted-foreground">Redirecting to your private delivery portal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero */}
      <div className="text-center space-y-3 py-6">
        <Badge variant="outline" className="text-xs"><Sparkles className="w-3 h-3 mr-1" /> Premium Client Onboarding</Badge>
        <h1 className="text-3xl font-heading font-bold text-gold-gradient">Let's Build Your Domination System</h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          A guided 5-step intake process that feeds our autonomous discovery engine. In under 5 minutes, you'll kick off a full intelligence pipeline that ends with a deployed, revenue-ready system.
        </p>
      </div>

      {/* Trust indicators */}
      <div className="grid grid-cols-3 gap-3 max-w-3xl mx-auto">
        <TrustCard icon={Clock} title="5-Minute Intake" desc="Guided wizard" />
        <TrustCard icon={Zap} title="Instant Discovery" desc="Pipeline starts immediately" />
        <TrustCard icon={Shield} title="Zero Risk" desc="Review before it deploys" />
      </div>

      <OnboardingWizard onComplete={handleComplete} />
    </div>
  );
}

function TrustCard({ icon: Icon, title, desc }) {
  return (
    <Card className="text-center py-3">
      <CardContent className="p-3 space-y-1">
        <Icon className="w-5 h-5 text-primary mx-auto" />
        <p className="text-xs font-display font-semibold">{title}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}