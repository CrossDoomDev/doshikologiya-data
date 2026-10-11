import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");

test("recipe keeps only the bottom donation action", () => {
  assert.doesNotMatch(html, /id="modalDonateBtn"/);
  assert.doesNotMatch(html, /donate-spotlight-btn/);
  assert.doesNotMatch(css, /donate-spotlight-btn/);
  assert.match(html, /id="modalDonateBottomBtn" data-donate/);
});

test("wall tab is labeled Стена on mobile and desktop", () => {
  assert.match(html, /data-route="wall" aria-label="Стена" title="Стена"/);
  assert.match(html, /class="nav-btn" data-route="wall">Стена<\/button>/);
  assert.match(html, /class="tab-label" aria-hidden="true">Стена<\/span>/);
  assert.match(html, /id="view-wall"/);
});
