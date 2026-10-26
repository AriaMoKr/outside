// The garden on a TV's remote: what its Back does here. Pure, tested in Node. common's tv.js has the
// rest (the Remote: walking, the card, OK, Menu, and answering the app), main.js puts them together.

/**
 * What Back does now, as one step (common's tv.js Remote `step`), in the order Esc and Backspace
 * take them: the text view's contents closed ('toc'), the text view closed ('text'), the book's
 * contents closed ('contents'), back along a link followed in it ('link'), the book put down
 * ('book'), up from the bench ('stand'); or null, the app's own Back (back a page, through the
 * page's history). The book's entries in that history (common's back-history.js: one for the book,
 * one per link) are the app's to go back through when it will come to them (`entry`: the book came
 * out once the page had a key press or a click, as Chromium keeps only those), else a step here, so
 * Back takes one step, not two (common's README, "Back and the page's history").
 * @param {{ textView: boolean, toc: boolean, book: boolean, contents: boolean, trail: boolean, entry: boolean, seated: boolean }} now
 * @returns {'toc' | 'text' | 'contents' | 'link' | 'book' | 'stand' | null}
 */
export function backStep({ textView, toc, book, contents, trail, entry, seated }) {
  if (textView) return toc ? 'toc' : 'text';
  if (book) {
    if (contents) return 'contents';
    if (entry) return null;
    return trail ? 'link' : 'book';
  }
  return seated ? 'stand' : null;
}
