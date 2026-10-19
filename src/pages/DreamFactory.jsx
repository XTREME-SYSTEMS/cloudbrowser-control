import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lightbulb, Rocket, PenSquare, Megaphone, Building2, Share2, Moon, Activity, TrendingUp, DollarSign, Eye, Sparkles, Loader2, Brain, Target, Flame, AlertTriangle, Crosshair, KeyRound, Users, Swords, Search } from "lucide-react";

export default function DreamFactory() {
  const [factory, setFactory] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [content, setContent] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [corporation, setCorporation] = useState(null);
  const [socialAccounts, setSocialAccounts] = useState([]);
  const [discoveries, setDiscoveries] = useState([]);
  const [discoveryFilter, setDiscoveryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [niche, setNiche] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [f, i, c, camps, corps, social, disc] = await Promise.all([
        base44.entities.DreamFactory.list().catch(() => []),
        base44.entities.ProductIdea.list("-generated_date", 20).catch(() => []),
        base44.entities.ContentAsset.list("-generated_date", 20).catch(() => []),
        base44.entities.MarketingCampaign.list("-start_date", 10).catch(() => []),
        base44.entities.DigitalCorporation.list().catch(() => []),
        base44.entities.SocialMediaAccount.list().catch(() => []),
        base44.entities.DiscoveryResult.list("-generated_at", 100).catch(() => [])
      ]);
      setFactory(f[0] || null);
      setIdeas(i || []);
      setContent(c || []);
      setCampaigns(camps || []);
      setCorporation(corps[0] || null);
      setSocialAccounts(social || []);
      setDiscoveries(disc || []);
    } catch (e) {
      console.error("DreamFactory load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const runAction = async (action, payload = {}) => {
    setActionLoading(action);
    try {
      const res = await base44.functions.invoke(action, payload);
      if (res?.data) {
        await loadData();
        return res.data;
      }
    } catch (e) {
      console.error(`${action} error:`, e);
      alert(`${action} failed: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const stats = factory ? [
    { label: "Ideas Generated", value: factory.ideas_generated || 0, icon: Lightbulb, color: "text-yellow-500" },
    { label: "Systems Built", value: factory.systems_built || 0, icon: Rocket, color: "text-blue-500" },
    { label: "Content Created", value: factory.content_created || 0, icon: PenSquare, color: "text-purple-500" },
    { label: "Campaigns Launched", value: factory.campaigns_launched || 0, icon: Megaphone, color: "text-green-500" },
    { label: "Followers Gained", value: factory.followers_gained || 0, icon: TrendingUp, color: "text-pink-500" },
    { label: "Revenue", value: `$${(factory.revenue_generated || 0).toLocaleString()}`, icon: DollarSign, color: "text-emerald-500" },
    { label: "Digital Presence", value: `${factory.digital_presence_score || 0}/100`, icon: Eye, color: "text-cyan-500" },
    { label: "AI Agents", value: factory.corporation_agent_count || 0, icon: Building2, color: "text-orange-500" }
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" />
            Dream Factory
          </h1>
          <p className="text-muted-foreground mt-1">
            Autonomous idea generation, system building, marketing, and selling. Runs while you sleep.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={factory?.sleep_cycle_active ? "default" : "secondary"} className="gap-1">
            <Moon className="w-3 h-3" />
            {factory?.operating_mode || "dormant"}
          </Badge>
          <Badge variant={factory?.health_state === "healthy" ? "default" : "secondary"}>
            {factory?.health_state || "unbenchmarked"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`w-8 h-8 ${stat.color}`} />
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Master Autonomous Cycle
          </CardTitle>
          <CardDescription>
            Runs the full pipeline: discover trends, generate ideas, architect systems, create marketing, validate. Designed for overnight autonomous operation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Niche (optional, leave empty for auto-discover all)"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-input bg-transparent text-sm"
          />
          <Button
            onClick={() => runAction("runDreamFactoryCycle", { max_ideas: 3, auto_architect: true, auto_market: true, niche: niche || undefined })}
            disabled={actionLoading === "runDreamFactoryCycle"}
            className="gap-2"
            size="lg"
          >
            {actionLoading === "runDreamFactoryCycle" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Moon className="w-4 h-4" />}
            Run Full Sleep Cycle
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="discovery" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full">
          <TabsTrigger value="discovery" className="gap-1"><Search className="w-4 h-4" /> Discover</TabsTrigger>
          <TabsTrigger value="ideas" className="gap-1"><Lightbulb className="w-4 h-4" /> Ideas</TabsTrigger>
          <TabsTrigger value="content" className="gap-1"><PenSquare className="w-4 h-4" /> Content</TabsTrigger>
          <TabsTrigger value="marketing" className="gap-1"><Megaphone className="w-4 h-4" /> Marketing</TabsTrigger>
          <TabsTrigger value="corporation" className="gap-1"><Building2 className="w-4 h-4" /> Corporation</TabsTrigger>
          <TabsTrigger value="social" className="gap-1"><Share2 className="w-4 h-4" /> Social</TabsTrigger>
        </TabsList>

        <TabsContent value="discovery" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { type: "trend", label: "Trends", icon: Flame, desc: "Rising search trends & viral topics" },
              { type: "problem", label: "Problems", icon: AlertTriangle, desc: "Things people complain about" },
              { type: "niche", label: "Niches", icon: Crosshair, desc: "Underserved profitable areas" },
              { type: "keyword", label: "Keywords", icon: KeyRound, desc: "High-value SEO search terms" },
              { type: "opportunity", label: "Opportunities", icon: Target, desc: "Market gaps to exploit" },
              { type: "audience", label: "Audiences", icon: Users, desc: "Underserved user groups" },
              { type: "competitor", label: "Competitors", icon: Swords, desc: "Weak competitors to beat" },
            ].map((gen) => {
              const Icon = gen.icon;
              return (
                <Card key={gen.type} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="font-medium text-sm">{gen.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground flex-1">{gen.desc}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runAction("runDiscoveryGenerator", { generator_type: gen.type, count: 10, niche: niche || undefined })}
                      disabled={actionLoading === "runDiscoveryGenerator"}
                      className="gap-1.5 w-full"
                    >
                      {actionLoading === "runDiscoveryGenerator" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      Auto-Find {gen.label}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {discoveries.length > 0 && (
            <>
              <div className="flex items-center gap-2 flex-wrap pt-2">
                <span className="text-sm font-medium text-muted-foreground">Filter:</span>
                <Button
                  size="sm"
                  variant={discoveryFilter === "all" ? "default" : "outline"}
                  onClick={() => setDiscoveryFilter("all")}
                >
                  All ({discoveries.length})
                </Button>
                {["trend", "problem", "niche", "keyword", "opportunity", "audience", "competitor"].map((t) => {
                  const count = discoveries.filter((d) => d.discovery_type === t).length;
                  if (count === 0) return null;
                  return (
                    <Button
                      key={t}
                      size="sm"
                      variant={discoveryFilter === t ? "default" : "outline"}
                      onClick={() => setDiscoveryFilter(t)}
                      className="capitalize"
                    >
                      {t}s ({count})
                    </Button>
                  );
                })}
              </div>

              <div className="grid gap-3">
                {discoveries
                  .filter((d) => discoveryFilter === "all" || d.discovery_type === discoveryFilter)
                  .map((disc) => (
                    <Card key={disc.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="capitalize">{disc.discovery_type}</Badge>
                              {disc.trend_direction && (
                                <Badge variant="outline" className="capitalize gap-1">
                                  <TrendingUp className="w-3 h-3" /> {disc.trend_direction}
                                </Badge>
                              )}
                              {disc.competition_level && (
                                <Badge variant="outline" className="capitalize">Comp: {disc.competition_level}</Badge>
                              )}
                              {disc.monetization_potential && (
                                <Badge variant="outline" className="capitalize">Money: {disc.monetization_potential}</Badge>
                              )}
                            </div>
                            <h4 className="font-medium">{disc.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{disc.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-2xl font-bold text-primary">{disc.score}</div>
                            <div className="text-xs text-muted-foreground">score</div>
                          </div>
                        </div>
                        {disc.search_keywords && disc.search_keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {disc.search_keywords.slice(0, 8).map((kw, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                            ))}
                          </div>
                        )}
                        {disc.market_size && (
                          <p className="text-xs text-muted-foreground mt-2"><strong>Market:</strong> {disc.market_size}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </>
          )}

          {discoveries.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                No discoveries yet. Use the generators above to automatically find trends, problems, niches, keywords, opportunities, audiences, and competitors from across the web.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ideas" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => runAction("generateProductIdeas", { max_ideas: 10, niche: niche || undefined })} disabled={actionLoading === "generateProductIdeas"} className="gap-2">
              {actionLoading === "generateProductIdeas" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
              Scan Trends and Generate Ideas
            </Button>
          </div>
          {ideas.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No ideas yet. Run the trend scanner to discover what people are searching for.</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {ideas.map((idea) => (
                <Card key={idea.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          {idea.title}
                          {idea.world_changing_potential && <Badge className="gap-1"><Sparkles className="w-3 h-3" /> World-Changing</Badge>}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">{idea.problem_solved}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold text-primary">{idea.validation_score || 0}</div>
                        <div className="text-xs text-muted-foreground">validation</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">{idea.product_type}</Badge>
                      <Badge variant="secondary">{idea.industry}</Badge>
                      <Badge variant="secondary">Trend: {idea.trend_direction}</Badge>
                      <Badge variant="secondary">Score: {idea.google_trend_score}/100</Badge>
                      <Badge variant="secondary">Competition: {idea.competition_level}</Badge>
                      <Badge variant="secondary">{idea.monetization_model}</Badge>
                    </div>
                    {idea.solution_summary && <p className="text-sm mt-3 text-muted-foreground">{idea.solution_summary}</p>}
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" variant="outline" onClick={() => runAction("architectProductIdea", { idea_id: idea.id })} disabled={actionLoading === "architectProductIdea"} className="gap-1">
                        {actionLoading === "architectProductIdea" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
                        Architect System
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => runAction("runMarketingEngine", { product_idea_id: idea.id })} disabled={actionLoading === "runMarketingEngine"} className="gap-1">
                        {actionLoading === "runMarketingEngine" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Megaphone className="w-3 h-3" />}
                        Create Marketing Campaign
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => runAction("generateContentAtScale", { content_type: "blog_post", count: 5 })} disabled={actionLoading === "generateContentAtScale"} className="gap-2">
              {actionLoading === "generateContentAtScale" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenSquare className="w-4 h-4" />}
              Generate 5 Blog Posts
            </Button>
            <Button onClick={() => runAction("generateContentAtScale", { content_type: "social_post", count: 10, platform: "twitter" })} disabled={actionLoading === "generateContentAtScale"} variant="outline" className="gap-2">
              <Share2 className="w-4 h-4" /> Generate 10 Social Posts
            </Button>
            <Button onClick={() => runAction("generateContentAtScale", { content_type: "ad_copy", count: 5 })} disabled={actionLoading === "generateContentAtScale"} variant="outline" className="gap-2">
              <Megaphone className="w-4 h-4" /> Generate Ad Copy
            </Button>
          </div>
          {content.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No content yet. Generate blog posts, social media, or ad copy above.</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {content.map((asset) => (
                <Card key={asset.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{asset.title}</h4>
                        <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
                          <Badge variant="secondary">{asset.content_type}</Badge>
                          <Badge variant="secondary">{asset.platform}</Badge>
                          {asset.google_optimized && <Badge className="gap-1"><Sparkles className="w-3 h-3" /> Google Optimized</Badge>}
                          <Badge variant="outline">SEO: {asset.seo_score}/100</Badge>
                          <Badge variant="outline">Viral: {asset.viral_potential_score}/100</Badge>
                        </div>
                      </div>
                      <Badge variant={asset.status === "published" ? "default" : "secondary"}>{asset.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="marketing" className="space-y-4">
          {campaigns.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              No campaigns yet. Generate ideas first, then create a marketing campaign from any idea.
            </CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {campaigns.map((camp) => (
                <Card key={camp.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold">{camp.name}</h3>
                        <Badge variant="secondary" className="mt-1">{camp.campaign_type}</Badge>
                      </div>
                      <Badge variant={camp.status === "active" ? "default" : "secondary"}>{camp.status}</Badge>
                    </div>
                    {camp.target_market && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        {camp.target_market.demographics && <p><strong>Audience:</strong> {camp.target_market.demographics}</p>}
                        {camp.target_market.online_locations && <p><strong>Where they are:</strong> {Array.isArray(camp.target_market.online_locations) ? camp.target_market.online_locations.join(", ") : camp.target_market.online_locations}</p>}
                        {camp.target_market.search_terms && <p><strong>Searching for:</strong> {Array.isArray(camp.target_market.search_terms) ? camp.target_market.search_terms.join(", ") : camp.target_market.search_terms}</p>}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3 text-xs">
                      <Badge variant="outline">Reach: {(camp.projected_reach || 0).toLocaleString()}</Badge>
                      <Badge variant="outline">Conversions: {(camp.projected_conversions || 0).toLocaleString()}</Badge>
                      <Badge variant="outline">Channels: {(camp.channels || []).length}</Badge>
                      <Badge variant="outline">Presence Actions: {(camp.digital_presence_actions || []).length}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="corporation" className="space-y-4">
          {corporation ? (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold text-lg mb-2">{corporation.corporation_name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{corporation.corporation_mission || "Identify what people want and deliver it."}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(corporation.departments || []).map((dept, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-muted/30">
                      <div className="font-medium text-sm">{dept.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{dept.head_count} agents, {dept.active_tasks} active</div>
                    </div>
                  ))}
                </div>
                {(corporation.org_chart || []).length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-semibold">Agent Org Chart ({corporation.org_chart.length} agents)</h4>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {(corporation.org_chart || []).map((agent, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded border text-sm">
                          <Activity className={`w-3 h-3 ${agent.status === "active" ? "text-green-500" : "text-muted-foreground"}`} />
                          <span className="font-medium">{agent.agent_name}</span>
                          <Badge variant="secondary" className="text-xs">{agent.role}</Badge>
                          <Badge variant="outline" className="text-xs">{agent.department}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              Digital Corporation not yet formed. The corporation organizes thousands of AI agents into departments: research, engineering, marketing, sales, content, social media, SEO, analytics, support, operations, finance.
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          {socialAccounts.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Share2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              No social media accounts connected yet. Connect your accounts to enable autonomous posting across 20+ platforms.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {socialAccounts.map((acct) => (
                <Card key={acct.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium capitalize">{acct.platform}</span>
                      <Badge variant={acct.connected ? "default" : "secondary"}>{acct.connected ? "Connected" : "Disconnected"}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">@{acct.handle}</div>
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{acct.followers || 0} followers</span>
                      <span>{acct.posts_count || 0} posts</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}