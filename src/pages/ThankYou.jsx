import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, Rocket, ArrowRight } from "lucide-react";

export default function ThankYou() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState("checking"); // checking | confirmed | pending
  const checkoutId = params.get("checkoutId") || params.get("checkout_id");

  useEffect(() => {
    let attempts = 0;
    const checkStatus = async () => {
      attempts++;
      try {
        const purchases = await base44.entities.Base44Purchase.filter(
          { checkoutSessionId: checkoutId }
        ).catch(() => []);
        const purchase = purchases?.[0];
        if (purchase?.status === "paid") {
          setStatus("confirmed");
          return;
        }
        if (attempts < 10) {
          setTimeout(checkStatus, 2000);
        } else {
          setStatus("pending");
        }
      } catch {
        if (attempts < 10) {
          setTimeout(checkStatus, 2000);
        } else {
          setStatus("pending");
        }
      }
    };
    if (checkoutId) {
      checkStatus();
    } else {
      setStatus("pending");
    }
  }, [checkoutId]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            {status === "checking" && (
              <>
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                <h1 className="text-2xl font-heading font-bold">Confirming your payment…</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                  We're verifying your subscription. This usually takes a few seconds.
                </p>
              </>
            )}
            {status === "confirmed" && (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-heading font-bold">Payment confirmed!</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                  Your subscription is now active. Let's set up your account.
                </p>
                <Button onClick={() => navigate("/welcome")} className="w-full mt-6">
                  <Rocket className="w-4 h-4 mr-1" /> Start Onboarding <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
            {status === "pending" && (
              <>
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 text-amber-600" />
                </div>
                <h1 className="text-2xl font-heading font-bold">Thanks for your purchase!</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                  Your payment is being processed. You'll receive an email confirmation shortly.
                  If you don't see your subscription activated within a few minutes, please contact support.
                </p>
                <Button onClick={() => navigate("/")} variant="outline" className="w-full mt-6">
                  Go to Dashboard
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}