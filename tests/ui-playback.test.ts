import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FrameRecord, ReaderResult, RecordingBinding, RecordingMetadata, RecordingReader } from '../src/shared/types';
import { exampleBinding, exampleInput } from '../src/demo/recording/example';
import { isApiPosition, isPresentationSpeed, playbackAvailability } from '../src/playback/playbackPolicy';
import { schedulePresentationStep } from '../src/playback/useRecording';
import { ReaderSession } from '../src/playback/readerSession';
import { PlaybackControls, PlaybackNavigation } from '../src/ui/recording/PlaybackControls';
import { seekFromInput } from '../src/ui/recording/playbackInput';
import { FrameViewer } from '../src/ui/recording/FrameViewer';

// Synthetic/mock evidence only. No original TUM data, browser DOM or sensor timing.
const metadata: RecordingMetadata = {
  recording: exampleInput.manifest.recording, frameCount: 3, format: 'SYNTHETIC TEST',
  timing: exampleInput.manifest.timing, radiometry: exampleInput.manifest.radiometry,
  reader: { id: 'SYNTHETIC TEST', version: 'test' },
};
const noop = () => {};
const base = { metadata, opened: true, loading: false, error: null, index: 1, playing: false, speed: 1,
  onSeek: noop as (index: number) => void, onPlayingChange: noop as (playing: boolean) => void,
  onSpeedChange: noop as (speed: number) => void, helpId: 'speed-help', timelineId: 'timeline-help' };

interface ControlProps {
  children?: ReactNode;
  type?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  value?: number;
  'aria-valuetext'?: string;
  onClick?: () => void;
  onChange?: (event: { target: { value: string } }) => void;
}
function controls(tree: ReactNode, tag: string): ControlProps[] {
  return Children.toArray(tree).flatMap(node => {
    if (!isValidElement<ControlProps>(node)) return [];
    return [...(node.type === tag ? [node.props] : []), ...controls(node.props.children, tag)];
  });
}
function button(tree: ReactNode, label: string): ControlProps {
  const result = controls(tree, 'button').find(props => Children.toArray(props.children).join('') === label);
  assert.ok(result, label); return result;
}

for (const [label, expected] of [['İlk kare', 0], ['← Önceki', 0], ['Sonraki →', 2], ['Son kare', 2]] as const) {
  test(`playback callback: ${label} seeks API ${expected}`, () => {
    const received: number[] = [];
    const tree = PlaybackNavigation({ ...base, onSeek: index => received.push(index) });
    const control = button(tree, label); assert.equal(control.disabled, false); control.onClick!();
    assert.deepEqual(received, [expected]);
  });
}

test('playback callback: play and pause use the existing boolean callback, including pause while loading', () => {
  const received: boolean[] = [];
  button(PlaybackNavigation({ ...base, onPlayingChange: value => received.push(value) }), 'Oynat').onClick!();
  const pause = button(PlaybackNavigation({ ...base, playing: true, loading: true, onPlayingChange: value => received.push(value) }), 'Duraklat');
  assert.equal(pause.disabled, false); pause.onClick!(); assert.deepEqual(received, [true, false]);
});

test('playback callback: slider sends zero-based API positions while announcing one-based order', () => {
  const received: number[] = [];
  const range = controls(PlaybackNavigation({ ...base, onSeek: index => received.push(index) }), 'input')[0];
  assert.deepEqual([range.min, range.max, range.value], [0, 2, 1]);
  assert.equal(range['aria-valuetext'], 'Görsel sıra 2 / 3; API pozisyonu 1');
  range.onChange!({ target: { value: '2' } }); assert.deepEqual(received, [2]);
  for (const value of ['-1', '3', '1.5', '']) range.onChange!({ target: { value } });
  assert.deepEqual(received, [2]);
});

test('playback callback: speed accepts only the existing positive finite cadence choices', () => {
  const received: number[] = [];
  const select = controls(PlaybackNavigation({ ...base, onSpeedChange: speed => received.push(speed) }), 'select')[0];
  for (const value of ['0.5', '1', '2', '0', '-1', 'NaN', 'Infinity', '3', '']) select.onChange!({ target: { value } });
  assert.deepEqual(received, [.5, 1, 2]);
  for (const value of [NaN, Infinity, 0, -1, .1]) assert.equal(isPresentationSpeed(value), false);
});

test('position search: valid zero-based API index is passed unchanged, not treated as source index', () => {
  const received: number[] = [];
  assert.deepEqual(seekFromInput(' 1 ', 3, index => received.push(index)), { ok: true, index: 1 });
  assert.deepEqual(seekFromInput('0', 3, index => received.push(index)), { ok: true, index: 0 });
  assert.deepEqual(received, [1, 0]);
  assert.equal(seekFromInput('306', 3, index => received.push(index)).ok, false);
  assert.deepEqual(received, [1, 0]);
});

for (const [description, input, message] of [
  ['negative', '-1', '0 ile 2'], ['out of bounds', '3', '0 ile 2'],
  ['empty', '', 'Bir API pozisyonu'], ['whitespace', '  ', 'Bir API pozisyonu'],
  ['non-numeric', 'abc', 'tam sayı'], ['fractional', '1.5', 'tam sayı'],
  ['exponent', '1e0', 'tam sayı'], ['infinite', 'Infinity', 'tam sayı'],
] as const) {
  test(`position search: ${description} is rejected without seeking`, () => {
    const received: number[] = [];
    const result = seekFromInput(input, 3, index => received.push(index));
    assert.equal(result.ok, false); if (!result.ok) assert.ok(result.message.includes(message));
    assert.deepEqual(received, []);
  });
}

test('playback bounds: first/last, zero/one frame and failed/closed sessions expose only valid controls', () => {
  for (const count of [0, 1]) {
    const tree = PlaybackNavigation({ ...base, index: 0, metadata: { ...metadata, frameCount: count } });
    assert.ok(controls(tree, 'button').every(control => control.disabled));
    assert.equal(controls(tree, 'input')[0].disabled, count === 0);
    assert.equal(isApiPosition(1, count), false);
  }
  const first = PlaybackNavigation({ ...base, index: 0 });
  assert.ok(button(first, 'İlk kare').disabled); assert.ok(button(first, '← Önceki').disabled);
  const last = PlaybackNavigation({ ...base, index: 2 });
  for (const label of ['Sonraki →', 'Son kare', 'Oynat']) assert.ok(button(last, label).disabled);
  assert.equal(button(last, 'İlk kare').disabled, false);
  for (const override of [{ opened: false }, { error: { code: 'DECODE_FAILED' as const, message: 'MOCK', recovery: 'Yeniden açın.' } }]) {
    const tree = PlaybackNavigation({ ...base, ...override });
    assert.ok(controls(tree, 'button').every(control => control.disabled));
    assert.ok(controls(tree, 'input')[0].disabled);
  }
});

test('playback loading: navigation remains available for rapid seek, while starting playback waits for a frame', () => {
  const tree = PlaybackNavigation({ ...base, loading: true });
  assert.equal(button(tree, 'Son kare').disabled, false);
  assert.equal(controls(tree, 'input')[0].disabled, false);
  assert.equal(button(tree, 'Oynat').disabled, true);
});

test('playback UI: subset, unknown time, cadence, numeric labels and empty state are explicit (SSR only)', () => {
  const html = renderToStaticMarkup(createElement(PlaybackControls, base));
  assert.match(html, /küçük manifest alt kümesidir/); assert.match(html, /saniye ekseni değildir/);
  assert.match(html, /Kaynak zamanına göre arama desteklenmiyor/);
  assert.match(html, /gerçek kayıt hızı veya sensör FPS/);
  assert.match(html, /API pozisyonuna git/); assert.match(html, /inputMode="numeric"/);
  assert.match(html, /aria-describedby=/); assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /30 FPS|30 Hz|type="time"/);
  const empty = renderToStaticMarkup(createElement(PlaybackControls, { ...base, metadata: { ...metadata, frameCount: 0 } }));
  assert.match(empty, /Boş kayıt/); assert.match(empty, /aria-valuetext="Kare yok"/);
  assert.doesNotMatch(empty, /Görsel sıra 1 \/ 0/);
});

class FakeClock {
  next = 0;
  maximumPending = 0;
  pending = new Map<number, { callback: () => void; delay: number }>();
  setTimeout = (callback: () => void, delay: number) => {
    const id = ++this.next; this.pending.set(id, { callback, delay });
    this.maximumPending = Math.max(this.maximumPending, this.pending.size); return id;
  };
  clearTimeout = (id: number) => { this.pending.delete(id); };
  fire() {
    const first = this.pending.entries().next().value; assert.ok(first);
    const [id, scheduled] = first; this.pending.delete(id); scheduled.callback();
  }
}
const step = { current: true, playing: true, count: 3, index: 0, frameIndex: 0, loading: false, failed: false, speed: 1 };

test('presentation effect: one loaded frame schedules one step, then waits for the next loaded frame', () => {
  const clock = new FakeClock(), advanced: number[] = [];
  const cleanup = schedulePresentationStep(step, index => advanced.push(index), noop, () => true, clock);
  assert.equal(clock.pending.size, 1); assert.equal([...clock.pending.values()][0].delay, 1000);
  clock.fire(); assert.deepEqual(advanced, [1]); assert.equal(clock.pending.size, 0); cleanup?.();
  schedulePresentationStep({ ...step, index: 1, frameIndex: 0, loading: true }, index => advanced.push(index), noop, () => true, clock);
  assert.equal(clock.pending.size, 0); assert.deepEqual(advanced, [1]);
});

test('presentation effect: speed changes replace the existing timeout; cleanup/close/unmount contract leaves none', () => {
  const clock = new FakeClock(); let cleanup: (() => void) | undefined;
  for (const [speed, delay] of [[1, 1000], [2, 500], [.5, 2000]]) {
    cleanup?.(); cleanup = schedulePresentationStep({ ...step, speed }, noop, noop, () => true, clock);
    assert.equal(clock.pending.size, 1); assert.equal([...clock.pending.values()][0].delay, delay);
  }
  assert.equal(clock.maximumPending, 1);
  cleanup?.(); cleanup?.(); assert.equal(clock.pending.size, 0);
  for (const state of [{ ...step, current: false }, { ...step, playing: false }]) {
    schedulePresentationStep(state, noop, noop, () => true, clock); assert.equal(clock.pending.size, 0);
  }
});

test('presentation effect: last/zero/one frame stop without wrapping or scheduling, and cannot restart there', () => {
  const clock = new FakeClock(); let stops = 0; const advanced: number[] = [];
  for (const state of [{ ...step, count: 0 }, { ...step, count: 1 }, { ...step, index: 2, loading: true }]) {
    schedulePresentationStep(state, index => advanced.push(index), () => stops++, () => true, clock);
  }
  assert.equal(stops, 3); assert.equal(clock.pending.size, 0); assert.deepEqual(advanced, []);
  assert.equal(playbackAvailability(true, 3, 2, false, false, false).play, false);
  assert.equal(playbackAvailability(true, 3, 0, false, false, false).play, true);
});

test('presentation effect: an obsolete owner/command blocks a queued timer even before passive cleanup', () => {
  for (const invalidate of ['owner switch', 'pause', 'seek', 'speed change', 'close']) {
    const clock = new FakeClock(); let current = true; const advanced: number[] = [];
    const cleanup = schedulePresentationStep(step, index => advanced.push(index), noop, () => current, clock);
    current = false; clock.fire(); assert.deepEqual(advanced, [], invalidate); cleanup?.();
  }
});

test('presentation effect: a queued callback after cleanup cannot advance, including setup/cleanup/setup', () => {
  const clock = new FakeClock(), advanced: number[] = [];
  const cleanup = schedulePresentationStep(step, index => advanced.push(index), noop, () => true, clock);
  const abandoned = [...clock.pending.values()][0].callback;
  cleanup?.();
  const nextCleanup = schedulePresentationStep(step, index => advanced.push(index), noop, () => true, clock);
  abandoned(); assert.deepEqual(advanced, []); assert.equal(clock.pending.size, 1);
  clock.fire(); assert.deepEqual(advanced, [1]); nextCleanup?.(); assert.equal(clock.pending.size, 0);
});

test('presentation effect: failed frame and invalid cadence stop, missing/currently loading frames never tick', () => {
  const clock = new FakeClock(); let stops = 0;
  for (const state of [{ ...step, failed: true }, { ...step, speed: 0 }, { ...step, speed: Infinity }]) {
    schedulePresentationStep(state, noop, () => stops++, () => true, clock);
  }
  assert.equal(stops, 3);
  for (const state of [{ ...step, frameIndex: null }, { ...step, frameIndex: 2 }, { ...step, loading: true }]) {
    schedulePresentationStep(state, noop, () => stops++, () => true, clock);
  }
  assert.equal(stops, 3); assert.equal(clock.pending.size, 0);
});

test('MOCK rapid seek: latest frame wins, late errors/successes are ignored, loading hides the old image', async () => {
  const pending = new Map<number, (result: ReaderResult<FrameRecord>) => void>();
  const mockFrame = (index: number): FrameRecord => ({ index, image: { url: `blob:SYNTHETIC-${index}`, width: 640, height: 480, alt: 'YAPAY TEST' }, time: { kind: 'unknown' } });
  const reader: RecordingReader = {
    open: async () => ({ ok: true, value: metadata }), getMetadata: () => ({ ok: true, value: metadata }),
    getState: () => ({ status: 'ready' }), close: async () => {},
    getFrame: index => new Promise(resolve => pending.set(index, resolve)),
  };
  const binding: RecordingBinding = { ...exampleBinding, createReader: () => reader };
  const session = new ReaderSession(binding); await session.open();
  try {
    const first = session.getFrame(0), middle = session.getFrame(1), last = session.getFrame(2);
    pending.get(2)!({ ok: true, value: mockFrame(2) });
    const latest = await last; assert.ok(latest?.ok); assert.equal(latest.value.frame.index, 2);
    pending.get(0)!({ ok: true, value: mockFrame(0) });
    pending.get(1)!({ ok: false, error: { code: 'DECODE_FAILED', message: 'OLD MOCK', recovery: 'MOCK' } });
    assert.equal(await first, null); assert.equal(await middle, null);
    const html = renderToStaticMarkup(createElement(FrameViewer, { recording: metadata.recording, metadata, frame: mockFrame(0), opened: true, loading: true, error: null }));
    assert.doesNotMatch(html, /<img|blob:SYNTHETIC-0/); assert.match(html, /Kare yükleniyor/);
  } finally { await session.close(); }
});
