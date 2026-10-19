import { emptySelection, prepareRecordingSelection, type SelectionState } from './selection';

/** Selection-only lifecycle. It never opens or closes a reader or controls playback. */
export class SelectionController {
  private generation = 0;
  private controller: AbortController | null = null;
  constructor(private readonly manifest: unknown, private readonly publish: (state: SelectionState) => void) {}

  invalidate() {
    ++this.generation;
    this.controller?.abort();
    this.controller = null;
  }
  beginPicking() { this.invalidate(); this.publish(emptySelection('selecting')); }
  cancel() { this.invalidate(); this.publish(emptySelection('cancelled')); }
  reset() { this.invalidate(); this.publish(emptySelection()); }
  accessError() {
    this.invalidate();
    this.publish({ ...emptySelection('access-error'), issues: [{ code: 'FILE_ACCESS', message: 'Tarayıcının dosya listesine erişilemedi. Lütfen dosyaları yeniden seçin.' }] });
  }
  async select(selected: readonly File[]) {
    this.invalidate();
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    const files = [...selected];
    this.publish(emptySelection('checking', files.length));
    let result: SelectionState;
    try { result = await prepareRecordingSelection(this.manifest, files, controller.signal); }
    catch { result = { ...emptySelection('access-error', files.length), issues: [{ code: 'FILE_ACCESS', message: 'Seçim kontrol edilemedi. Dosyaları yeniden seçin.' }] }; }
    if (generation !== this.generation || controller.signal.aborted) return;
    this.controller = null;
    this.publish(result);
  }
}
