// What the page uses that TypeScript's DOM library leaves out, for tsconfig.json's check of
// public/js/ (it is never served): the older WebKit names for fullscreen, and what is put on window.

interface Document {
  readonly webkitFullscreenElement?: Element | null;
  readonly webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?(): Promise<void> | void;
}

interface HTMLElement {
  webkitRequestFullscreen?(): Promise<void> | void;
}

interface Window {
  /** index.html's inline script: a VR session was granted (sessiongranted) before main.js ran. */
  outsideXrGranted?: boolean;
  /** main.js: the garden, for scripted testing and the tools (CLAUDE.md, "Conventions"). */
  __outside?: Record<string, unknown>;
}
