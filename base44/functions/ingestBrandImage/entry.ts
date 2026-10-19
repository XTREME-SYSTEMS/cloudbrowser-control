import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';

/**
 * Image Ingestion System — Ingests a brand reference image, uses AI vision to
 * extract design tokens (colors, fonts, style, layout notes), and stores the
 * analysis as a BrandAsset record. This powers the visual parity system.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json();
    const { image_url, name, category } = body;

    if (!image_url) return Response.json({ error: "image_url is required" }, { status: 400 });

    // Use LLM vision to analyze the brand image and extract design tokens
    const analysis: any = await invokeLLM({
      model: "gemini_3_flash",
      prompt: `You are a brand design analyst. Analyze this brand reference image and extract the complete design system specification.

Extract:
1. **Colors**: List every distinct color as a hex code (background, primary, accent, text, metallic tones)
2. **Fonts**: Describe the typography style (font family type, weight, case, spacing)
3. **Style**: One paragraph describing the overall visual aesthetic
4. **Layout notes**: Describe the composition, spacing, and structural elements
5. **Key elements**: List the key visual elements (logo, icons, panels, effects)

Return as JSON.`,
      file_urls: [image_url],
      response_json_schema: {
        type: "object",
        properties: {
          colors: { type: "array", items: { type: "string" }, description: "Hex color codes" },
          fonts: { type: "array", items: { type: "string" }, description: "Font descriptions" },
          style: { type: "string" },
          layout_notes: { type: "string" },
          key_elements: { type: "array", items: { type: "string" } },
        },
      },
    });

    const asset = await base44.entities.BrandAsset.create({
      name: name || `Brand Reference ${new Date().toISOString().split("T")[0]}`,
      image_url,
      category: category || "brand_reference",
      analysis: analysis || {},
      active: true,
    });

    return Response.json({
      ok: true,
      asset_id: asset.id,
      analysis,
    });
  } catch (error: any) {
    console.error("Brand image ingestion error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}