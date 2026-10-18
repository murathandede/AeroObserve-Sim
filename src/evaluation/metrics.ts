import type { SensorObservation } from '../shared/types';
export function metrics(delivered: SensorObservation[], sampleCount: number, availableCount: number) {
  return { availability: sampleCount ? availableCount / sampleCount * 100 : null, latencyMs: delivered.length ? delivered.reduce((sum, o) => sum + o.receivedAtSeconds - o.observedAtSeconds, 0) / delivered.length * 1000 : null, deliveredCount: delivered.length };
}
