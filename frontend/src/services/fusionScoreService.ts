/**
 * Multi-Modal Fusion Score Service
 * Combines spiral, wave, and voice test results into a unified Parkinson's risk score.
 */

import type { Test } from '../types/database';

export interface ModalityResult {
  testId: string;
  testType: 'spiral' | 'wave' | 'speech';
  label: string;
  confidence: number;
  parkinsonsProb: number;
  riskScore: number; // 0-10
  timestamp: string;
}

export interface FusionResult {
  fusionScore: number; // 0-10
  riskLevel: 'Low' | 'Medium' | 'High';
  modalitiesUsed: ModalityResult[];
  missingModalities: ('spiral' | 'wave' | 'speech')[];
  confidence: number; // 0-1
  breakdown: {
    modality: string;
    weight: number;
    score: number;
    weightedContribution: number;
  }[];
  recommendations: string[];
  computedAt: string;
}

// Weights for each modality (sum to 1.0)
const MODALITY_WEIGHTS: Record<string, number> = {
  spiral: 0.35,
  wave: 0.30,
  speech: 0.35,
};

/**
 * Determine the effective test type, normalizing edge cases.
 * Some tests may have test_type='drawing' or other variants.
 */
function getEffectiveTestType(test: Test): string {
  const tt = test.test_type?.toLowerCase() || '';
  // Direct match
  if (['spiral', 'wave', 'speech'].includes(tt)) return tt;
  // Check result.modelUsed or result.modelInfo.type for spiral/wave
  const result = test.result as any;
  if (result) {
    if (result.modelUsed === 'spiral' || result.modelInfo?.type === 'spiral') return 'spiral';
    if (result.modelUsed === 'wave' || result.modelInfo?.type === 'wave') return 'wave';
    if (result.analysisMethod?.includes('spiral')) return 'spiral';
    if (result.analysisMethod?.includes('wave')) return 'wave';
  }
  // Check model_versions keys
  const mv = test.model_versions as any;
  if (mv) {
    if (mv.spiral || mv.voiceKnn) {
      if (mv.voiceKnn) return 'speech';
      if (mv.spiral) return 'spiral';
    }
    if (mv.wave) return 'wave';
  }
  return tt;
}

/**
 * Extract the Parkinson's probability from a test result
 */
function extractParkinsonsProb(test: Test): number {
  const result = test.result as any;
  if (!result) return 0;

  // Voice KNN results
  if (result.probability !== undefined) return result.probability;
  if (result.probabilityOfParkinsons !== undefined) return result.probabilityOfParkinsons;

  // Spiral/Wave results with probabilities
  if (result.probabilities?.Parkinsons !== undefined) return result.probabilities.Parkinsons;

  // Fallback: use confidence + label
  if (result.label && result.confidence !== undefined) {
    return result.label === 'Parkinsons' ? result.confidence : 1 - result.confidence;
  }

  // Test-level confidence
  if (test.confidence !== null && test.confidence !== undefined) return test.confidence;

  return 0;
}

/**
 * Extract risk score (0-10) from a test, or compute from probability
 */
function extractRiskScore(test: Test): number {
  const result = test.result as any;
  if (result?.riskScore !== undefined) return result.riskScore;
  const prob = extractParkinsonsProb(test);
  return Number((prob * 10).toFixed(1));
}

/**
 * Get the latest test for each modality type.
 * Uses flexible type matching to handle edge cases.
 */
export function getLatestByModality(tests: Test[]): {
  spiral: Test | null;
  wave: Test | null;
  speech: Test | null;
} {
  // Sort newest first
  const sorted = [...tests].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Filter out fusion records
  const nonFusion = sorted.filter(t => getEffectiveTestType(t) !== 'fusion');

  return {
    spiral: nonFusion.find(t => getEffectiveTestType(t) === 'spiral') || null,
    wave: nonFusion.find(t => getEffectiveTestType(t) === 'wave') || null,
    speech: nonFusion.find(t => getEffectiveTestType(t) === 'speech') || null,
  };
}

/**
 * Normalize a test result into a ModalityResult
 */
function toModalityResult(test: Test, type: 'spiral' | 'wave' | 'speech'): ModalityResult {
  const result = test.result as any;
  const parkinsonsProb = extractParkinsonsProb(test);
  const riskScore = extractRiskScore(test);
  const conf = result?.confidence ?? test.confidence ?? Math.max(parkinsonsProb, 1 - parkinsonsProb);

  return {
    testId: test.id,
    testType: type,
    label: result?.label || (parkinsonsProb > 0.5 ? 'Parkinsons' : 'Healthy'),
    confidence: conf,
    parkinsonsProb,
    riskScore,
    timestamp: test.created_at,
  };
}

/**
 * Get risk level from score (0-10)
 */
export function getFusionRiskLevel(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 7) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}

/**
 * Compute the multi-modal fusion score.
 * Requires at least 2 of 3 modalities.
 */
export function computeFusionScore(
  latestTests: { spiral: Test | null; wave: Test | null; speech: Test | null }
): FusionResult | null {
  const allModalities: ('spiral' | 'wave' | 'speech')[] = ['spiral', 'wave', 'speech'];
  const available: ModalityResult[] = [];
  const missing: ('spiral' | 'wave' | 'speech')[] = [];

  for (const mod of allModalities) {
    const test = latestTests[mod];
    if (test) {
      available.push(toModalityResult(test, mod));
    } else {
      missing.push(mod);
    }
  }

  if (available.length < 2) return null;

  // Compute weighted score with renormalized weights
  const totalWeight = available.reduce((sum, m) => sum + (MODALITY_WEIGHTS[m.testType] || 0), 0);

  const breakdown = available.map(m => {
    const rawWeight = MODALITY_WEIGHTS[m.testType] || 0;
    const normalizedWeight = rawWeight / totalWeight;
    return {
      modality: m.testType,
      weight: normalizedWeight,
      score: m.riskScore,
      weightedContribution: m.riskScore * normalizedWeight,
    };
  });

  const fusionScore = Number(
    breakdown.reduce((sum, b) => sum + b.weightedContribution, 0).toFixed(1)
  );

  const avgConfidence = available.reduce((sum, m) => sum + m.confidence, 0) / available.length;
  const confidenceMultiplier = available.length === 3 ? 1.0 : 0.85;
  const finalConfidence = Number((avgConfidence * confidenceMultiplier).toFixed(3));

  const riskLevel = getFusionRiskLevel(fusionScore);
  const recommendations = getRecommendations(riskLevel, missing);

  return {
    fusionScore,
    riskLevel,
    modalitiesUsed: available,
    missingModalities: missing,
    confidence: finalConfidence,
    breakdown,
    recommendations,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Generate actionable recommendations based on risk level
 */
function getRecommendations(
  riskLevel: 'Low' | 'Medium' | 'High',
  missingModalities: string[]
): string[] {
  const recs: string[] = [];

  if (missingModalities.length > 0) {
    const names = missingModalities.map(m =>
      m === 'spiral' ? 'spiral drawing' : m === 'wave' ? 'wave drawing' : 'voice'
    );
    recs.push(
      `Complete the ${names.join(' and ')} test${names.length > 1 ? 's' : ''} for a more accurate fusion score.`
    );
  }

  switch (riskLevel) {
    case 'High':
      recs.push('Schedule a consultation with a neurologist within the next 2 weeks.');
      recs.push('Consider a comprehensive DaTscan or MRI assessment.');
      recs.push('Begin daily motor exercises using the AI Therapy Coach.');
      recs.push('Track your symptoms daily in a journal.');
      break;
    case 'Medium':
      recs.push('Schedule a follow-up screening within the next month.');
      recs.push('Monitor vocal and motor changes closely.');
      recs.push('Use the AI Therapy Coach for preventive exercises 3x per week.');
      recs.push('Re-run this comprehensive screening in 2 weeks to track trends.');
      break;
    case 'Low':
      recs.push('Continue periodic screenings every 1-2 months for monitoring.');
      recs.push('Maintain a healthy lifestyle with regular exercise.');
      recs.push('No immediate clinical action required based on current results.');
      break;
  }

  return recs;
}

/**
 * Get display name for a modality type
 */
export function getModalityDisplayName(type: string): string {
  switch (type) {
    case 'spiral': return 'Spiral Drawing';
    case 'wave': return 'Wave Drawing';
    case 'speech': return 'Voice Analysis';
    default: return type;
  }
}

/**
 * Get model name for a modality type
 */
export function getModalityModelName(type: string): string {
  switch (type) {
    case 'spiral': return 'MobileNetV2';
    case 'wave': return 'InceptionV3';
    case 'speech': return 'KNN Classifier';
    default: return 'Unknown';
  }
}
