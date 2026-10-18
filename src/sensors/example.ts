import type { SensorObservation, ThermalFrame, WorldFrame } from '../shared/types';
export function observe(world: WorldFrame, rng: () => number): SensorObservation[] {
  return world.objects.flatMap(o => {
    if (rng() < .12) return [];
    const noiseX = (rng() - .5) * 4, noiseY = (rng() - .5) * 4;
    return [{ id: `${world.timeSeconds}-${o.id}`, sensorId: 'S-01', observedAtSeconds: world.timeSeconds, receivedAtSeconds: Math.round((world.timeSeconds + .2 + rng() * .6) * 10) / 10, position: { x: Math.max(0, Math.min(100, o.position.x + noiseX)), y: Math.max(0, Math.min(100, o.position.y + noiseY)) }, quality: Math.max(0, 1 - Math.hypot(noiseX, noiseY) / 3) }];
  });
}
export function thermal(world: WorldFrame, available: boolean): ThermalFrame {
  const width = 48, height = 48;
  const pixels = available ? Array.from({ length: width * height }, (_, i) => {
    const x = (i % width + .5) * 100 / width, y = (Math.floor(i / width) + .5) * 100 / height;
    return Math.min(1, .025 + world.objects.reduce((sum, o) => sum + o.thermalIntensity * Math.exp(-((x - o.position.x) ** 2 + (y - o.position.y) ** 2) / 45), 0));
  }) : [];
  return { timeSeconds: world.timeSeconds, width, height, pixels, available };
}
