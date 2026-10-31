// A minimal document for building DOM in Node (the text view's renderPart): elements with
// attributes, children, text and click listeners, and markup() to read what was built.
// vrlbry's test/helpers/fake-dom.js; the types are this copy's (vrlbry's has none).

/**
 * A click as its listeners get it, and as click() gives it back: its default can be prevented.
 * @typedef {{ defaultPrevented: boolean, preventDefault(): void }} ClickEvent
 */

class Node {
  constructor() {
    /** @type {(Text | Element)[]} */
    this.childNodes = [];
    /** @type {Node | null} */
    this.parentNode = null;
  }

  /** @param {...(Text | Element | string)} nodes */
  append(...nodes) {
    for (const n of nodes) {
      const node = typeof n === 'string' ? new Text(n) : n;
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }

  /** @returns {string} */
  get textContent() {
    return this.childNodes.map((c) => c.textContent).join('');
  }
}

class Text extends Node {
  /** @param {string} data */
  constructor(data) {
    super();
    /** @type {3} */
    this.nodeType = 3;
    this.data = String(data);
  }

  get textContent() {
    return this.data;
  }
}

class Element extends Node {
  /** @param {string} tag */
  constructor(tag) {
    super();
    /** @type {1} */
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    /** @type {Map<string, string>} */
    this.attributes = new Map();
    /** @type {Record<string, ((e: ClickEvent) => void)[] | undefined>} */
    this.listeners = {};
  }

  /**
   * @param {string} name
   * @param {string} value
   */
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  /** @param {string} name */
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  /**
   * @param {string} type
   * @param {(e: ClickEvent) => void} fn
   */
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }

  /** Clicks it: its listeners get an event whose default can be prevented. */
  click() {
    const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    for (const fn of this.listeners.click ?? []) fn(e);
    return e;
  }

  get children() {
    return this.childNodes.filter((c) => c.nodeType === 1);
  }

  /**
   * Every element below it (depth first) that `pred` accepts.
   * @param {(e: Element) => unknown} pred
   */
  findAll(pred) {
    /** @type {Element[]} */
    const out = [];
    /** @param {Element} n */
    const walk = (n) => {
      for (const c of n.children) {
        if (pred(c)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
}

/**
 * A document: createElement and createTextNode.
 * @returns {{ createElement: (tag: string) => Element, createTextNode: (data: string) => Text }}
 */
export function fakeDocument() {
  return {
    createElement: (tag) => new Element(tag),
    createTextNode: (data) => new Text(data),
  };
}

/**
 * What a node holds, as markup (attributes in the order set; text as it is, not escaped).
 * @param {Text | Element} node
 * @returns {string}
 */
export function markup(node) {
  if (node.nodeType === 3) return node.data;
  const attrs = [...node.attributes].map(([k, v]) => ` ${k}="${v}"`).join('');
  const tag = node.tagName.toLowerCase();
  if (['br', 'hr', 'img'].includes(tag) && !node.childNodes.length) return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${node.childNodes.map(markup).join('')}</${tag}>`;
}

/** The markup of an element's children. @param {Element} node */
export function inner(node) {
  return node.childNodes.map(markup).join('');
}
