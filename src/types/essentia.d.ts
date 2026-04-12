// Type declarations for essentia.js sub-path imports (no @types/essentia.js exists).
declare module "essentia.js/dist/essentia-wasm.web.js" {
  /** EssentiaWASM factory — accepts Emscripten module options (e.g. locateFile). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const EssentiaWASM: (opts?: Record<string, unknown>) => Promise<any>;
  export default EssentiaWASM;
}

declare module "essentia.js/dist/essentia.js-core.es.js" {
  /** Essentia JS wrapper around the WASM module. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class Essentia {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(wasmModule: any, debug?: boolean);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
}
