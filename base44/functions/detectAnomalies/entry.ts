import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { detectAll, detectPriceAnomalies, detectVolumeSpike } from '../../shared/anomalyDetection.ts';

// Detect anomalies in extraction results.
// Flags numeric outliers, duplicates, missing fields, price anomalies, volume spikes.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { records, options, priceField, volumeHistory, currentVolume } = body;

    if (!records || !Array.isArray(records)) {
      return Response.json({ error: 'records array required' }, { status: 400 });
    }

    const anomalies = detectAll(records, options || {});

    // Optional price anomaly detection
    if (priceField) {
      anomalies.push(...detectPriceAnomalies(records, priceField));
    }

    // Optional volume spike detection
    if (volumeHistory && Array.isArray(volumeHistory) && currentVolume !== undefined) {
      anomalies.push(...detectVolumeSpike(volumeHistory, currentVolume));
    }

    const summary = {
      totalRecords: records.length,
      totalAnomalies: anomalies.length,
      bySeverity: {
        high: anomalies.filter(a => a.severity === 'high').length,
        medium: anomalies.filter(a => a.severity === 'medium').length,
        low: anomalies.filter(a => a.severity === 'low').length,
      },
      byType: anomalies.reduce((acc: any, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      }, {}),
    };

    return Response.json({ anomalies, summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}