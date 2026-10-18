import type { WorldFrame, WorldObject } from '../shared/types';
import scenario from '../../scenarios/default.json';
export function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
export function createObjects(seed: number): WorldObject[] {
  const rng = random(seed);
  return Array.from({ length: scenario.objectCount }, (_, i) => ({ id: `N-${String(i + 1).padStart(2, '0')}`, position: { x: 15 + rng() * 70, y: 15 + rng() * 70 }, velocity: { x: (rng() - .5) * 5, y: (rng() - .5) * 5 }, thermalIntensity: .4 + rng() * .6 }));
}
export function worldAt(initial: WorldObject[], timeSeconds: number): WorldFrame {
  const reflect = (p: number, v: number) => {
    const phase = ((p + v * timeSeconds) % 200 + 200) % 200;
    return { position: phase <= 100 ? phase : 200 - phase, velocity: phase < 100 ? v : -v };
  };
  return { timeSeconds, objects: initial.map(o => { const x = reflect(o.position.x, o.velocity.x), y = reflect(o.position.y, o.velocity.y); return { ...o, position: { x: x.position, y: y.position }, velocity: { x: x.velocity, y: y.velocity } }; }) };
}
