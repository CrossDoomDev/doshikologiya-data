import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { latestRecipes, latestNews } from "../js/core/chronology.js";

const recipes = JSON.parse(fs.readFileSync(new URL("../data/recipes.json", import.meta.url), "utf8"));
const news = JSON.parse(fs.readFileSync(new URL("../data/news.json", import.meta.url), "utf8"));
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const renderer = fs.readFileSync(new URL("../js/features/recipes.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../js/main.js", import.meta.url), "utf8");

test("the live recipe catalog has publication dates and latest five match insertion history", () => {
  assert.equal(recipes.length, 50);
  assert.ok(recipes.every(recipe => typeof recipe.publishedAt === "string"));
  assert.deepEqual(latestRecipes(recipes, 5).map(x => x.id),
    ["apple-dessert", "honey-chili", "coconut-curry", "peanut-sauce", "lemon-butter"]);
});

test("recent recipes use a compact clickable homepage strip and update after catalog refresh", () => {
  assert.match(index, /id="homeRecipes"/);
  assert.match(index, /class="recent-strip"/);
  assert.match(renderer, /latestRecipes\(state\.recipes, homeLimit\)/);
  assert.match(renderer, /data-open-recipe/);
  assert.match(main, /renderRecipes\(\)/);
});

test("news are independent, initially empty and sorted by timestamp when available", () => {
  assert.deepEqual(news, []);
  assert.match(index, /id="homeNewsList"/);
  assert.match(main, /renderNews\(\)/);
  assert.deepEqual(latestNews([
    {id:"a",publishedAt:"2026-10-10T01:00:00Z"},
    {id:"b",publishedAt:"2026-10-11T01:00:00Z"}]).map(x=>x.id),["b","a"]);
});
