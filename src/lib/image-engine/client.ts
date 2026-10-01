import { isIdentity, type EngineRequest, type EngineResponse, type ExportOptions, type ExportResult, type ImageInfo, type ImageInput, type Preview, type Transformations } from './types';

type Request = EngineRequest extends infer T ? T extends { id: number } ? Omit<T, 'id'> : never : never;
export class EngineClient {
  private worker!: Worker;
  private sequence = 0;
  private epoch = 0;
  private opened?: { id: string; promise: Promise<ImageInfo> };
  private pending = new Map<number, { resolve: (response: EngineResponse) => void; reject: (error: Error) => void; progress?: (value: number) => void }>();
  constructor(private readonly role: 'preview' | 'encode' = 'preview') {
    this.start();
  }
  private start() {
    this.worker = new Worker(new URL('./processor.worker.ts', import.meta.url), { type: 'module', name: `optic-image-${this.role}` });
    this.worker.onmessage = (event: MessageEvent<EngineResponse>) => {
      const response = event.data, pending = this.pending.get(response.id);
      if (!pending) { if (response.type === 'preview') response.preview.frames.forEach(frame => frame.close()); return; }
      if (response.type === 'progress') { pending.progress?.(response.progress); return; }
      this.pending.delete(response.id);
      if (response.type === 'error') pending.reject(new Error(response.message)); else pending.resolve(response);
    };
    this.worker.onerror = event => this.fail(new Error(event.message || 'The image worker could not start. Reload to try again.'));
    this.worker.onmessageerror = () => this.fail(new Error('Unable to transfer image data. Reload to try again.'));
  }
  private fail(error: Error) { this.pending.forEach(pending => pending.reject(error)); this.pending.clear(); this.opened = undefined; }
  private request(request: Request, progress?: (value: number) => void, transfer: Transferable[] = []): Promise<EngineResponse> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, progress });
      try { this.worker.postMessage({ ...request, id }, transfer); }
      catch (error) { this.pending.delete(id); reject(error); }
    });
  }
  open(source: ImageInput, progress?: (value: number) => void): Promise<ImageInfo> {
    if (this.opened?.id === source.id) return this.opened.promise;
    if (this.opened && this.pending.size) this.restart();
    const promise = (async () => {
      const bytes = await source.blob.arrayBuffer();
      if (this.opened?.id !== source.id) throw new Error('Processing cancelled');
      const response = await this.request({ type: 'open', sourceId: source.id, bytes, format: source.format, assetBase: new URL('vendor/magick', document.baseURI).href }, progress, [bytes]);
      if (response.type !== 'opened') throw new Error('Unable to open the image.');
      return response.info;
    })().catch(error => { if (this.opened?.id === source.id) this.opened = undefined; throw error; });
    this.opened = { id: source.id, promise };
    return promise;
  }
  async preview(sourceId: string, transforms: Transformations, seed: number, progress?: (value: number) => void): Promise<Preview> {
    const response = await this.request({ type: 'preview', sourceId, transforms, seed }, progress);
    if (response.type !== 'preview') throw new Error('Unable to render the image.');
    return response.preview;
  }
  async export(sourceId: string, transforms: Transformations, seed: number, options: ExportOptions, progress?: (value: number) => void): Promise<ExportResult> {
    const response = await this.request({ type: 'export', sourceId, transforms, seed, options }, progress);
    if (response.type !== 'export') throw new Error('Unable to export the image.');
    return response.result;
  }
  async encode(source: ImageInput, transforms: Transformations, seed: number, options: ExportOptions, progress?: (value: number) => void): Promise<ExportResult> {
    if (isIdentity(transforms) && (options.format === 'auto' || options.format === source.format && ['gif','png'].includes(source.format))) {
      progress?.(100);
      return { blob:source.blob, format:source.format, preserved:true, backend:'original' };
    }
    const epoch = this.epoch, bytes = await source.blob.arrayBuffer();
    if (epoch !== this.epoch) throw new Error('Processing cancelled');
    const response = await this.request({ type:'encode', sourceId:source.id, bytes, format:source.format, assetBase:new URL('vendor/magick', document.baseURI).href, transforms, seed, options }, progress, [bytes]);
    if (response.type !== 'export') throw new Error('Unable to encode the image.');
    return response.result;
  }
  private stop() { this.worker.onmessage = null; this.worker.onerror = null; this.worker.onmessageerror = null; this.worker.terminate(); }
  private restart() { this.epoch++; this.stop(); this.fail(new Error('Processing cancelled')); this.start(); }
  cancelPending() { this.epoch++; if (this.pending.size) this.restart(); }
  close() {
    this.epoch++;
    this.opened = undefined;
    if (this.pending.size) this.restart();
    else void this.request({ type: 'close' }).catch(() => {});
  }
  dispose() { this.epoch++; this.stop(); this.fail(new Error('Processing cancelled')); }
}
