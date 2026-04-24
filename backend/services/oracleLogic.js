'use strict';

// ============================================================
// DROUGHT THRESHOLDS — These values determine when a payout
// is triggered. Both conditions must be met (AND logic):
//
//   NDVI_THRESHOLD    = 0.35
//     → NDVI must be BELOW 0.35 on ALL 14 observation days
//     → NDVI (Normalized Difference Vegetation Index) < 0.35
//       indicates severe vegetation stress / bare/dying crops
//
//   RAINFALL_THRESHOLD = 10 mm
//     → Daily rainfall must be BELOW 10mm on ALL 14 days
//     → Less than 10mm/day for 2 consecutive weeks = severe drought
//
//   CONFIDENCE thresholds:
//     "high"   → avg NDVI < 0.35 * 0.80 (20% below threshold) AND
//                avg rainfall < 10 * 0.80 (20% below threshold)
//     "medium" → thresholds met but not exceeded by 20%
//     "low"    → thresholds not fully met
// ============================================================

const NDVI_THRESHOLD = 0.35;
const RAINFALL_THRESHOLD_MM = 10;
const HIGH_CONFIDENCE_MARGIN = 0.80; // must be 20% below threshold for high confidence

/**
 * Evaluates whether a 14-day observation window constitutes a drought event.
 *
 * @param {Array<{farmId, ndvi, rainfall_mm, observation_date, source}>} observations
 *   Array of exactly 14 daily observation objects (from sentinelService)
 *
 * @returns {{
 *   triggered: boolean,
 *   reason: string,
 *   confidence: "high" | "medium" | "low",
 *   proof_of_loss: {
 *     avg_ndvi: number,
 *     avg_rainfall_mm: number,
 *     min_ndvi: number,
 *     max_rainfall_mm: number,
 *     days_evaluated: number,
 *     ndvi_threshold: number,
 *     rainfall_threshold_mm: number,
 *     observation_window: { start: string, end: string },
 *     data_source: string
 *   }
 * }}
 */
function evaluateDrought(observations) {
  if (!Array.isArray(observations) || observations.length === 0) {
    return {
      triggered: false,
      reason: 'No observations provided',
      confidence: 'low',
      proof_of_loss: {}
    };
  }

  const daysEvaluated = observations.length;

  const ndviValues = observations.map((o) => o.ndvi);
  const rainfallValues = observations.map((o) => o.rainfall_mm);

  const avgNdvi = ndviValues.reduce((sum, v) => sum + v, 0) / daysEvaluated;
  const avgRainfall = rainfallValues.reduce((sum, v) => sum + v, 0) / daysEvaluated;
  const minNdvi = Math.min(...ndviValues);
  const maxRainfall = Math.max(...rainfallValues);

  // Check both conditions across ALL observed days (AND logic)
  const allDaysLowNdvi = ndviValues.every((ndvi) => ndvi < NDVI_THRESHOLD);
  const allDaysLowRainfall = rainfallValues.every((rain) => rain < RAINFALL_THRESHOLD_MM);

  const triggered = allDaysLowNdvi && allDaysLowRainfall;

  // Determine confidence level
  let confidence;
  if (triggered) {
    const ndviHighConfidence = avgNdvi < NDVI_THRESHOLD * HIGH_CONFIDENCE_MARGIN;
    const rainfallHighConfidence = avgRainfall < RAINFALL_THRESHOLD_MM * HIGH_CONFIDENCE_MARGIN;

    if (ndviHighConfidence && rainfallHighConfidence) {
      confidence = 'high';
    } else {
      confidence = 'medium';
    }
  } else {
    confidence = 'low';
  }

  // Build human-readable reason
  let reason;
  if (triggered) {
    reason = `Drought confirmed over ${daysEvaluated}-day window. ` +
      `Average NDVI: ${avgNdvi.toFixed(3)} (threshold: ${NDVI_THRESHOLD}). ` +
      `Average rainfall: ${avgRainfall.toFixed(1)}mm/day (threshold: ${RAINFALL_THRESHOLD_MM}mm). ` +
      `All days below both thresholds.`;
  } else if (!allDaysLowNdvi && !allDaysLowRainfall) {
    reason = `No drought. NDVI (avg: ${avgNdvi.toFixed(3)}) and rainfall (avg: ${avgRainfall.toFixed(1)}mm) ` +
      `are both within normal ranges.`;
  } else if (!allDaysLowNdvi) {
    reason = `No drought triggered. NDVI not consistently below threshold — ` +
      `some days exceeded ${NDVI_THRESHOLD}. Average NDVI: ${avgNdvi.toFixed(3)}.`;
  } else {
    reason = `No drought triggered. Rainfall not consistently below threshold — ` +
      `some days exceeded ${RAINFALL_THRESHOLD_MM}mm. Average rainfall: ${avgRainfall.toFixed(1)}mm.`;
  }

  const dataSource = observations[0]?.source || 'unknown';
  const dates = observations.map((o) => o.observation_date).filter(Boolean).sort();

  const proofOfLoss = {
    avg_ndvi: parseFloat(avgNdvi.toFixed(4)),
    avg_rainfall_mm: parseFloat(avgRainfall.toFixed(2)),
    min_ndvi: parseFloat(minNdvi.toFixed(4)),
    max_rainfall_mm: parseFloat(maxRainfall.toFixed(2)),
    days_evaluated: daysEvaluated,
    ndvi_threshold: NDVI_THRESHOLD,
    rainfall_threshold_mm: RAINFALL_THRESHOLD_MM,
    observation_window: {
      start: dates[0] || null,
      end: dates[dates.length - 1] || null
    },
    data_source: dataSource
  };

  return { triggered, reason, confidence, proof_of_loss: proofOfLoss };
}

module.exports = { evaluateDrought, NDVI_THRESHOLD, RAINFALL_THRESHOLD_MM };
