// What tools/ uses of common's tools/ (chrome.mjs, serve.mjs), for tsconfig.node.json's check:
// common has types for its src/ only, so these are read from the tools' source (common v0.7.1), and
// they belong in common, beside the tools, one day. Here, not in types/: they need Node's types,
// which tsconfig.json's check of public/js/ goes without.

declare module 'common/tools/chrome.mjs' {
  /** Resolves after `ms` milliseconds. */
  export const sleep: (ms: number) => Promise<void>;

  /**
   * Starts Chrome (CHROME_PATH, else the first Chrome, Edge or Chromium installed) on a new profile
   * of its own, its Local State written first so Windows sees no failed logon, with its DevTools
   * port open.
   */
  export function launchChrome(o?: {
    /** true (the default): no window; false: a visible window, for measuring performance */
    headless?: boolean;
    /** more command-line switches (--window-size=1280,800, …) */
    args?: string[];
    /** what its first tab opens (about:blank) */
    url?: string;
  }): Promise<Chrome>;

  /** A Chrome launchChrome started, as far as tools/ uses it. */
  export interface Chrome {
    /** Opens a tab at about:blank. */
    newPage(): Promise<Page>;
    /** Ends Chrome and removes its profile. */
    close(): Promise<void>;
  }

  /** One of its tabs (a class there), as far as tools/ uses it. */
  export interface Page {
    /** Loads `url` and waits `settleMs` (1500) for the app to render. */
    goto(url: string, settleMs?: number): Promise<void>;
    /** The value of a JS expression (promises awaited); throws with the page's error message. */
    evaluate(expression: string): Promise<any>;
  }
}

declare module 'common/tools/serve.mjs' {
  /**
   * Serves the folder `root` on host:port (port 0, the default: a free one; host 127.0.0.1);
   * resolves to the listening server.
   */
  export function serve(
    root: string,
    o?: { port?: number; host?: string },
  ): Promise<import('node:http').Server>;

  /**
   * The command: serves as its arguments (process.argv's by default) say over the site's defaults
   * (--root public, --port 8080, --host localhost, --name the package's), and prints where.
   */
  export function start(
    args?: string[],
    defaults?: { root?: string; port?: number; host?: string; name?: string },
  ): Promise<import('node:http').Server>;
}
