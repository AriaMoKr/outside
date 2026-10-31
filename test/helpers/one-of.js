// How the tests read pages.js's unions (an item of a page, a block read out or in the text view):
// OneOf, any member's field off any of them, and pages.js's Page with its items read so. Types
// only (JSDoc): nothing here runs.

/** @typedef {import('../../public/js/pages.js').Item} Item */

/**
 * One of a union's members, as the tests read it: any member's field off any of them, undefined
 * where it has none (a rule's text, a heading's lines), as pages.js makes them.
 * @template T
 * @template [All=T]
 * @typedef {T extends unknown ? T & { [K in Exclude<All extends unknown ? keyof All : never, keyof T>]?: undefined } : never} OneOf
 */

/** @typedef {Omit<import('../../public/js/pages.js').Page, 'items'> & { items: OneOf<Item>[] }} Page pages.js's, its items read either way (OneOf) */

export {};
