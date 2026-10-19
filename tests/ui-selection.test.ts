import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import manifestJson from '../data/manifests/tum-rgbd-freiburg1-desk.json';
import type { DatasetManifest, RecordingInput } from '../src/data';
import { snapshotTumInput } from '../src/data/tum/manifest';
import { inspectSelectionManifest, prepareRecordingSelection, emptySelection, type SelectionState } from '../src/ui/recording/selection';
import { SelectionController } from '../src/ui/recording/selectionController';
import { LocalRecordingSelection, SelectionFeedback } from '../src/ui/recording/LocalRecordingSelection';

const manifest = manifestJson as DatasetManifest;
const paths = manifest.acquisition.files;
// Artificial File payloads test selection only. They are NOT original TUM PNG/TXT data.
function fileAt(path: string, options: { prefix?: string; type?: string; name?: string; empty?: boolean } = {}) {
  const file = new File(options.empty ? [] : ['ARTIFICIAL SELECTION TEST; NOT TUM CONTENT'], options.name ?? path.split('/').at(-1)!, {
    type: options.type ?? (path.endsWith('.png') ? 'image/png' : 'text/plain'), lastModified: 0,
  });
  Object.defineProperty(file, 'webkitRelativePath', { value: `${options.prefix ?? ''}${path}` });
  return file;
}
const selection = (prefix = '') => paths.map(path => fileAt(path, { prefix }));

test('YAPAY SEÇİM: matching paths prepare the shared input, preserve File identity and snapshot the manifest', async () => {
  const original = structuredClone(manifest);
  const files = selection();
  const result = await prepareRecordingSelection(original, files);
  assert.equal(result.status, 'valid'); assert.ok(result.input);
  assert.equal(result.selectedCount, 10); assert.equal(result.input.files.size, 10);
  for (let i = 0; i < files.length; i++) assert.equal(result.input.files.get(paths[i]), files[i]);
  original.recording.name = 'changed after preparation';
  assert.equal(result.input.manifest.recording.name, manifest.recording.name);
  for (const stream of ['rgb', 'depth'] as const) assert.ok(snapshotTumInput(result.input, stream).ok);
  assert.deepEqual(result.missingFiles, []); assert.deepEqual(result.issues, []);
});

test('YAPAY SEÇİM: only the documented sample wrapper is removed', async () => {
  const files = selection(`${manifest.recording.id}/`);
  const result = await prepareRecordingSelection(manifest, files);
  assert.equal(result.status, 'valid'); assert.ok(result.input);
  assert.deepEqual([...result.input.files.keys()], paths);
  assert.equal(result.input.files.get(paths[0]), files[0]);
});

test('YAPAY SEÇİM: empty selection produces no input and no invented access error', async () => {
  const result = await prepareRecordingSelection(manifest, []);
  assert.equal(result.status, 'invalid'); assert.equal(result.input, null);
  assert.equal(result.issues[0].code, 'EMPTY_SELECTION'); assert.equal(result.selectedCount, 0);
});

test('YAPAY SEÇİM: a missing file has its exact manifest path and never yields a partial input', async () => {
  const result = await prepareRecordingSelection(manifest, selection().slice(1));
  assert.equal(result.status, 'missing'); assert.equal(result.input, null);
  assert.deepEqual(result.missingFiles, [paths[0]]);
});

test('YAPAY SEÇİM: extra PNG is reported and rejected rather than silently included or discarded', async () => {
  const extra = 'rgbd_dataset_freiburg1_desk/rgb/extra.png';
  const result = await prepareRecordingSelection(manifest, [...selection(), fileAt(extra)]);
  assert.equal(result.status, 'invalid'); assert.equal(result.input, null);
  assert.deepEqual(result.extraFiles, [extra]); assert.ok(result.issues.some(issue => issue.code === 'EXTRA_FILES'));
});

test('YAPAY SEÇİM: duplicate normalized paths cannot overwrite an earlier File', async () => {
  const result = await prepareRecordingSelection(manifest, [...selection(), fileAt(paths[0], { prefix: `${manifest.recording.id}/` })]);
  assert.equal(result.status, 'invalid'); assert.equal(result.input, null);
  assert.ok(result.issues.some(issue => issue.code === 'DUPLICATE_PATH' && issue.file === paths[0]));
});

test('YAPAY SEÇİM: unsupported extension and misleading MIME are separate from content validation', async () => {
  const unsupported = await prepareRecordingSelection(manifest, [...selection(), fileAt('rgbd_dataset_freiburg1_desk/video.mp4', { type: 'video/mp4' })]);
  assert.equal(unsupported.status, 'unsupported'); assert.equal(unsupported.input, null);
  const files = selection();
  const pngIndex = paths.findIndex(path => path.endsWith('.png'));
  files[pngIndex] = fileAt(paths[pngIndex], { type: 'text/plain' });
  assert.equal((await prepareRecordingSelection(manifest, files)).status, 'unsupported');
  // MIME may be empty or generic. Neither a .png suffix nor MIME proves PNG structure.
  assert.equal((await prepareRecordingSelection(manifest, paths.map(path => fileAt(path, { type: '' })))).status, 'valid');
  assert.equal((await prepareRecordingSelection(manifest, paths.map(path => fileAt(path, { type: 'application/octet-stream' })))).status, 'valid');
});

test('YAPAY SEÇİM: existing v1 validator rejects incomplete manifests, unsafe/duplicate manifest paths and synthetic provenance', () => {
  for (const candidate of [null, {}, { ...manifest, timing: null }, { ...manifest, recording: { ...manifest.recording, license: undefined } },
    { ...manifest, acquisition: { ...manifest.acquisition, files: ['../rgb.txt'] } },
    { ...manifest, acquisition: { ...manifest.acquisition, files: [...paths, paths[0]] } }]) {
    assert.equal(inspectSelectionManifest(candidate).ok, false);
  }
  const synthetic = inspectSelectionManifest({ ...manifest, recording: { ...manifest.recording, provenance: 'synthetic' } });
  assert.equal(synthetic.ok, false);
  if (!synthetic.ok) assert.equal(synthetic.status, 'unsupported');
  assert.equal(inspectSelectionManifest({ ...manifest, notJson: () => {} }).ok, false);
});

test('YAPAY SEÇİM: invalid selected paths, wrong folder and inconsistent filename cannot be repaired by basename guessing', async () => {
  for (const changed of [
    fileAt('../escape.png'), fileAt('/absolute/rgb.txt'), fileAt('rgbd_dataset_freiburg1_desk/%2e%2e/rgb.txt'),
    fileAt(paths[0], { prefix: 'unrelated/' }), fileAt(paths[0], { prefix: `outer/${manifest.recording.id}/` }),
    fileAt(paths[0], { name: 'other.txt' }),
  ]) {
    const result = await prepareRecordingSelection(manifest, [changed, ...selection().slice(1)]);
    assert.equal(result.status, 'invalid'); assert.equal(result.input, null);
  }
  const basenames = selection().map(file => new File([file], file.name, { type: file.type }));
  const noPath = await prepareRecordingSelection(manifest, basenames);
  assert.equal(noPath.status, 'invalid'); assert.ok(noPath.issues.some(issue => issue.code === 'RELATIVE_PATH_REQUIRED'));
});

test('YAPAY SEÇİM: blobs without File identity and zero-length files are invalid', async () => {
  const wrongType = await prepareRecordingSelection(manifest, [new Blob(['test']) as File, ...selection().slice(1)]);
  assert.equal(wrongType.status, 'invalid'); assert.ok(wrongType.issues.some(issue => issue.code === 'NOT_A_FILE'));
  const empty = await prepareRecordingSelection(manifest, [fileAt(paths[0], { empty: true }), ...selection().slice(1)]);
  assert.equal(empty.status, 'invalid'); assert.ok(empty.issues.some(issue => issue.code === 'EMPTY_FILE'));
});

test('YAPAY SEÇİM: readability probes are bounded to one byte per expected File, never full-file reads', async () => {
  let probes = 0;
  const files = selection();
  for (const file of files) {
    const slice = file.slice.bind(file);
    Object.defineProperty(file, 'arrayBuffer', { value: () => { throw new Error('Full-file read is forbidden in selection'); } });
    Object.defineProperty(file, 'slice', { value: (start: number, end: number) => {
      assert.equal(start, 0); assert.equal(end, 1); probes++; return slice(start, end);
    } });
  }
  assert.equal((await prepareRecordingSelection(manifest, files)).status, 'valid');
  assert.equal(probes, 10);
});

test('YAPAY SEÇİM: a failed File access produces access-error with recovery path', async () => {
  const files = selection();
  Object.defineProperty(files[0], 'slice', { value: () => { throw new Error('Access denied'); } });
  const result = await prepareRecordingSelection(manifest, files);
  assert.equal(result.status, 'access-error'); assert.equal(result.input, null);
  assert.equal(result.issues[0].file, paths[0]);
});

function delayedSelection() {
  let reject!: (error: Error) => void;
  const bytes = new Promise<ArrayBuffer>((_resolve, rejectPromise) => { reject = rejectPromise; });
  const files = selection();
  Object.defineProperty(files[0], 'slice', { value: () => ({ arrayBuffer: () => bytes }) });
  return { files, reject };
}

test('YAPAY SEÇİM: a new selection supersedes pending work and late rejection cannot replace the current input', { timeout: 3000 }, async () => {
  const states: SelectionState[] = [];
  let prepared: RecordingInput | null = null;
  const controller = new SelectionController(manifest, state => { states.push(state); prepared = state.input; });
  const old = delayedSelection();
  const pending = controller.select(old.files);
  const currentFiles = selection();
  await controller.select(currentFiles);
  await pending;
  assert.equal(states.at(-1)?.status, 'valid'); assert.ok(prepared);
  assert.equal((prepared as RecordingInput).files.get(paths[0]), currentFiles[0]);
  const count = states.length;
  old.reject(new Error('Late old access failure'));
  await Promise.resolve();
  assert.equal(states.length, count);
});

test('YAPAY SEÇİM: cancelling or unmount invalidation clears pending work without publishing a late result', { timeout: 3000 }, async () => {
  for (const action of ['cancel', 'invalidate'] as const) {
    const states: SelectionState[] = [];
    const controller = new SelectionController(manifest, state => states.push(state));
    controller.beginPicking(); assert.equal(states.at(-1)?.status, 'selecting');
    const old = delayedSelection();
    const pending = controller.select(old.files);
    assert.equal(states.at(-1)?.status, 'checking');
    controller[action](); const count = states.length;
    await pending;
    assert.equal(states.length, count);
    assert.equal(states.at(-1)?.input, null);
    if (action === 'cancel') assert.equal(states.at(-1)?.status, 'cancelled');
    old.reject(new Error('Late cancelled access failure')); await Promise.resolve();
  }
});

test('YAPAY SEÇİM: corrected and repeated selections clear old errors and staged input; reset releases File references', async () => {
  let state = emptySelection();
  const controller = new SelectionController(manifest, next => { state = next; });
  await controller.select(selection().slice(1)); assert.equal(state.status, 'missing');
  const files = selection();
  await controller.select(files); assert.equal(state.status, 'valid'); assert.deepEqual(state.issues, []);
  const input = state.input; assert.ok(input);
  controller.beginPicking(); assert.equal(state.input, null); assert.deepEqual(state.missingFiles, []);
  await controller.select(files); assert.equal(state.status, 'valid'); assert.notEqual(state.input, input);
  controller.reset(); assert.equal(state.status, 'idle'); assert.equal(state.input, null); assert.equal(state.selectedCount, 0);
});

test('UI: built-in dataset source/license/format are manifest-backed and readiness never implies decoding or hash verification', () => {
  const html = renderToStaticMarkup(createElement(LocalRecordingSelection));
  assert.ok(html.includes(manifest.recording.name));
  assert.ok(html.includes(manifest.recording.source.url!));
  assert.ok(manifest.recording.license.status === 'known' && html.includes(manifest.recording.license.value));
  assert.ok(html.includes(renderToStaticMarkup(createElement('p', null, manifest.format.status === 'known' ? manifest.format.value : 'Biçim bilinmiyor'))));
  assert.match(html, /rgb \/ depth/); assert.match(html, /Manifestte belirtilmemiş/);
  assert.match(html, /PNG\/TXT yapısı veya SHA-256 doğrulanmadı/);
  assert.match(html, /Henüz dosya seçilmedi/);
  const feedback = renderToStaticMarkup(createElement(SelectionFeedback, { state: { ...emptySelection('valid', 10), input: { manifest, files: new Map() } }, prepared: true }));
  assert.match(feedback, /uygulama state’inde hazır/); assert.match(feedback, /hazırlanan seçim otomatik açılmaz/);
});

test('GERÇEK TUM SEÇİMİ: original local files match manifest paths and create an input when installed', async context => {
  const files: File[] = [];
  for (const path of paths) {
    let bytes: Buffer;
    try { bytes = await readFile(new URL(`../data/local/tum-rgbd-freiburg1-desk/${path}`, import.meta.url)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      context.skip(`Özgün TUM dosyası yok: ${path}. Bu gerçek seçim testi tamamlanmadı.`); return;
    }
    const file = new File([new Uint8Array(bytes)], path.split('/').at(-1)!, { type: path.endsWith('.png') ? 'image/png' : 'text/plain' });
    Object.defineProperty(file, 'webkitRelativePath', { value: path }); files.push(file);
  }
  const result = await prepareRecordingSelection(manifest, files);
  assert.equal(result.status, 'valid'); assert.ok(result.input); assert.equal(result.input.files.size, 10);
  for (let i = 0; i < files.length; i++) assert.equal(result.input.files.get(paths[i]), files[i]);
});
