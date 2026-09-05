import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, Users, Mail, TrendingUp, Target, Building2, Copy, CheckCircle2 } from 'lucide-react';

export default function MonetizationTab({ onRunAction, actionLoading }) {
  const [assets, setAssets] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [copied, setCopied] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p, c, m] = await Promise.all([
        base44.entities.DataAsset.list('-monetization_score', 50).catch(() => []),
        base44.entities.Prospect.list('-match_score', 50).catch(() => []),
        base44.entities.OutreachCampaign.list('-created_date', 20).catch(() => []),
        base44.entities.OutreachMessage.list('-scheduled_for', 100).catch(() => []),
      ]);
      setAssets(a || []);
      setProspects(p || []);
      setCampaigns(c || []);
      setMessages(m || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const stats = {
    totalAssets: assets.length,
    inOutreach: assets.filter(a => a.status === 'in_outreach').length,
    avgScore: assets.length > 0 ? Math.round(assets.reduce((s, a) => s + (a.monetization_score || 0), 0) / assets.length) : 0,
    totalValue: assets.reduce((s, a) => s + (a.estimated_value_usd || 0), 0),
    prospects: prospects.length,
    qualified: prospects.filter(p => p.status === 'qualified').length,
    avgMatch: prospects.length > 0 ? Math.round(prospects.reduce((s, p) => s + (p.match_score || 0), 0) / prospects.length) : 0,
    campaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    messagesScheduled: messages.filter(m => m.status === 'scheduled').length,
    totalPipeline: campaigns.reduce((s, c) => s + (c.offer_price_usd || 0) * (c.prospect_ids?.length || 0), 0),
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Run button */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Autonomous pipeline: intelligence → scored data assets → prospect discovery → branded outreach campaigns → 3-day follow-ups
        </p>
        <Button size="sm" onClick={() => onRunAction('runDataMonetizationCycle', {})} disabled={actionLoading !== null}>
          {actionLoading === 'runDataMonetizationCycle' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
          Run Monetization Cycle
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-500" /><span className="text-xs text-muted-foreground">Data Assets</span></div>
          <div className="text-xl font-bold">{stats.totalAssets}</div>
          <div className="text-xs text-muted-foreground">{stats.inOutreach} in outreach · {stats.avgScore} avg score</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-blue-500" /><span className="text-xs text-muted-foreground">Prospects</span></div>
          <div className="text-xl font-bold">{stats.prospects}</div>
          <div className="text-xs text-muted-foreground">{stats.qualified} qualified · {stats.avgMatch} avg match</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1"><Mail className="w-4 h-4 text-purple-500" /><span className="text-xs text-muted-foreground">Campaigns</span></div>
          <div className="text-xl font-bold">{stats.campaigns}</div>
          <div className="text-xs text-muted-foreground">{stats.activeCampaigns} active · {stats.messagesScheduled} msgs queued</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-orange-500" /><span className="text-xs text-muted-foreground">Pipeline Value</span></div>
          <div className="text-xl font-bold">${(stats.totalPipeline / 1000).toFixed(1)}K</div>
          <div className="text-xs text-muted-foreground">est. from campaign offers</div>
        </CardContent></Card>
      </div>

      {/* Campaigns */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Mail className="w-4 h-4" /> Outreach Campaigns ({campaigns.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {campaigns.map((c) => {
              const campaignProspects = prospects.filter(p => c.prospect_ids?.includes(p.id));
              const campaignMessages = messages.filter(m => m.campaign_id === c.id);
              const isExpanded = expandedCampaign === c.id;
              return (
                <div key={c.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 cursor-pointer" onClick={() => setExpandedCampaign(isExpanded ? null : c.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{c.name}</span>
                        <Badge variant="outline" className="text-xs">{c.status}</Badge>
                        <Badge variant="outline" className="text-xs">{c.brand_entity === 'hiddenpropertyintel' ? 'Hidden Property Intel' : 'Lead Gen Near You'}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {campaignProspects.length} prospects · ${c.offer_price_usd}/offer vs est. ${c.competitor_price_estimate_usd} competitor spend · 3-day follow-ups
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">{campaignMessages.length} messages</Badge>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-3 border-t pt-3">
                      {/* Email template */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">Email Template — Subject: {c.email_subject}</span>
                          <Button variant="ghost" size="sm" onClick={() => copyText(`${c.email_subject}\n\n${c.email_body_template}`, `email-${c.id}`)} className="h-6 text-xs">
                            {copied === `email-${c.id}` ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />} Copy
                          </Button>
                        </div>
                        <pre className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">{c.email_body_template}</pre>
                      </div>

                      {/* Proposal */}
                      {c.proposal_template && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">Branded Proposal</span>
                            <Button variant="ghost" size="sm" onClick={() => copyText(c.proposal_template, `prop-${c.id}`)} className="h-6 text-xs">
                              {copied === `prop-${c.id}` ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />} Copy
                            </Button>
                          </div>
                          <pre className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">{c.proposal_template}</pre>
                        </div>
                      )}

                      {/* Prospects */}
                      <div>
                        <span className="text-xs font-medium">Prospects ({campaignProspects.length}):</span>
                        <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                          {campaignProspects.map((p) => (
                            <div key={p.id} className="text-xs border rounded p-2 flex items-start gap-2">
                              <Building2 className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{p.company_name}</span>
                                  <Badge variant="outline" className="text-xs">{p.match_score}/100</Badge>
                                  <Badge variant="outline" className="text-xs">{p.status}</Badge>
                                </div>
                                <p className="text-muted-foreground">{p.contact_name} · {p.contact_email || 'no email'}</p>
                                <p className="text-muted-foreground">Budget est: ${p.estimated_data_budget_usd} · Providers: {(p.current_data_providers || []).join(', ') || 'unknown'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Scheduled messages */}
                      <div>
                        <span className="text-xs font-medium">Scheduled Messages ({campaignMessages.length}):</span>
                        <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                          {campaignMessages.map((m) => (
                            <div key={m.id} className="text-xs flex items-center gap-2 border rounded px-2 py-1">
                              <Badge variant="outline" className="text-xs">{m.message_type}</Badge>
                              <span className="text-muted-foreground truncate flex-1">{m.prospect_email || 'no email'}</span>
                              <Badge variant="outline" className="text-xs">{m.status}</Badge>
                              <span className="text-muted-foreground">{new Date(m.scheduled_for).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded p-2">
                        ⚠️ Messages are export-ready. The platform sends email from the app's own address, not from {c.sender_email}. Copy the templates above and send via your Google Workspace inbox, or export the prospect list for your email tool.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
            {campaigns.length === 0 && (
              <p className="text-xs text-muted-foreground">No campaigns yet. Run the monetization cycle to generate assets, discover prospects, and build outreach campaigns.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Assets */}
      {assets.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-500" /> Data Assets ({assets.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {assets.map((a) => (
                <div key={a.id} className="border rounded p-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{a.title}</span>
                    <Badge variant="outline" className="text-xs">{a.data_category}</Badge>
                    <Badge variant="outline" className="text-xs text-green-600">Score: {a.monetization_score}</Badge>
                    <Badge variant="outline" className="text-xs text-orange-600">${a.estimated_value_usd}</Badge>
                    <Badge variant="outline" className="text-xs">{a.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                  {a.ideal_buyer_description && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Ideal buyer: {a.ideal_buyer_description}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}