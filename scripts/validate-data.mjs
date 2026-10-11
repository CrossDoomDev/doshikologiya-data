import fs from "node:fs";
import path from "node:path";
import { publicationTime } from "../js/core/chronology.js";

const root = process.cwd();
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

const config = readJson("data/config.json");
const recipes = readJson("data/recipes.json");
const patrons = readJson("data/patrons.json");
const news = readJson("data/news.json");

const errors = [];
const ids = new Set();

if (!Array.isArray(recipes)) errors.push("data/recipes.json должен содержать массив.");
if (!Array.isArray(patrons)) errors.push("data/patrons.json должен содержать массив.");
if (!Array.isArray(news)) errors.push("data/news.json должен содержать массив.");

for (const [index, recipe] of (Array.isArray(recipes) ? recipes : []).entries()) {
  const label = `Рецепт #${index + 1}`;
  for (const field of ["id", "title", "description", "time", "difficulty", "cost", "story", "image"]) {
    if (typeof recipe[field] !== "string" || !recipe[field].trim()) errors.push(`${label}: отсутствует строковое поле "${field}".`);
  }
  if (!Array.isArray(recipe.ingredients) || !recipe.ingredients.length) errors.push(`${label}: ingredients должен быть непустым массивом.`);
  if (!Array.isArray(recipe.steps) || !recipe.steps.length) errors.push(`${label}: steps должен быть непустым массивом.`);
  if (!Array.isArray(recipe.categories) || !recipe.categories.length) errors.push(`${label}: categories должен быть непустым массивом.`);
  if (typeof recipe.publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(recipe.publishedAt) || !Number.isFinite(publicationTime(recipe.publishedAt))) errors.push(`${label}: publishedAt должен содержать ISO дату и время с часовым поясом.`);

  if (recipe.id) {
    if (ids.has(recipe.id)) errors.push(`Повторяющийся id: ${recipe.id}`);
    ids.add(recipe.id);
  }

  if (typeof recipe.image === "string" && recipe.image && !/^https?:\/\//.test(recipe.image)) {
    const imagePath = recipe.image.split("?")[0];
    const imageFile = path.join(root, imagePath);
    if (!fs.existsSync(imageFile)) errors.push(`${label}: не найдено изображение ${imagePath}`);
    else if (imagePath.endsWith(".webp")) {
      const header = Buffer.alloc(12);
      const handle = fs.openSync(imageFile, "r");
      try { fs.readSync(handle, header, 0, 12, 0); } finally { fs.closeSync(handle); }
      if (header.toString("ascii", 0, 4) !== "RIFF"
        || header.toString("ascii", 8, 12) !== "WEBP") {
        errors.push(`${label}: изображение имеет неверный формат WebP: ${imagePath}`);
      }
    }
  }
}

for (const [index, patron] of (Array.isArray(patrons) ? patrons : []).entries()) {
  if (!patron || typeof patron.name !== "string" || typeof patron.text !== "string"
    || !Number.isFinite(publicationTime(patron.date))) {
    errors.push(`Комментарий #${index + 1}: имя, текст и правильная дата обязательны.`);
  }
}

const newsIds = new Set();
for (const [index, article] of (Array.isArray(news) ? news : []).entries()) {
  if (!article || typeof article.id !== "string" || !/^[a-z0-9-]+$/.test(article.id)
    || newsIds.has(article.id) || typeof article.title !== "string" || !article.title.trim()
    || typeof article.text !== "string" || !article.text.trim()
    || !Number.isFinite(publicationTime(article.publishedAt))) {
    errors.push(`Новость #${index + 1}: недопустимые id, заголовок, текст или дата.`);
  } else newsIds.add(article.id);
}
if (config.featuredRecipeId && !ids.has(config.featuredRecipeId)) {
  errors.push(`featuredRecipeId "${config.featuredRecipeId}" не найден среди рецептов.`);
}
if (!Array.isArray(config.categoryOrder) || !config.categoryOrder.includes("Все")) {
  errors.push('config.categoryOrder должен быть массивом и содержать "Все".');
}
if (config.donateUrl && !/^https:\/\//.test(config.donateUrl)) {
  errors.push("donateUrl должен быть HTTPS-ссылкой.");
}


/* Защита оригинального названия во всех пользовательских текстах. */
const forbiddenBrandPatterns = [
  new RegExp("доши" + "рак", "iu"),
  new RegExp("doshi" + "rak", "iu")
];
const inspectedExtensions = new Set([
  ".html", ".css", ".js", ".mjs", ".json", ".md", ".svg", ".webmanifest", ".txt", ".yml", ".yaml"
]);
const ignoredDirectories = new Set([".git", "node_modules", ".cache"]);

function inspectPublicTexts(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const entryPath = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) inspectPublicTexts(entryPath);
      continue;
    }
    if (!entry.isFile() || !inspectedExtensions.has(path.extname(entry.name).toLowerCase())) continue;

    const content = fs.readFileSync(entryPath, "utf8");
    if (forbiddenBrandPatterns.some(pattern => pattern.test(content))) {
      const relativePath = path.relative(root, entryPath).split(path.sep).join("/");
      errors.push(`${relativePath}: обнаружено чужое торговое название. Используй «Дошик».`);
    }
  }
}

inspectPublicTexts(root);


const index = readJson("data/recipes-index.json");
function fingerprint(recipe) {
  let h = 2166136261;
  for (let i = 0, str = JSON.stringify(recipe); i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
if (recipes.length < 50) errors.push("Каталог должен содержать не менее 50 рецептов.");
if (index.schemaVersion !== 1 || !Array.isArray(index.recipes) || index.recipes.length !== recipes.length) {
  errors.push("Индекс рецептов отсутствует или содержит неверное количество.");
} else {
  const byId = new Map(recipes.map(recipe => [recipe.id, recipe]));
  const manifestIds = new Set();
  for (const entry of index.recipes) {
    const recipe = byId.get(entry.id);
    if (manifestIds.has(entry.id)) errors.push("Повтор в индексе: " + entry.id);
    manifestIds.add(entry.id);
    if (!recipe || entry.path !== `recipe-entries/${entry.id}.json` || entry.hash !== fingerprint(recipe)) {
      errors.push("Неверный индекс рецепта: " + entry.id); continue;
    }
    const resource = path.join(root, "data", entry.path);
    if (!fs.existsSync(resource) || JSON.stringify(readJson(path.join("data", entry.path))) !== JSON.stringify(recipe)) {
      errors.push("Не совпадает отдельный файл рецепта: " + entry.id);
    }
  }
}

// Следим за чистотой каталога: только используемые изображения и уникальные тексты.
const activeRecipeImages = new Set(recipes.map(recipe => recipe.image?.split("?")[0]).filter(Boolean));
for (const filename of fs.readdirSync(path.join(root, "images/recipes"))) {
  if (!/\.(?:webp|png|jpe?g|svg)$/i.test(filename)) continue;
  const relative = `images/recipes/${filename}`;
  if (!activeRecipeImages.has(relative)) errors.push(`Неиспользуемое изображение: ${relative}`);
}

const seenRecipeTexts = new Map();
for (const recipe of recipes) {
  const fields = [
    ["description", recipe.description],
    ["story", recipe.story],
    ...(recipe.steps || []).map(step => ["steps", step])
  ];
  for (const [kind, value] of fields) {
    if (typeof value !== "string") continue;
    const normalized = value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru");
    const key = kind + ":" + normalized;
    if (seenRecipeTexts.has(key)) {
      errors.push(`Повторяющийся текст (${kind}) у рецептов ${seenRecipeTexts.get(key)} и ${recipe.id}`);
    } else seenRecipeTexts.set(key, recipe.id);
  }
}


// Verify local links before deployment, including HTML, manifest, CSS and JS modules.
// External services are excluded: their HTTP status depends on the user's network.
const checkedStaticLinks = new Set();
function checkStaticLink(sourceFile, rawLink, { moduleImport = false } = {}) {
  const url = String(rawLink || "").trim();
  if (!url || /^(?:#|https?:|mailto:|tel:|data:|blob:|javascript:|\/\/)/i.test(url)
    || url.includes("$" + "{") || url.includes("{{")) return;
  const bare = url.split(/[?#]/, 1)[0];
  if (!bare || bare.startsWith("/")) return;
  const key = sourceFile + "|" + bare + "|" + String(moduleImport);
  if (checkedStaticLinks.has(key)) return;
  checkedStaticLinks.add(key);
  const appRootAsset = !moduleImport && /^(?:images|data|js|css)\//.test(bare);
  const parent = appRootAsset ? root : path.dirname(path.join(root, sourceFile));
  const resolved = path.resolve(parent, bare);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    errors.push("Ссылка выходит за пределы проекта: " + sourceFile + " -> " + url);
  } else if (!fs.existsSync(resolved) ||
    !(bare.endsWith("/") || bare === "." || bare === "./"
      ? fs.statSync(resolved).isDirectory() : fs.statSync(resolved).isFile())) {
    errors.push("Отсутствующий локальный ресурс: " + sourceFile + " -> " + url);
  }
}

function inspectStaticLinks(sourceFile) {
  const content = fs.readFileSync(path.join(root, sourceFile), "utf8");
  for (const match of content.matchAll(/\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi)) {
    checkStaticLink(sourceFile, match[1]);
  }
  if (/\.(?:css|html)$/.test(sourceFile)) {
  for (const match of content.matchAll(/url\(\s*["']?([^)"']+)["']?\s*\)/gi)) {
    checkStaticLink(sourceFile, match[1]);
  }
  }
  if (/\.m?js$/.test(sourceFile)) {
    for (const match of content.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
      checkStaticLink(sourceFile, match[1], { moduleImport: true });
    }
    for (const match of content.matchAll(/["'](images\/[a-z0-9_./-]+\.(?:svg|webp|png|jpe?g)(?:[?#][^"'\s]*)?)["']/gi)) {
      checkStaticLink(sourceFile, match[1]);
    }
  }
  if (sourceFile.endsWith(".webmanifest")) {
    const manifest = JSON.parse(content);
    for (const icon of manifest.icons || []) checkStaticLink(sourceFile, icon.src);
    checkStaticLink(sourceFile, manifest.start_url);
  }
}

inspectStaticLinks("index.html");
inspectStaticLinks("manifest.webmanifest");
inspectStaticLinks("css/styles.css");
for (const directory of ["js/core", "js/features"]) {
  for (const file of fs.readdirSync(path.join(root, directory))) {
    if (file.endsWith(".js")) inspectStaticLinks(directory + "/" + file);
  }
}
inspectStaticLinks("js/main.js");

for (const key of ["remoteRecipesUrl", "remoteRecipeIndexUrl"]) {
  if (!config[key]) continue;
  let target;
  try { target = new URL(config[key]); } catch {
    errors.push("Неверный URL в настройках: " + key);
    continue;
  }
  if (target.hostname === "crossdoomdev.github.io") {
    const prefix = "/doshikologiya/";
    if (!target.pathname.startsWith(prefix)) {
      errors.push("Ссылка " + key + " не указывает на проект Дошикологии.");
      continue;
    }
    checkStaticLink("data/config.json", target.pathname.slice(prefix.length));
  }
}

if (errors.length) {
  console.error("Проверка данных не пройдена:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(`Данные корректны: ${recipes.length} рецептов, ${patrons.length} записей на стене, schemaVersion ${config.schemaVersion}.`);
