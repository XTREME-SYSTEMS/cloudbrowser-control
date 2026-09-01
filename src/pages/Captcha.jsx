import { useState, useCallback } from "react";
import { Shield } from "lucide-react";
import CaptchaProviderConfig from "@/components/captcha/CaptchaProviderConfig";
import CaptchaTestRunner from "@/components/captcha/CaptchaTestRunner";
import CaptchaHistory from "@/components/captcha/CaptchaHistory";

export default function Captcha() {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><Shield className="w-7 h-7" />Captcha Solving System</h1>
        <p className="text-muted-foreground mt-1">Configure providers, test solvers, and track solve performance</p>
      </div>

      <CaptchaProviderConfig />
      <CaptchaTestRunner onTested={triggerRefresh} />
      <CaptchaHistory key={refreshKey} />
    </div>
  );
}