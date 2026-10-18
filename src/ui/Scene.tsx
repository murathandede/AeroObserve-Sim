import { useEffect, useRef } from 'react';
import type { SensorFrame, WorldFrame, ThermalFrame } from '../shared/types';
export function Scene({ world, sensor, truth, observations }: { world: WorldFrame; sensor: SensorFrame; truth: boolean; observations: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!, ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, 800, 600);
    const x = (v: number) => 45 + v * 7.1, y = (v: number) => 555 - v * 5.1;
    ctx.font = '11px monospace';
    for (let i = 0; i <= 100; i += 10) {
      ctx.strokeStyle = '#203345'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x(i), y(0)); ctx.lineTo(x(i), y(100)); ctx.moveTo(x(0), y(i)); ctx.lineTo(x(100), y(i)); ctx.stroke();
      ctx.fillStyle = '#8ba1b7'; ctx.fillText(String(i), x(i) - 7, 578); ctx.fillText(String(i), 13, y(i) + 4);
    }
    ctx.fillText('X / SOYUT SAHNE BİRİMİ', 575, 598);
    if (truth) for (const o of world.objects) {
      const px = x(o.position.x), py = y(o.position.y);
      ctx.strokeStyle = '#53e5cb'; ctx.fillStyle = '#53e5cb'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + o.velocity.x * 9, py - o.velocity.y * 9); ctx.stroke(); ctx.fillText(o.id, px + 12, py - 10);
    }
    if (observations) for (const o of sensor.observations) { ctx.strokeStyle = '#ffbf69'; ctx.lineWidth = 1.5; ctx.strokeRect(x(o.position.x) - 4, y(o.position.y) - 4, 8, 8); }
  }, [world, sensor, truth, observations]);
  return <canvas ref={ref} width={800} height={600} role="img" aria-label={`2D sentetik sahne. ${world.objects.length} nesne; ${sensor.observations.length} güncel teslim edilmiş gözlem. Katman ayrıntıları aşağıdaki tabloda.`} />;
}
export function Thermal({ frame }: { frame: ThermalFrame }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, 240, 240);
    if (!frame.available) return;
    frame.pixels.forEach((v, i) => { ctx.fillStyle = `rgb(${Math.round(12 + v * 243)},${Math.round(18 + v * 178)},${Math.round(40 + Math.sin(v * Math.PI) * 75)})`; ctx.fillRect(i % frame.width * 5, Math.floor(i / frame.width) * 5, 5, 5); });
  }, [frame]);
  return <canvas ref={ref} width={240} height={240} role="img" aria-label={frame.available ? '48 × 48 temsili boyutsuz yoğunluk matrisi' : 'Termal veri kullanılamıyor'} />;
}
