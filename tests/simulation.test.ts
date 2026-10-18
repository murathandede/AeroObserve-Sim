import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation/engine';
import { metrics } from '../src/evaluation/metrics';
const config = { seed: 42, durationSeconds: 120 };
test('Aynı seed, farklı render/adım sıklıklarında aynı sonuçları verir', () => {
  const a = new Simulation(config), b = new Simulation(config);
  a.advanceTo(35);
  for (let t = 1; t <= 350; t++) { b.advanceTo(t / 10); b.snapshot(); }
  assert.deepEqual(a.snapshot(), b.snapshot());
  const c = new Simulation({ ...config, seed: 43 }); c.advanceTo(35);
  assert.notDeepEqual(a.snapshot().world, c.snapshot().world);
});
test('Sıfırlama başlangıç durumunu ve rastgele sayı akışını geri getirir', () => {
  let sim = new Simulation(config); const initial = sim.snapshot(); sim.advanceTo(12); const later = sim.snapshot();
  sim = new Simulation(config); assert.deepEqual(sim.snapshot(), initial); sim.advanceTo(12); assert.deepEqual(sim.snapshot(), later);
});
test('Gözlemler teslimden önce görünmez ve tek kez teslim edilir', () => {
  const sim = new Simulation(config); sim.advanceTo(.6); assert.equal(sim.snapshot().delivered.length, 0);
  for (let i = 7; i <= 150; i++) {
    sim.advanceTo(i / 10); const s = sim.snapshot();
    assert.ok(s.delivered.every(o => o.receivedAtSeconds <= s.world.timeSeconds && o.receivedAtSeconds > o.observedAtSeconds));
    assert.equal(new Set(s.delivered.map(o => o.id)).size, s.delivered.length);
  }
  assert.ok(sim.snapshot().delivered.length > 0);
});
test('Saat ilerletilmedikçe durum sabittir; süre sınırı aşılmaz', () => {
  const sim = new Simulation(config); sim.advanceTo(3); const before = sim.snapshot();
  assert.deepEqual(sim.snapshot(), before); sim.advanceTo(2); assert.deepEqual(sim.snapshot(), before);
  sim.advanceTo(999); assert.equal(sim.timeSeconds, 120);
});
test('Kesinti, yeniden erişim ve ölçümler gerçek veriyi yansıtır', () => {
  const sim = new Simulation(config); assert.equal(metrics([], 0, 0).latencyMs, null);
  sim.advanceTo(20); let s = sim.snapshot(); assert.equal(s.sensor.available, false); assert.deepEqual(s.thermal.pixels, []); assert.deepEqual(s.sensor.observations, []);
  sim.advanceTo(28); s = sim.snapshot(); assert.equal(s.sensor.available, true); assert.equal(s.thermal.pixels.length, 48 * 48); assert.ok(s.thermal.pixels.every(v => v >= 0 && v <= 1));
  const m = metrics(s.delivered, s.sampleCount, s.availableCount); assert.equal(m.availability, 40 / 56 * 100); assert.ok(m.latencyMs! >= 200 && m.latencyMs! <= 800);
});
