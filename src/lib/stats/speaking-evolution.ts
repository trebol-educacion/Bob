import type { SpeakingPoint } from './progress-summary';

export const MIN_POINTS_FOR_CURVE = 3;

export interface ChartPoint {
  x: number;
  y: number;
  score10: number;
  at: string;
}

export interface ChartGeometry {
  width: number;
  height: number;
  padding: number;
}

const SCORE_MAX = 10;

/**
 * @param series - speaking grades in chronological order
 * @param geometry - drawing area and padding in px
 * @returns points laid out left to right on a 0-10 vertical scale
 */
export function layoutSeries(series: SpeakingPoint[], geometry: ChartGeometry): ChartPoint[] {
  const { width, height, padding } = geometry;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const lastIndex = Math.max(1, series.length - 1);
  return series.map((point, index) => ({
    x: padding + (series.length === 1 ? innerWidth / 2 : (index / lastIndex) * innerWidth),
    y: padding + innerHeight - (Math.min(SCORE_MAX, Math.max(0, point.score10)) / SCORE_MAX) * innerHeight,
    score10: point.score10,
    at: point.at,
  }));
}

/**
 * @param points - laid out chart points
 * @returns SVG path of the polyline, empty when there are fewer than two points
 */
export function linePath(points: ChartPoint[]): string {
  if (points.length < 2) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

/**
 * @param series - speaking grades in chronological order
 * @returns true when there are enough attempts to draw a curve
 */
export function hasCurve(series: SpeakingPoint[]): boolean {
  return series.length >= MIN_POINTS_FOR_CURVE;
}
