import { CheckCircle, AlertCircle, Loader2, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function IntegrationCard({ name, description, icon: Icon, status, lastSynced, onConnect, onDisconnect }) {
  const isConnected = status === "connected";
  const isError = status === "error";
  const StatusIcon = isConnected ? CheckCircle : isError ? AlertCircle : Loader2;
  const statusColor = isConnected ? "text-green-500" : isError ? "text-red-500" : "text-muted-foreground";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium">{name}</h3>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <StatusIcon className={`w-5 h-5 ${statusColor} ${!isConnected && !isError ? "animate-spin" : ""}`} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {isConnected ? `Connected${lastSynced ? ` · ${lastSynced}` : ""}` : isError ? "Connection error" : "Not connected"}
          </span>
          {isConnected ? (
            <Button variant="outline" size="sm" onClick={onDisconnect}>
              <Unlink className="w-3.5 h-3.5" /> Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={onConnect}>
              <Link2 className="w-3.5 h-3.5" /> Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}