import type { SimConfig, SensorObservation, SensorFrame, SimulationEvent } from '../shared/types';
import scenario from '../../scenarios/default.json';
import { createObjects, random, worldAt } from './world';
import { observe, thermal } from '../sensors/example';
export class Simulation {
  readonly config: SimConfig;
  private initial;
  private rng;
  private tick = 0;
  private pending: SensorObservation[] = [];
  private delivered: SensorObservation[] = [];
  private available = true;
  private events: SimulationEvent[] = [];
  private sampleCount = 0;
  private availableCount = 0;
  constructor(config: SimConfig) {
    if (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 4294967295 || !Number.isFinite(config.durationSeconds) || config.durationSeconds <= 0) throw new Error('Geçersiz simülasyon ayarı');
    this.config = { ...config }; this.initial = createObjects(config.seed); this.rng = random(config.seed ^ 0xabc123);
    this.events.push({ timeSeconds: 0, severity: 'info', source: 'DÜNYA', message: `Seed ${config.seed} ile 6 sentetik nesne hazır.` });
  }
  get timeSeconds() { return this.tick / 10; }
  advanceTo(seconds: number) {
    const target = Math.floor(Math.min(seconds, this.config.durationSeconds) * 10 + 1e-8);
    while (this.tick < target) {
      this.tick++;
      const t = this.timeSeconds;
      const next = !(t >= scenario.outageStartSeconds && t < scenario.outageEndSeconds);
      if (next !== this.available) this.events.push({ timeSeconds: t, severity: next ? 'info' : 'warning', source: 'S-01', message: next ? 'Örnek sensörler yeniden kullanılabilir.' : 'Senaryo kesintisi: örnek sensörler kullanılamıyor.' });
      this.available = next;
      if (this.tick % scenario.sampleEveryTicks === 0) { this.sampleCount++; if (next) { this.availableCount++; this.pending.push(...observe(worldAt(this.initial, t), this.rng)); } }
      const ready = this.pending.filter(o => o.receivedAtSeconds <= t);
      this.pending = this.pending.filter(o => o.receivedAtSeconds > t);
      this.delivered.push(...ready);
      if (ready.length) this.events.push({ timeSeconds: t, severity: 'info', source: 'S-01', message: `${ready.length} gözlem teslim edildi.` });
      this.events = this.events.slice(-80);
    }
  }
  snapshot() {
    const world = worldAt(this.initial, this.timeSeconds);
    const sensor: SensorFrame = { sensorId: 'S-01', timeSeconds: this.timeSeconds, available: this.available, observations: this.available ? this.delivered.filter(o => this.timeSeconds - o.receivedAtSeconds <= 1) : [] };
    return { world, sensor, thermal: thermal(world, this.available), events: [...this.events], delivered: [...this.delivered], sampleCount: this.sampleCount, availableCount: this.availableCount };
  }
}
