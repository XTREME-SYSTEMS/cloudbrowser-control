import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Image as ImageComponent } from "@/components/ui/image";
import {
  ArrowLeft, Upload, ScanLine, Check, Code2, Download, Loader2,
  FileImage, Sparkles, AlertCircle, Eye, Copy, Server, Monitor,
} from "lucide-react";

const LOGO_URL = "https://media.base44.com/images/public/6a837c8e995cc4824aabf594/b9a9faf73_logo.png";

export default function MockupStudio() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1); // 1=upload, 2=scan, 3=approve, 4=generate, 5=complete
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [generatedPreview, setGeneratedPreview] = useState("");
  const [includeBackend, setIncludeBackend] = useState(null); // null = use scan default

  // Step 1: Handle file selection
  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setProject(null);
    setStep(1);
  }, []);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  // Step 1 → 2: Ingest + Scan
  const handleIngestAndScan = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast({ title: "No file selected", variant: "destructive" });
      return;
    }

    setLoading(true);
    setLoadingMsg("Uploading mock-up...");
    try {
      // Upload the file privately via the SDK
      const uploadRes = await base44.integrations.Core.UploadPrivateFile({ file });
      const fileUri = uploadRes.file_uri;

      setLoadingMsg("Creating project...");
      // Create the project
      const ingestRes = await base44.functions.invoke("ingestMockup", {
        file_uri: fileUri,
        file_name: file.name,
        file_type: file.type,
        project_name: file.name.replace(/\.[^.]+$/, ""),
      });
      const projectId = ingestRes.data.project_id;

      setLoadingMsg("Scanning mock-up with AI vision...");
      // Scan the mock-up
      const scanRes = await base44.functions.invoke("scanMockup", { project_id: projectId });
      const scanned = scanRes.data;

      setProject({
        id: projectId,
        ...scanned,
        scan_result: scanned.scan_result,
      });
      setIncludeBackend(scanned.scan_result?.has_backend || false);
      setStep(2);
      toast({ title: "Scan complete", description: "Review the extracted design spec." });
    } catch (err) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // Step 2 → 3: Approve scan
  const handleApprove = () => {
    setStep(3);
  };

  // Step 3 → 4: Generate code
  const handleGenerate = async () => {
    if (!project?.id) return;
    setLoading(true);
    setLoadingMsg("Generating production code from approved scan...");
    try {
      const res = await base44.functions.invoke("generateFromMockup", {
        project_id: project.id,
        include_backend: includeBackend,
      });
      const data = res.data;
      setProject({ ...project, ...data });
      setGeneratedPreview(data.frontend_code);
      setStep(4);
      toast({ title: "Code generated", description: "Your website is ready to download." });
    } catch (err) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // Download the generated code
  const handleDownload = (code, filename) => {
    const blob = new Blob([code], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const scan = project?.scan_result;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="CloudBrowser" className="w-8 h-8 rounded-lg" />
            <div>
              <span className="font-heading font-bold text-base block leading-tight">Mock-up Studio</span>
              <span className="text-xs text-muted-foreground">Ingest → Scan → Generate</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </div>
      </header>
      <div className="h-1 bg-gold-gradient" />

      {/* Stepper */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center gap-2 mb-6">
          {[
            { n: 1, label: "Upload", icon: Upload },
            { n: 2, label: "Scan", icon: ScanLine },
            { n: 3, label: "Approve", icon: Check },
            { n: 4, label: "Generate", icon: Code2 },
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                step >= s.n ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"
              }`}>
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </div>
              {i < 3 && <div className={`h-0.5 w-6 ${step > s.n ? "bg-amber-400" : "bg-border"}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`xa-card !p-10 text-center cursor-pointer transition-all border-2 border-dashed ${
                dragOver ? "border-amber-400 bg-amber-50" : "border-border hover:border-amber-300"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={onFileChange}
                accept="image/*,.pdf,.sketch,.fig,.png,.jpg,.jpeg,.webp,.svg"
              />
              {previewUrl ? (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <FileImage className="w-12 h-12 text-amber-500" />
                  </div>
                  <div className="font-bold text-sm">Mock-up ready</div>
                  <div className="overflow-hidden rounded-xl border border-border max-w-md mx-auto">
                    <img src={previewUrl} alt="Preview" className="max-h-64 mx-auto" />
                  </div>
                  <div className="text-xs text-muted-foreground">Click to choose a different file, or drag a new one</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <Upload className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <div className="font-bold text-base">Drop your mock-up here</div>
                  <div className="text-sm text-muted-foreground">
                    Accepts images, PDFs, sketches, Figma exports — any file type
                  </div>
                  <div className="text-xs text-muted-foreground">PNG, JPG, WebP, SVG, PDF, and more</div>
                </div>
              )}
            </div>

            {previewUrl && (
              <div className="mt-4 flex justify-center">
                <Button onClick={handleIngestAndScan} disabled={loading} className="xa-btn-primary">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{loadingMsg || "Processing..."}</>
                  ) : (
                    <><ScanLine className="w-4 h-4 mr-2" />Ingest & Scan Mock-up</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 2 & 3: Scan Results / Approve */}
        {(step === 2 || step === 3) && scan && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6">
            {/* Mock-up preview */}
            <div>
              <div className="xa-card !p-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Approved Mock-up</div>
                {project?.file_url ? (
                  <ImageComponent src={project.file_url} alt="Mock-up" fittingType="fit" className="w-full rounded-lg" />
                ) : previewUrl ? (
                  <img src={previewUrl} alt="Mock-up" className="w-full rounded-lg" />
                ) : null}
              </div>
            </div>

            {/* Scan results */}
            <div className="space-y-4">
              <div className="xa-card">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-sm">AI Design Scan</span>
                </div>

                {/* Project type + category */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Project Type</div>
                    <div className="font-bold text-sm capitalize">{scan.project_type?.replace(/_/g, " ")}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Category</div>
                    <div className="font-bold text-sm">{scan.category}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Family</div>
                    <div className="font-bold text-sm">{scan.family}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Design Style</div>
                    <div className="font-bold text-sm capitalize">{scan.design_style}</div>
                  </div>
                </div>

                {/* Color palette */}
                {scan.color_palette && (
                  <div className="mb-4">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Color Palette</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(scan.color_palette).filter(([, v]) => v).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-1.5">
                          <div className="w-8 h-8 rounded-lg border border-border" style={{ background: v }} />
                          <div>
                            <div className="text-xs font-bold">{k}</div>
                            <div className="text-xs text-muted-foreground font-mono">{v}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sections */}
                {scan.sections?.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                      Detected Sections ({scan.sections.length})
                    </div>
                    <div className="space-y-1.5">
                      {scan.sections.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                          <div>
                            <span className="font-bold">{s.name}</span>
                            <span className="text-muted-foreground ml-1.5">· {s.type}</span>
                            {s.description && <div className="text-muted-foreground">{s.description}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Backend */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Server className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Backend</span>
                  </div>
                  {scan.has_backend ? (
                    <div className="text-xs">
                      <span className="font-bold text-amber-600">Backend needed</span>
                      {scan.backend_spec && <div className="text-muted-foreground mt-0.5">{scan.backend_spec}</div>}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">No backend required — static site</div>
                  )}
                </div>

                {/* Content summary */}
                {scan.content_summary && (
                  <div className="mb-4">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Content Summary</div>
                    <div className="text-xs">{scan.content_summary}</div>
                  </div>
                )}
              </div>

              {/* Approve / Generate buttons */}
              {step === 2 && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Re-upload
                  </Button>
                  <Button onClick={handleApprove} className="xa-btn-primary flex-1">
                    <Check className="w-4 h-4 mr-1" /> Approve Scan
                  </Button>
                </div>
              )}

              {step === 3 && (
                <div className="xa-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="font-bold text-sm">Scan Approved — Ready to Generate</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="include-backend"
                      checked={includeBackend}
                      onChange={(e) => setIncludeBackend(e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <label htmlFor="include-backend" className="text-sm">
                      Include backend code {scan.has_backend ? "(recommended by scan)" : ""}
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button onClick={handleGenerate} disabled={loading} className="xa-btn-primary flex-1">
                      {loading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{loadingMsg || "Generating..."}</>
                      ) : (
                        <><Code2 className="w-4 h-4 mr-2" />Generate Code</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Generated Code */}
        {step === 4 && project && (
          <div className="space-y-4">
            <div className="xa-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="font-bold text-sm">Code Generated Successfully</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(project.frontend_code)}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy HTML
                  </Button>
                  <Button size="sm" onClick={() => handleDownload(project.frontend_code, `${project.project_name || "website"}.html`)}>
                    <Download className="w-3.5 h-3.5 mr-1" /> Download HTML
                  </Button>
                </div>
              </div>

              {project.features_implemented?.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Features Implemented</div>
                  <div className="flex flex-wrap gap-1.5">
                    {project.features_implemented.map((f, i) => (
                      <span key={i} className="vg-chip text-xs">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {project.notes && (
                <div className="text-xs text-muted-foreground mb-3">{project.notes}</div>
              )}
            </div>

            {/* Live preview */}
            {project.frontend_code && (
              <div className="xa-card !p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Live Preview</span>
                </div>
                <iframe
                  srcDoc={project.frontend_code}
                  title="Generated Website Preview"
                  className="w-full rounded-lg border border-border"
                  style={{ height: 500 }}
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
            )}

            {/* Backend code */}
            {project.backend_code && (
              <div className="xa-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Backend Code (Node.js/Express)</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleCopy(project.backend_code)}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                    </Button>
                    <Button size="sm" onClick={() => handleDownload(project.backend_code, "server.js")}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Download
                    </Button>
                  </div>
                </div>
                <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-auto max-h-64 xa-scroll">{project.backend_code}</pre>
              </div>
            )}

            {/* Frontend code */}
            {project.frontend_code && (
              <div className="xa-card">
                <div className="flex items-center gap-2 mb-2">
                  <Code2 className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Frontend Code (HTML)</span>
                </div>
                <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-auto max-h-64 xa-scroll">{project.frontend_code.slice(0, 5000)}{project.frontend_code.length > 5000 ? "\n... (truncated — use Download for full code)" : ""}</pre>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep(1); setProject(null); setPreviewUrl(""); }}>
                <Upload className="w-4 h-4 mr-1" /> New Mock-up
              </Button>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="xa-card !p-8 text-center max-w-sm">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" />
              <div className="font-bold text-sm">{loadingMsg}</div>
              <div className="text-xs text-muted-foreground mt-1">This may take 30-60 seconds</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}