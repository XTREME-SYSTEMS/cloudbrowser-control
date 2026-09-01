// Anomaly Detection — statistical + pattern-based, no LLM needed for core detection
// Detects: numeric outliers (z-score), price anomalies, missing required fields, duplicate records, volume spikes

export interface Anomaly {
  type: string;
  severity: 'low' | 'medium' | 'high';
  field?: string;
  value?: any;
  message: string;
  index?: number;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function detectNumericOutliers(values: number[], threshold = 3): Anomaly[] {
  if (values.length < 3) return [];

  // Use modified z-score (MAD-based) — robust to extreme outliers that inflate mean/stdDev
  const med = median(values);
  const absDeviations = values.map(v => Math.abs(v - med));
  const mad = median(absDeviations);

  const anomalies: Anomaly[] = [];

  if (mad === 0) {
    // Fallback to standard z-score if MAD is 0 (all values very close)
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
    if (stdDev === 0) return [];
    values.forEach((val, i) => {
      const zScore = Math.abs((val - mean) / stdDev);
      if (zScore > threshold) {
        anomalies.push({
          type: 'numeric_outlier',
          severity: zScore > threshold * 2 ? 'high' : 'medium',
          index: i,
          value: val,
          message: `Value ${val} is ${zScore.toFixed(2)} standard deviations from mean (${mean.toFixed(2)})`,
        });
      }
    });
    return anomalies;
  }

  values.forEach((val, i) => {
    const modifiedZ = 0.6745 * (val - med) / mad;
    if (Math.abs(modifiedZ) > threshold) {
      anomalies.push({
        type: 'numeric_outlier',
        severity: Math.abs(modifiedZ) > threshold * 2 ? 'high' : 'medium',
        index: i,
        value: val,
        message: `Value ${val} has modified z-score ${modifiedZ.toFixed(2)} (median ${med}, MAD ${mad.toFixed(2)})`,
      });
    }
  });
  return anomalies;
}

export function detectDuplicates(records: any[], keyFields: string[] = ['name', 'url', 'id']): Anomaly[] {
  const seen = new Map<string, number>();
  const anomalies: Anomaly[] = [];
  records.forEach((record, i) => {
    const key = keyFields.map(f => record[f]).filter(Boolean).join('|');
    if (!key) return;
    if (seen.has(key)) {
      anomalies.push({
        type: 'duplicate',
        severity: 'low',
        index: i,
        message: `Record at index ${i} duplicates record at index ${seen.get(key)}`,
      });
    } else {
      seen.set(key, i);
    }
  });
  return anomalies;
}

export function detectMissingFields(records: any[], requiredFields: string[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  records.forEach((record, i) => {
    for (const field of requiredFields) {
      if (record[field] === undefined || record[field] === null || record[field] === '') {
        anomalies.push({
          type: 'missing_field',
          severity: 'medium',
          field,
          index: i,
          message: `Required field "${field}" is missing or empty at index ${i}`,
        });
      }
    }
  });
  return anomalies;
}

export function detectPriceAnomalies(records: any[], priceField: string): Anomaly[] {
  const prices = records.map(r => r[priceField]).filter(v => typeof v === 'number') as number[];
  if (prices.length < 3) return [];
  const outliers = detectNumericOutliers(prices, 2.5);
  return outliers.map(a => ({
    ...a,
    type: 'price_anomaly',
    field: priceField,
    message: `Price ${a.value} is anomalous: ${a.message}`,
  }));
}

export function detectVolumeSpike(history: number[], current: number): Anomaly[] {
  if (history.length < 5) return [];
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const stdDev = Math.sqrt(history.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / history.length);
  if (stdDev === 0) return [];
  const zScore = Math.abs((current - mean) / stdDev);
  if (zScore > 3) {
    return [{
      type: 'volume_spike',
      severity: zScore > 5 ? 'high' : 'medium',
      value: current,
      message: `Current volume ${current} is ${zScore.toFixed(2)}x the historical average (${mean.toFixed(2)})`,
    }];
  }
  return [];
}

export function detectAll(records: any[], options: {
  numericFields?: string[];
  requiredFields?: string[];
  duplicateKeyFields?: string[];
} = {}): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (options.duplicateKeyFields) {
    anomalies.push(...detectDuplicates(records, options.duplicateKeyFields));
  }

  if (options.requiredFields) {
    anomalies.push(...detectMissingFields(records, options.requiredFields));
  }

  if (options.numericFields) {
    for (const field of options.numericFields) {
      const values = records.map(r => r[field]).filter(v => typeof v === 'number') as number[];
      const fieldAnomalies = detectNumericOutliers(values);
      anomalies.push(...fieldAnomalies.map(a => ({ ...a, field, type: 'numeric_outlier' })));
    }
  }

  return anomalies;
}