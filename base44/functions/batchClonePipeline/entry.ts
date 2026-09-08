import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";

/**
 * Batch Clone Pipeline — process a list of URLs through the DEEP pipeline
 *
 * Kicks off runDeepClonePipeline for each URL asynchronously (via waitUntil).
 * Returns immediately with a batch_id and the list of URLs being processed.
 * The frontend polls CloneProject records (filtered by target_url) to track progress.
 *
 * Input:  { urls: string[], skip_deployment?: boolean }
 * Output: { ok, batch_id, total, queued: [{ url, status }] }
 */

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { urls, skip_deployment } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0)
      return Response.json({ error: "urls array is required" }, { status: 400 });

    // Deduplicate and validate URLs
    const validUrls = [...new Set(
      urls
        .map((u: string) => u.trim())
        .filter((u: string) => u.startsWith("http"))
    )];

    if (validUrls.length === 0)
      return Response.json({ error: "No valid URLs (must start with http)" }, { status: 400 });

    if (validUrls.length > 25)
      return Response.json({ error: "Maximum 25 URLs per batch" }, { status: 400 });

    const batchId = `batch_${Date.now()}`;

    // Kick off each URL's pipeline asynchronously
    // The pipeline creates its own CloneProject, so we just invoke and let it run
    for (const url of validUrls) {
      waitUntil(
        base44.functions
          .invoke("runDeepClonePipeline", {
            target_url: url,
            skip_deployment: skip_deployment || false,
          })
          .catch(() => {})
      );
    }

    return Response.json({
      ok: true,
      batch_id: batchId,
      total: validUrls.length,
      skip_deployment: skip_deployment || false,
      urls: validUrls,
      message: `${validUrls.length} clone pipelines started. Track progress in Clone Studio or the Gap Map.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}