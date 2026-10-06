import { useState } from "react";
import { Globe, Hash, Bot } from "lucide-react";
import DirectoryDiscovery from "@/components/social-presence/DirectoryDiscovery";
import HashtagCampaigns from "@/components/social-presence/HashtagCampaigns";
import SocialMediaOps from "@/components/social-presence/SocialMediaOps";

const TABS = [
  { id: "directories", label: "Directory Discovery", icon: Globe, component: DirectoryDiscovery },
  { id: "hashtags", label: "Hashtag Campaigns", icon: Hash, component: HashtagCampaigns },
  { id: "social", label: "Social Media AI", icon: Bot, component: SocialMediaOps },
];

export default function SocialPresence() {
  const [activeTab, setActiveTab] = useState("directories");
  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || DirectoryDiscovery;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Social Presence Engine</h1>
        <p className="text-sm text-muted-foreground">Discover submission sites, run hashtag campaigns, and operate social media autonomously with AI.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b overflow-x-auto xa-scroll">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      <ActiveComponent />
    </div>
  );
}