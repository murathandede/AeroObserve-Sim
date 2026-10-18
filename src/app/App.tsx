import { useEffect, useRef, useState } from 'react';
import { Simulation } from '../simulation/engine';
import { metrics } from '../evaluation/metrics';
import { Scene, Thermal } from '../ui/Scene';
import scenario from '../../scenarios/default.json';
export function App() {
  const engine = useRef<Simulation | null>(null);
  if (!engine.current) engine.current = new Simulation(scenario);
  const [frame, setFrame] = useState(() => engine.current!.snapshot());
  const [running, setRunning] = useState(false), [speed, setSpeed] = useState(1), [seed, setSeed] = useState(String(scenario.seed));
  const [truth, setTruth] = useState(true), [observations, setObservations] = useState(true);
  const clock = useRef(0);
  const validSeed = /^\d+$/.test(seed) && Number(seed) <= 4294967295;
  useEffect(() => {
    if (!running) return;
    let previous = performance.now(), id = 0;
    const animate = (now: number) => {
      clock.current = Math.min(scenario.durationSeconds, clock.current + (now - previous) / 1000 * speed); previous = now;
      const sim = engine.current!; const old = sim.timeSeconds; sim.advanceTo(clock.current);
      if (old !== sim.timeSeconds) setFrame(sim.snapshot());
      if (clock.current >= scenario.durationSeconds) { setRunning(false); return; }
      id = requestAnimationFrame(animate);
    };
    id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [running, speed]);
  function reset() { if (!validSeed) return; setRunning(false); clock.current = 0; engine.current = new Simulation({ seed: Number(seed), durationSeconds: scenario.durationSeconds }); setFrame(engine.current.snapshot()); }
  const m = metrics(frame.delivered, frame.sampleCount, frame.availableCount);
  const ended = frame.world.timeSeconds >= scenario.durationSeconds;
  const state = ended ? 'Tamamlandı' : running ? 'Çalışıyor' : frame.world.timeSeconds === 0 ? 'Hazır' : 'Duraklatıldı';
  return <div className="shell">
    <header><div className="brand"><span className="brandmark">◈</span><div><h1>AeroObserve<span>-Sim</span></h1><p>SENTETİK GÖZLEM LABORATUVARI / v0.1</p></div></div><span className="demo">SENTETİK VERİ DEMOSU</span></header>
    <div className="intro"><div><p className="eyebrow">ARAŞTIRMA ÇALIŞMA ALANI / 01</p><h2>Gözlemden veriye.</h2><p>Tekrarlanabilir bir dünyada sensör davranışını keşfedin.</p></div><div className="session"><span className={'dot ' + (running ? 'live' : '')} />{state}<strong>{frame.world.timeSeconds.toFixed(1)} <small>/ 120 s</small></strong></div></div>
    <main>
      <aside className="panel controls"><div className="panel-title"><h3>Simülasyon</h3><span>01</span></div><label htmlFor="seed">Senaryo seed’i</label><input id="seed" inputMode="numeric" value={seed} onChange={e => setSeed(e.target.value)} aria-describedby="seed-help" aria-invalid={!validSeed}/><p id="seed-help" className="hint">{validSeed ? `Etkin seed: ${engine.current.config.seed}. Değişiklik sıfırlamayla uygulanır.` : '0–4294967295 arasında bir tam sayı girin.'}</p>
        <button className="primary" disabled={ended} onClick={() => setRunning(v => !v)}>{running ? 'Ⅱ Duraklat' : '▶ Başlat'}</button><button disabled={!validSeed} onClick={reset}>↻ Sıfırla ve seed’i uygula</button>
        <label htmlFor="speed">Oynatma hızı</label><select id="speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={.5}>0.5× · Yavaş</option><option value={1}>1× · Normal</option><option value={2}>2× · Hızlı</option><option value={4}>4× · Hızlı</option></select>
        <div className="divider"/><h3>Görünür katmanlar</h3><label className="check"><input type="checkbox" checked={truth} onChange={e => setTruth(e.target.checked)}/><span className="cyan">Gerçek durum</span></label><label className="check"><input type="checkbox" checked={observations} onChange={e => setObservations(e.target.checked)}/><span className="amber">Örnek gözlemler</span></label>
        <div className="scenario"><span className="eyebrow">ÖRNEK SENARYO</span><strong>Hareket & veri kesintisi</strong><p>6 genel nesne · 100 × 100 birim</p><p>20–28 s: sensör kesintisi<br/>0.2–0.8 s: teslim gecikmesi</p></div><p className="hint">Tüm veriler sentetiktir. Donanım bağlantısı yoktur.</p>
      </aside>
      <section className="panel scene"><div className="panel-title"><h3>2D gözlem sahnesi</h3><span>SOYUT KOORDİNATLAR</span></div><div className="legend"><span className="cyan">○ Gerçek durum</span><span className="amber">□ Teslim edilmiş gözlem</span></div><Scene world={frame.world} sensor={frame.sensor} truth={truth} observations={observations}/><div className="scene-footer"><span>{!frame.sensor.available ? 'Sensör kullanılamıyor · senaryo kesintisi' : frame.sensor.observations.length ? `${frame.sensor.observations.length} güncel gözlem · son 1 saniye` : 'Boş veri · güncel teslim edilmiş gözlem yok'}</span><span>10 Hz simülasyon</span></div></section>
      <aside className="panel thermal"><div className="panel-title"><h3>Termal görünüm</h3><span>02</span></div><p className="hint">48 × 48 / ÖRNEK MATRİS</p><div className="thermal-view"><Thermal frame={frame.thermal}/>{!frame.thermal.available && <span className="unavailable">Sensör kullanılamıyor</span>}</div><div className="scale"/><div className="scale-label"><span>0 · Düşük</span><span>1 · Yüksek</span></div><p className="disclaimer">Temsili yoğunluk — sıcaklık ölçümü değildir</p><div className="divider"/><h3>Veri kalitesi</h3><dl><div><dt>Veri kullanılabilirliği</dt><dd>{m.availability === null ? '—' : `${m.availability.toFixed(1)}%`}</dd></div><div><dt>Ort. teslim gecikmesi</dt><dd>{m.latencyMs === null ? '—' : `${m.latencyMs.toFixed(0)} ms`}</dd></div><div><dt>Toplam teslim</dt><dd>{m.deliveredCount}</dd></div><div><dt>Konum hatası</dt><dd>—</dd></div></dl><p className="hint">Kullanılabilirlik: erişilebilir örnekleme anları / tüm örnekleme anları. Konum hatası henüz hesaplanmıyor.</p></aside>
      <section className="panel log"><div className="panel-title"><h3>Olay günlüğü</h3><span>SON {frame.events.length} OLAY / EN YENİ ÜSTTE</span></div><div className="log-rows" tabIndex={0} aria-label="Kaydırılabilir olay günlüğü">{[...frame.events].reverse().map((e, i) => <div className="log-row" key={`${e.timeSeconds}-${e.source}-${i}`}><time>{e.timeSeconds.toFixed(1)} s</time><span className={e.severity === 'warning' ? 'amber' : 'cyan'}>{e.source}</span><span>{e.message}</span></div>)}</div></section>
    </main>
    <details className="panel data"><summary>Sayısal sahne verileri · erişilebilir görünüm</summary><table><caption>Simülasyondaki gerçek durum · soyut birimler</caption><thead><tr><th>Nesne</th><th>X</th><th>Y</th><th>Temsili yoğunluk</th></tr></thead><tbody>{truth && frame.world.objects.map(o => <tr key={o.id}><td>{o.id}</td><td>{o.position.x.toFixed(2)}</td><td>{o.position.y.toFixed(2)}</td><td>{o.thermalIntensity.toFixed(2)}</td></tr>)}</tbody></table><p>{observations ? `${frame.sensor.observations.length} teslim edilmiş güncel gözlem` : 'Gözlem katmanı kapalı'}</p>{observations && <ul>{frame.sensor.observations.map(o => <li key={o.id}>{o.id}: ({o.position.x.toFixed(2)}, {o.position.y.toFixed(2)}) · gözlem {o.observedAtSeconds.toFixed(1)} s → teslim {o.receivedAtSeconds.toFixed(1)} s</li>)}</ul>}</details>
    <footer><span>AEROOBSERVE-SIM / ÖĞRENCİ ARAŞTIRMA PROJESİ</span><span>Fiziksel sensör doğrulaması değildir.</span></footer>
  </div>;
}
