/**
 * Next.js instrumentation hook — runs once when the server process boots,
 * before any application/library code is imported.
 *
 * Node.js 25 ships an experimental global `localStorage` that is only partially
 * implemented (e.g. `getItem` is missing) unless started with `--localstorage-file`.
 * Web3 libraries (wagmi connectors, WalletConnect, Coinbase SDK) detect the global
 * and call `localStorage.getItem(...)` during SSR, crashing the render with
 * "localStorage.getItem is not a function".
 *
 * We replace it with a no-op in-memory implementation on the server so SSR never
 * touches the broken native global. The browser keeps using the real localStorage.
 */
export async function register() {
  if (typeof window === "undefined") {
    const store = new Map<string, string>();
    const memoryStorage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    };

    Object.defineProperty(globalThis, "localStorage", {
      value: memoryStorage,
      configurable: true,
      writable: true,
    });
  }
}
