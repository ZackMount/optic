import { Cancelled, ImageEngine } from './engine';
import type { EngineRequest, EngineResponse } from './types';

const engine = new ImageEngine();
let latest = 0;
let queue: Promise<void> = Promise.resolve();
const send = (response: EngineResponse, transfer: Transferable[] = []) => self.postMessage(response, { transfer });
self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const request = event.data;
  if (request.type !== 'stats') latest = request.id;
  queue = queue.then(async () => {
    const cancelled = () => latest !== request.id;
    const progress = (value: number) => { if (!cancelled()) send({ id: request.id, type: 'progress', progress: value }); };
    try {
      if (request.type === 'stats') { send({ id: request.id, type: 'stats', stats: { ...engine.stats } }); return; }
      if (cancelled()) throw new Cancelled();
      if (request.type === 'open') {
        progress(5);
        const info = await engine.open(request.sourceId, new Uint8Array(request.bytes), request.format, request.assetBase);
        if (cancelled()) throw new Cancelled();
        send({ id: request.id, type: 'opened', info });
      } else if (request.type === 'close') { engine.close(); send({ id: request.id, type: 'closed' }); }
      else if (request.type === 'encode') {
        const result = await engine.encode(request.sourceId, new Uint8Array(request.bytes), request.format, request.assetBase, request.transforms, request.seed, request.options, cancelled, progress);
        send({ id:request.id, type:'export', result });
      }
      else if (request.type === 'preview') {
        const preview = await engine.preview(request.sourceId, request.transforms, request.seed, cancelled, progress, request.forceCpu);
        send({ id: request.id, type: 'preview', preview }, preview.frames);
      } else {
        const result = await engine.export(request.sourceId, request.transforms, request.seed, request.options, cancelled, progress);
        send({ id: request.id, type: 'export', result });
      }
    } catch (error) { send({ id: request.id, type: 'error', message: error instanceof Error ? error.message : 'Image processing failed.' }); }
  });
};
