// A TV remote's Back (public/js/remote.js): one step at a time, and none the app's own Back takes
// through the page's history (the book's entries, common's back-history.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backStep } from '../public/js/remote.js';

const walking = { textView: false, toc: false, book: false, contents: false, trail: false, entry: false, seated: false };

test('Back walks back out the way one came in: text view, book, bench, then the app', () => {
  const steps = [];
  const now = { ...walking, seated: true, book: true, contents: true, textView: true, toc: true };
  for (let s; (s = backStep(now)); ) {
    steps.push(s);
    if (s === 'toc') now.toc = false;
    else if (s === 'text') now.textView = false;
    else if (s === 'contents') now.contents = false;
    else if (s === 'book') now.book = false;
    else if (s === 'stand') now.seated = false;
    assert.ok(steps.length < 10);
  }
  assert.deepEqual(steps, ['toc', 'text', 'contents', 'book', 'stand']);
  assert.equal(backStep(walking), null, 'walking: back a page, the app’s');
});

test('the book with its entry is the app’s Back, so it takes one step, not two', () => {
  const reading = { ...walking, seated: true, book: true, entry: true };
  assert.equal(backStep(reading), null);
  assert.equal(backStep({ ...reading, trail: true }), null, 'a link followed has its entry too');
  // What has no entry is still a step here.
  assert.equal(backStep({ ...reading, contents: true }), 'contents');
  assert.equal(backStep({ ...reading, textView: true }), 'text');
  assert.equal(backStep({ ...reading, textView: true, toc: true }), 'toc');
});

test('a book with no entry (out with a gamepad alone) is put back by the step', () => {
  const reading = { ...walking, seated: true, book: true, entry: false };
  assert.equal(backStep({ ...reading, trail: true }), 'link');
  assert.equal(backStep(reading), 'book');
  assert.equal(backStep({ ...walking, book: true }), 'book', 'read standing: put down, nothing to get up from');
});
