import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Hashtag Campaign Runner
// Posts content with hashtags across all target platforms using the social media engine.
// Dispatches socialMediaOperate for each platform sequentially with rate-limit spacing.

const PLATFORM_DELAY_MS = 5000; // 5s between platforms to avoid detection

export default async function(req: any) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const campaignId = body.campaign_id;
  if (!campaignId) return Response.json({ error: 'campaign_id is required' }, { status: 400 });

  // Load campaign
  const campaign = await base44.asServiceRole.entities.HashtagCampaign.get(campaignId);
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

  // Build post content with hashtags
  const hashtagString = (campaign.hashtags || []).map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
  const fullContent = campaign.persistent_hashtags
    ? `${campaign.content_text}${hashtagString ? '\n\n' + hashtagString : ''}`
    : campaign.content_text;

  // Update campaign status
  await base44.asServiceRole.entities.HashtagCampaign.update(campaignId, {
    status: 'running',
    started_at: new Date().toISOString()
  });

  const results: any[] = [];
  const platforms = campaign.target_platforms || [];

  for (const platform of platforms) {
    const result: any = { platform, status: 'pending', posted_at: new Date().toISOString() };
    try {
      // Find connected account for this platform
      const accounts = await base44.asServiceRole.entities.SocialMediaAccount.filter({
        platform,
        status: 'active',
        auto_post_enabled: true
      }, { limit: 1 });

      const accountId = accounts.items?.[0]?.id;

      // Dispatch the post via socialMediaOperate
      const postRes = await base44.asServiceRole.functions.invoke('socialMediaOperate', {
        action: 'post',
        platform,
        content: fullContent,
        media_urls: campaign.media_urls || [],
        account_id: accountId,
        human_like: true,
        use_proxy: true
      });

      if (postRes.data?.ok) {
        result.status = 'posted';
        result.evidence_uri = postRes.data.evidence?.[0] || null;
        result.log = postRes.data.log;
      } else {
        result.status = 'failed';
        result.error = postRes.data?.error || 'Unknown error';
      }
    } catch (e) {
      result.status = 'failed';
      result.error = e.message;
    }
    results.push(result);

    // Rate-limit spacing between platforms
    if (platforms.indexOf(platform) < platforms.length - 1) {
      await new Promise(r => setTimeout(r, PLATFORM_DELAY_MS));
    }
  }

  const postsMade = results.filter(r => r.status === 'posted').length;
  const postsFailed = results.filter(r => r.status === 'failed').length;

  // Update campaign with results
  await base44.asServiceRole.entities.HashtagCampaign.update(campaignId, {
    status: postsFailed === 0 ? 'completed' : (postsMade > 0 ? 'completed' : 'failed'),
    posts_made: postsMade,
    posts_failed: postsFailed,
    post_results: results,
    completed_at: new Date().toISOString()
  });

  return Response.json({
    ok: true,
    campaign_id: campaignId,
    posts_made: postsMade,
    posts_failed: postsFailed,
    results
  });
}