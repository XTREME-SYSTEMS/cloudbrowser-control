import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Loader2, Upload, Sparkles } from "lucide-react";

export default function BrandIngestion() {
  const [imageUrl, setImageUrl] = useState("");
  const [assetName, setAssetName] = useState("");
  const [category, setCategory] = useState("brand_reference");
  const [uploading, setUploading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { loadAssets(); }, []);

  const loadAssets = async () => {
    try {
      const res = await base44.entities.BrandAsset.filter({ active: true }, { sort: "-created_date", limit: 20 });
      setAssets(res.items || res);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    setError(null);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      const data = res.data || res;
      setImageUrl(data.file_url || data.url || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleIngest = async () => {
    if (!imageUrl) { setError("Provide an image URL or upload a file"); return; }
    setIngesting(true);
    setError(null);
    try {
      await base44.functions.invoke("ingestBrandImage", {
        image_url: imageUrl,
        name: assetName || `Brand Reference ${new Date().toLocaleDateString()}`,
        category,
      });
      setImageUrl("");
      setAssetName("");
      loadAssets();
    } catch (err) {
      setError(err.message);
    } finally {
      setIngesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-primary" />
          Image Ingestion System
        </CardTitle>
        <CardDescription>Ingest brand reference images for visual parity validation (stored publicly — anyone with the link can open them)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Image URL</Label>
          <div className="flex gap-2">
            <Input placeholder="Paste image URL..." value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
            <label className="cursor-pointer shrink-0">
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
              <Button variant="outline" size="sm" disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              </Button>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Asset name" value={assetName} onChange={e => setAssetName(e.target.value)} />
          <select value={category} onChange={e => setCategory(e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-sm">
            <option value="brand_reference">Brand Reference</option>
            <option value="logo">Logo</option>
            <option value="ui_reference">UI Reference</option>
            <option value="color_palette">Color Palette</option>
            <option value="typography">Typography</option>
          </select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleIngest} disabled={ingesting || !imageUrl} className="w-full">
          {ingesting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing image...</> : <><Sparkles className="w-4 h-4 mr-2" />Ingest & Analyze</>}
        </Button>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : assets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No brand images ingested yet.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto xa-scroll">
            {assets.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-2 rounded-lg border border-border">
                <img src={a.image_url} alt={a.name} className="w-12 h-12 rounded object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.category}</p>
                  {a.analysis?.colors?.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {a.analysis.colors.slice(0, 8).map((c, i) => (
                        <div key={i} className="w-4 h-4 rounded border border-white/10" style={{ background: c }} title={c} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}