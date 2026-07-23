import "@testing-library/jest-dom";

// jsdom doesn't implement atob in some legacy specs — Node's global is fine; ensure present.
if (typeof globalThis.atob !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).atob = (b64: string) => Buffer.from(b64, "base64").toString("binary");
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
