import test from "node:test";
import assert from "node:assert/strict";
import { publicationTime, latestRecipes, newestPatrons, formatPublicationDate } from "../js/core/chronology.js";

test("wall sorts comments newest-first and does not mutate its input", () => {
  const entries = [{ name: "A", date: "08.10.2026" }, { name: "B", date: "12.10.2026 15:00" },
    { name: "C", date: "11.10.2026" }, { name: "D", date: "неизвестно" }];
  assert.deepEqual(newestPatrons(entries).map(x => x.name), ["B", "C", "A", "D"]);
  assert.equal(entries[0].name, "A");
});

test("invalid dates are rejected", () => {
  assert.equal(Number.isNaN(publicationTime("31.02.2026")), true);
  assert.equal(Number.isNaN(publicationTime("11.10.2026 25:00")), true);
  assert.equal(formatPublicationDate("wrong"), "Дата не указана");
});

test("new recipes sort by publication time; same-time recipes use insertion order", () => {
  const recipes = [{ id: "old", publishedAt: "2026-10-09T02:31:53Z" },
    { id: "a", publishedAt: "2026-10-10T22:06:11Z" },
    { id: "b", publishedAt: "2026-10-10T22:06:11Z" },
    { id: "recent", publishedAt: "2026-10-11T08:00:00Z" },
    { id: "undated" },
    { id: "newest", publishedAt: "2026-10-11T09:30:00Z" }];
  assert.deepEqual(latestRecipes(recipes, 5).map(x => x.id), ["newest", "recent", "b", "a", "old"]);
});
