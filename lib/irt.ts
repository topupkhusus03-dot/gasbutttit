import { IRTParameters } from '@/types';

function icc(theta: number, params: IRTParameters): number {
  const { a, b, c } = params;
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
}

function logLikelihood(theta: number, responses: { params: IRTParameters; correct: boolean }[]): number {
  let ll = 0;
  for (const r of responses) {
    const p = icc(theta, r.params);
    const safeP = Math.max(1e-10, Math.min(1 - 1e-10, p));
    ll += r.correct ? Math.log(safeP) : Math.log(1 - safeP);
  }
  return ll;
}

function logLikelihoodDerivative(theta: number, responses: { params: IRTParameters; correct: boolean }[]): number {
  let d1 = 0;
  for (const r of responses) {
    const { a, b, c } = r.params;
    const p = icc(theta, r.params);
    const q = 1 - p;
    const safeP = Math.max(1e-10, p);
    const safeQ = Math.max(1e-10, q);
    const w = (p - c) / (1 - c);
    const dP = a * w * safeQ;
    if (r.correct) {
      d1 += dP / safeP;
    } else {
      d1 -= dP / safeQ;
    }
  }
  return d1;
}

function logLikelihoodSecondDerivative(theta: number, responses: { params: IRTParameters; correct: boolean }[]): number {
  let d2 = 0;
  for (const r of responses) {
    const { a, b, c } = r.params;
    const p = icc(theta, r.params);
    const q = 1 - p;
    const safeP = Math.max(1e-10, p);
    const safeQ = Math.max(1e-10, q);
    const w = (p - c) / (1 - c);
    const dP = a * w * safeQ;
    d2 -= (dP * dP) / (safeP * safeQ);
  }
  return d2;
}

export function estimateTheta(responses: { params: IRTParameters; correct: boolean }[]): number {
  if (responses.length === 0) return -4;

  const allCorrect = responses.every(r => r.correct);
  const allWrong = responses.every(r => !r.correct);
  if (allCorrect) return 3.0;
  if (allWrong) return -3.0;

  let theta = 0;
  const maxIterations = 50;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIterations; i++) {
    const d1 = logLikelihoodDerivative(theta, responses);
    const d2 = logLikelihoodSecondDerivative(theta, responses);

    if (Math.abs(d2) < 1e-10) break;

    const delta = d1 / d2;
    theta -= delta;
    theta = Math.max(-4, Math.min(4, theta));

    if (Math.abs(delta) < tolerance) break;
  }

  return theta;
}

export function thetaToScore(theta: number): number {
  const minTheta = -4;
  const maxTheta = 4;
  const minScore = 100;
  const maxScore = 900;
  const score = minScore + ((theta - minTheta) / (maxTheta - minTheta)) * (maxScore - minScore);
  return Math.round(Math.max(minScore, Math.min(maxScore, score)) * 100) / 100;
}

export function calculateSubtestScore(
  answers: { correct: boolean; params: IRTParameters }[]
): { theta: number; score: number } {
  const theta = estimateTheta(answers);
  const score = thetaToScore(theta);
  return { theta, score };
}

export function defaultIRTParams(difficulty?: 'easy' | 'medium' | 'hard'): IRTParameters {
  switch (difficulty) {
    case 'easy':
      return { a: 1.0, b: -1.0, c: 0.25 };
    case 'hard':
      return { a: 1.2, b: 1.5, c: 0.2 };
    default:
      return { a: 1.0, b: 0.0, c: 0.25 };
  }
}
