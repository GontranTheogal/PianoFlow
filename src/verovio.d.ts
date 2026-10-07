declare module "verovio/wasm" {
  const createVerovioModule: () => Promise<unknown>;
  export default createVerovioModule;
}
declare module "verovio/esm" {
  export class VerovioToolkit {
    constructor(vrvModule: unknown);
    setOptions(opts: Record<string, unknown>): void;
    resetOptions(): void;
    loadData(data: string): void;
    loadZipDataBuffer(buf: ArrayBuffer): void;
    renderToSVG(page: number): string;
    renderToTimemap(opts?: Record<string, unknown>): unknown;
    getMIDIValuesForElement(id: string): unknown;
    getMEI(opts?: Record<string, unknown>): string;
  }
}
