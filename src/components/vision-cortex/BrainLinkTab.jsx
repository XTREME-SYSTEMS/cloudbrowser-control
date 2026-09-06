import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, ArrowRight, ArrowLeft, CheckCircle2, XCircle, Clock, Zap, Copy, Activity } from 'lucide-react';

export default function BrainLinkTab({ onRunAction, actionLoading }) {
  const [syncLogs, setSyncLogs] = useState([]);
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [logs, cmds] = await Promise.all([
        base44.entities.BrainSyncLog.list('-synced_at', 50).catch(() => []),
        base44.entities.BrainCommand.list('-received_at', 30).catch(() => []),
      ]);
      setSyncLogs(logs || []);
      setCommands(cmds || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await base44.functions.invoke('testBrainConnection', {});
      setConnection(res);
    } catch (e) {
      setConnection({ ok: false, error: e.message });
    }
    setTesting(false);
  };

  const copyEndpoint = () => {
    navigator.clipboard.writeText('https://cloud-browser.base44.app/functions/receiveBrainCommand');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const outbound = syncLogs.filter(l => l.direction === 'eyes_to_brain');
  const inbound = syncLogs.filter(l => l.direction === 'brain_to_eyes');
  const successCount = outbound.filter(l => l.status === 'success').length;
  const failCount = outbound.filter(l => l.status === 'failed').length;
  const pendingCmds = commands.filter(c => c.status === 'pending').length;
  const executedCmds = commands.filter(c => c.status === 'executed').length;

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Architecture diagram */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-3 md:gap-6 flex-wrap text-center">
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Brain className="w-6 h-6 text-blue-500" />
              </div>
              <div className="text-xs font-medium">V-1 Brain</div>
              <div className="text-[10px] text-muted-foreground">thevisioncortex.com</div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                <ArrowRight className="w-4 h-4 text-green-500" />
                <ArrowLeft className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-[10px] text-muted-foreground">bi-directional</div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-orange-500" />
              </div>
              <div className="text-xs font-medium">V-2 Eyes</div>
              <div className="text-[10px] text-muted-foreground">cloud-browser.base44.app</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Eyes (this app) scrapes the web and pushes intelligence to the Brain. Brain analyzes, decides, and sends commands back to the Eyes.
          </p>
        </CardContent>
      </Card>

      {/* Connection test + actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={testConnection} disabled={testing}>
          {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
          Test Brain Connection
        </Button>
        <Button size="sm" onClick={() => onRunAction('syncToBrain', {})} disabled={actionLoading !== null}>
          {actionLoading === 'syncToBrain' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2 text-green-500" />}
          Push to Brain
        </Button>
        <Button size="sm" variant="outline" onClick={() => onRunAction('processBrainCommands', {})} disabled={actionLoading !== null}>
          {actionLoading === 'processBrainCommands' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2 text-purple-500" />}
          Process Brain Commands
        </Button>
      </div>

      {/* Connection result */}
      {connection && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              {connection.ok ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
              <span className="text-sm font-medium">{connection.ok ? 'Brain reachable' : 'Connection failed'}</span>
              {connection.response_time_ms && <Badge variant="outline" className="text-xs">{connection.response_time_ms}ms</Badge>}
            </div>
            {connection.error && <p className="text-xs text-red-500">{connection.error}</p>}
            {connection.brain_response && (
              <pre className="text-xs bg-muted/50 rounded p-2 mt-2 max-h-32 overflow-y-auto font-mono">{JSON.stringify(connection.brain_response, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1"><ArrowRight className="w-4 h-4 text-green-500" /><span className="text-xs text-muted-foreground">Pushed to Brain</span></div>
          <div className="text-xl font-bold">{outbound.length}</div>
          <div className="text-xs text-muted-foreground">{successCount} ok · {failCount} failed</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1"><ArrowLeft className="w-4 h-4 text-purple-500" /><span className="text-xs text-muted-foreground">From Brain</span></div>
          <div className="text-xl font-bold">{inbound.length}</div>
          <div className="text-xs text-muted-foreground">commands received</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /><span className="text-xs text-muted-foreground">Pending Commands</span></div>
          <div className="text-xl font-bold">{pendingCmds}</div>
          <div className="text-xs text-muted-foreground">awaiting execution</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-xs text-muted-foreground">Executed</span></div>
          <div className="text-xl font-bold">{executedCmds}</div>
          <div className="text-xs text-muted-foreground">commands run</div>
        </CardContent></Card>
      </div>

      {/* Brain webhook endpoint */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Brain → Eyes Webhook Endpoint</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">Give this URL + the VISION_CORTEX_INBOUND_API_KEY to the Brain (V-1) so it can push commands to the Eyes:</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted/50 rounded px-2 py-1 flex-1 truncate font-mono">https://cloud-browser.base44.app/functions/receiveBrainCommand</code>
            <Button variant="ghost" size="sm" onClick={copyEndpoint} className="h-7 text-xs">
              {copied ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />} Copy
            </Button>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 bg-amber-500/10 rounded p-2">
            ⚠️ The Brain needs a <code className="font-mono">syncFromEyes</code> function to receive our pushes, and a <code className="font-mono">brainHealth</code> function for connection tests. See the integration spec below.
          </p>
        </CardContent>
      </Card>

      {/* Command queue */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-purple-500" /> Brain Commands ({commands.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {commands.map((c) => (
              <div key={c.id} className="border rounded p-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{c.command_type}</Badge>
                  <Badge variant="outline" className="text-xs">{c.status}</Badge>
                  {c.brain_agent && <Badge variant="outline" className="text-xs">{c.brain_agent}</Badge>}
                  <span className="text-muted-foreground ml-auto">{new Date(c.received_at).toLocaleString()}</span>
                </div>
                {c.result_summary && <p className="mt-1 text-muted-foreground">{c.result_summary}</p>}
                {c.error_message && <p className="mt-1 text-red-500">{c.error_message}</p>}
                {c.payload && Object.keys(c.payload).length > 0 && (
                  <pre className="mt-1 bg-muted/50 rounded p-1 text-[10px] font-mono max-h-20 overflow-y-auto">{JSON.stringify(c.payload, null, 1)}</pre>
                )}
              </div>
            ))}
            {commands.length === 0 && <p className="text-xs text-muted-foreground">No commands received from the Brain yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Sync log */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Sync Log ({syncLogs.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-[40vh] overflow-y-auto">
            {syncLogs.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-xs border-b pb-1">
                {l.direction === 'eyes_to_brain' ? <ArrowRight className="w-3 h-3 text-green-500 shrink-0" /> : <ArrowLeft className="w-3 h-3 text-purple-500 shrink-0" />}
                <span className="text-muted-foreground truncate flex-1">{l.source_type}: {l.payload_summary}</span>
                {l.status === 'success' ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                <span className="text-muted-foreground shrink-0">{new Date(l.synced_at).toLocaleTimeString()}</span>
              </div>
            ))}
            {syncLogs.length === 0 && <p className="text-xs text-muted-foreground">No sync activity yet. Click "Push to Brain" to send intelligence.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}