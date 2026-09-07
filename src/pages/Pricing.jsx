import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import { Check, Zap, Crown, Building2, Rocket, ArrowRight, Cloud, Sparkles, Loader2 } from "lucide-react";

const plans = [
  {
    name: "Free",
    icon: Cloud,
    price: "$0",
    period: "forever",
    description: "Try the platform. Minimal limits to test the waters.",
    cta: "Start for free",
    ctaLink: "/register",
    highlight: false,
    features: {
      infrastructure: [
        { label: "Concurrent browsers", value: "1" },
        { label: "Browser hours", value: "0.25" },
        { label: "Agent runs", value: "1" },
        { label: "Search calls", value: "50" },
        { label: "Fetch calls", value: "50" },
        { label: "Max session duration", value: "5 min" },
      ],
      capabilities: [
        { label: "Data retention", value: "1 day" },
        { label: "Model tokens", value: "None" },
        { label: "Runtime", value: "Shared" },
        { label: "Captcha solving", value: false },
        { label: "Stealth mode", value: false },
        { label: "Sandbox", value: false },
      ],
    },
  },
  {
    name: "Developer",
    icon: Zap,
    price: "$29",
    period: "/month",
    description: "Build and test real workflows. Prepare for production.",
    cta: "Get Developer",
    ctaLink: "/register?plan=developer",
    highlight: false,
    features: {
      infrastructure: [
        { label: "Concurrent browsers", value: "25" },
        { label: "Browser hours", value: "100", overage: "$0.12/hr" },
        { label: "Agent runs", value: "15" },
        { label: "Search calls", value: "1,000", overage: "$7/1k" },
        { label: "Fetch calls", value: "1,000", overage: "$1/1k" },
        { label: "Proxy bandwidth", value: "1 GB", overage: "$12/GB" },
      ],
      capabilities: [
        { label: "Data retention", value: "30 days" },
        { label: "Model Gateway", value: "Pay as you go" },
        { label: "Runtime", value: "Included" },
        { label: "Captcha solving", value: true },
        { label: "Stealth mode", value: "Basic" },
        { label: "Sandbox", value: "3 sandboxes" },
      ],
    },
  },
  {
    name: "Startup",
    icon: Rocket,
    price: "$99",
    period: "/month",
    description: "Run in production with room to grow and scale usage.",
    cta: "Get Startup",
    ctaLink: "/register?plan=startup",
    highlight: true,
    badge: "MOST POPULAR",
    features: {
      infrastructure: [
        { label: "Concurrent browsers", value: "100" },
        { label: "Browser hours", value: "500", overage: "$0.10/hr" },
        { label: "Agent runs", value: "50" },
        { label: "Search calls", value: "1,000", overage: "$7/1k" },
        { label: "Fetch calls", value: "10,000", overage: "$1/1k" },
        { label: "Proxy bandwidth", value: "5 GB", overage: "$10/GB" },
      ],
      capabilities: [
        { label: "Data retention", value: "30 days" },
        { label: "Model Gateway", value: "Pay as you go" },
        { label: "Runtime", value: "Included" },
        { label: "Captcha solving", value: true },
        { label: "Stealth mode", value: "Basic" },
        { label: "Sandbox", value: "10 sandboxes" },
      ],
    },
  },
  {
    name: "Enterprise",
    icon: Building2,
    price: "Custom",
    period: "",
    description: "Operate at scale with full control and infrastructure.",
    cta: "Contact sales",
    ctaLink: "/register?plan=enterprise",
    highlight: false,
    features: {
      infrastructure: [
        { label: "Concurrent browsers", value: "250+" },
        { label: "Browser hours", value: "500+", overage: "Usage-based" },
        { label: "Agent runs", value: "Custom" },
        { label: "Search calls", value: "10,000+", overage: "Usage-based" },
        { label: "Fetch calls", value: "10,000+", overage: "Usage-based" },
        { label: "Proxy bandwidth", value: "5+ GB", overage: "Usage-based" },
      ],
      capabilities: [
        { label: "Data retention", value: "30+ days" },
        { label: "Model Gateway", value: "Pay as you go" },
        { label: "Runtime", value: "Included" },
        { label: "Captcha solving", value: "Verified + solving" },
        { label: "Stealth mode", value: "Advanced" },
        { label: "Sandbox", value: "Unlimited" },
      ],
    },
  },
];

const faqs = [
  {
    q: "What does XTREME SCRAPER do?",
    a: "XTREME SCRAPER is the complete platform to build and deploy agents that browse and interact with the web like humans. We provide browser infrastructure, fetch/search APIs, AI agent building, website cloning, and MCP integration — all from one platform.",
  },
  {
    q: "What kinds of use cases do companies use XTREME SCRAPER for?",
    a: "Healthcare (insurance verification, claims processing), Financial Services (loan workflows, compliance), Real Estate (MLS sync, transaction automation), HR & Payroll (benefits, onboarding), and general business operations like data entry, migrations, and web scraping.",
  },
  {
    q: "Can I bring my own proxies?",
    a: "Yes. XTREME SCRAPER supports custom proxy configurations including residential proxies for geo-specific automation, rotating proxy pools for large-scale operations, and custom proxy authentication.",
  },
  {
    q: "What automation frameworks are supported?",
    a: "Playwright, Puppeteer, Selenium, and our own AI-powered Stagehand-style framework. All work out-of-the-box with our cloud infrastructure — no additional setup required.",
  },
  {
    q: "How does the AI agent builder work?",
    a: "Describe what you want in natural language. Our AI generates the browser automation steps, configures capabilities (captcha solving, proxies, stealth), and deploys your agent. Connect it to ChatGPT, Claude, or Gemini via MCP.",
  },
  {
    q: "What is the sandbox system?",
    a: "Every user gets isolated, Railway-provisioned backend environments. No DevOps required — we handle provisioning, scaling, and monitoring. Run scrapers, build agents, and clone websites in your own sandbox.",
  },
];

function FeatureValue({ value }) {
  if (value === true) return <Check className="w-4 h-4 text-emerald-500" />;
  if (value === false) return <span className="text-muted-foreground/40">—</span>;
  return <span className="text-sm font-medium">{value}</span>;
}

export default function Pricing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  const [checkoutPlan, setCheckoutPlan] = useState(null);

  const handleCheckout = async (planId) => {
    setCheckoutPlan(planId);
    try {
      const res = await base44.functions.invoke("create-checkout", { productId: planId });
      const redirectUrl = res.data?.redirectUrl;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        alert("Could not start checkout. Please try again.");
      }
    } catch (e) {
      alert(e.response?.data?.error || e.message || "Checkout failed");
    } finally {
      setCheckoutPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Image src="https://media.base44.com/images/public/6a837c8e995cc4824aabf594/392c402b4_LOGO.png" alt="XTREME SCRAPER" className="w-9 h-9 shrink-0" fittingType="fit" />
            <span className="font-heading font-bold text-lg">XTREME SCRAPER</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/register"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-16 pb-12 px-4 md:px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-amber-800 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Four plans. One platform.
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight">
            Browser agent infrastructure that scales with you
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free, grow without surprises. Every plan includes AI-assisted onboarding, MCP integration, and sandbox environments.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-4 md:px-8 pb-16">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col ${
                plan.highlight
                  ? "border-primary shadow-xl ring-2 ring-primary/20 scale-[1.02]"
                  : "border-border/50"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {plan.badge}
                </div>
              )}
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <plan.icon className="w-5 h-5 text-primary" />
                  <span className="font-heading font-semibold text-lg">{plan.name}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-heading font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Infrastructure</h4>
                    <div className="space-y-2">
                      {plan.features.infrastructure.map((f) => (
                        <div key={f.label} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{f.label}</span>
                          <div className="text-right">
                            <span className="font-medium">{f.value}</span>
                            {f.overage && (
                              <div className="text-xs text-muted-foreground/70">{f.overage}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">Capabilities</h4>
                    <div className="space-y-2">
                      {plan.features.capabilities.map((f) => (
                        <div key={f.label} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{f.label}</span>
                          <FeatureValue value={f.value} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  {plan.name === "Developer" || plan.name === "Startup" ? (
                    <Button
                      className="w-full"
                      variant={plan.highlight ? "default" : "outline"}
                      onClick={() => handleCheckout(plan.name.toLowerCase())}
                      disabled={checkoutPlan === plan.name.toLowerCase()}
                    >
                      {checkoutPlan === plan.name.toLowerCase() ? (
                        <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Redirecting…</>
                      ) : (
                        <>{plan.cta} <ArrowRight className="w-4 h-4 ml-1" /></>
                      )}
                    </Button>
                  ) : (
                    <Link to={plan.ctaLink}>
                      <Button className="w-full" variant={plan.highlight ? "default" : "outline"}>
                        {plan.cta} <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Comparison note */}
      <section className="px-4 md:px-8 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-muted-foreground">
            Not sure which plan fits?{" "}
            <span className="font-medium text-foreground">A browser hour goes further than you think.</span>
            {" "}A typical web scrape runs in under 2 minutes. 100 hours is roughly 3,000 page-level tasks.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 md:px-8 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <Card key={i} className="border-border/50">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left p-5 flex items-center justify-between"
                >
                  <span className="font-medium text-sm">{faq.q}</span>
                  <span className="text-muted-foreground text-xl">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 md:px-8 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gold-gradient p-12 text-center">
            <h2 className="text-3xl font-heading font-bold text-black">Ready to start building?</h2>
            <p className="mt-3 text-black/70">Get your API key in minutes. No credit card required.</p>
            <Link to="/register" className="mt-6 inline-block">
              <Button size="lg" variant="secondary">Get started free <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}