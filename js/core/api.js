import { DATA_URLS, DEFAULT_CONFIG } from "./config.js";
import { publicationTime } from "./chronology.js";
import { loadCachedRecipes, saveCachedRecipes, mergeRecipes, hydrateRecipeImages, cacheRemoteImages } from "./offline-catalog.js?v=20261011-link-audit1";

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

function normalizeConfig(value) {
  const banner = value?.banner && typeof value.banner === "object"
    ? { ...DEFAULT_CONFIG.banner, ...value.banner }
    : { ...DEFAULT_CONFIG.banner };
  return {
    ...DEFAULT_CONFIG,
    ...(value && typeof value === "object" ? value : {}),
    banner,
    categoryOrder: Array.isArray(value?.categoryOrder) && value.categoryOrder.length
      ? value.categoryOrder : [...DEFAULT_CONFIG.categoryOrder],
    homeRecipeLimit: Number.isInteger(value?.homeRecipeLimit) && value.homeRecipeLimit > 0
      ? value.homeRecipeLimit : DEFAULT_CONFIG.homeRecipeLimit
  };
}

function normalizeRecipes(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter((recipe, index) => {
    const valid = recipe && typeof recipe.id === "string" && recipe.id.trim()
      && typeof recipe.title === "string" && recipe.title.trim()
      && Array.isArray(recipe.ingredients) && recipe.ingredients.length
      && Array.isArray(recipe.steps) && recipe.steps.length;
    if (!valid || seen.has(recipe.id)) {
      console.warn("Пропущен некорректный или повторяющийся рецепт", index);
      return false;
    }
    seen.add(recipe.id);
    return true;
  });
}

function normalizePatrons(value) {
  return Array.isArray(value)
    ? value.filter(item => item && typeof item.name === "string" && typeof item.text === "string")
    : [];
}

function normalizeNews(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter(item => {
    const valid = item && typeof item.id === "string" && item.id.trim()
      && typeof item.title === "string" && item.title.trim()
      && typeof item.text === "string" && item.text.trim()
      && Number.isFinite(publicationTime(item.publishedAt))
      && !seen.has(item.id);
    if (valid) seen.add(item.id);
    return Boolean(valid);
  });
}

export async function loadCatalog() {
  // Android starts entirely offline. No remote check is made without pressing the button.
  const results = await Promise.allSettled([
    fetchJson(DATA_URLS.config), fetchJson(DATA_URLS.recipes),
    fetchJson(DATA_URLS.patrons), fetchJson(DATA_URLS.news), loadCachedRecipes()
  ]);
  const bundledRecipes = normalizeRecipes(results[1].status === "fulfilled" ? results[1].value : []);
  // On GitHub Pages, published JSON and images are the source of truth.
  // IndexedDB is used only by the Android app, so stale downloads cannot hide web assets.
  const nativeApp = globalThis.Capacitor?.isNativePlatform?.() === true;
  const cachedRecipes = nativeApp
    ? normalizeRecipes(results[4].status === "fulfilled" ? results[4].value : [])
    : [];
  const config = normalizeConfig(results[0].status === "fulfilled" ? results[0].value : null);
  const knownRecipes = mergeRecipes(bundledRecipes, cachedRecipes);
  const recipes = await hydrateRecipeImages(knownRecipes, bundledRecipes, config.remoteRecipesUrl);
  if (results[0].status === "rejected") console.warn("Конфигурация не загружена", results[0].reason);
  if (results[1].status === "rejected") console.warn("Встроенный каталог не загружен", results[1].reason);
  if (results[2].status === "rejected") console.warn("Стена меценатов не загружена", results[2].reason);
  if (results[3].status === "rejected") console.warn("Новости института не загружены", results[3].reason);
  return { config, recipes,
    patrons: normalizePatrons(results[2].status === "fulfilled" ? results[2].value : []),
    news: normalizeNews(results[3].status === "fulfilled" ? results[3].value : []),
    bundledRecipes, knownRecipes };
}

// Deterministic non-cryptographic content fingerprint; matched by the catalog validator.
export function recipeFingerprint(recipe) {
  let value = 2166136261;
  for (const character of JSON.stringify(recipe)) {
    // Iterate UTF-16 code units, just as in the index generator.
    const code = character.codePointAt(0);
    if (code > 65535) {
      const x = code - 65536;
      value = Math.imul(value ^ (55296 + (x >> 10)), 16777619);
      value = Math.imul(value ^ (56320 + (x & 1023)), 16777619);
    } else {
      value = Math.imul(value ^ code, 16777619);
    }
  }
  return (value >>> 0).toString(16).padStart(8, "0");
}

export function diffOnlineRecipes(knownRecipes, downloaded) {
  const known = new Map(knownRecipes.map(recipe => [recipe.id, recipe]));
  let added = 0, updated = 0;
  for (const recipe of downloaded) {
    const previous = known.get(recipe.id);
    if (!previous) added++;
    else if (JSON.stringify(previous) !== JSON.stringify(recipe)) updated++;
  }
  return { added, updated, hasUpdates: added + updated > 0 };
}

export function diffOnlineRecipeIndex(knownRecipes, index) {
  if (index?.schemaVersion !== 1 || !Array.isArray(index.recipes) || !index.recipes.length) {
    throw new Error("Повреждён индекс удалённого архива.");
  }
  const known = new Map(knownRecipes.map(recipe => [recipe.id, recipe]));
  const seen = new Set();
  const changes = [];
  let added = 0, updated = 0;
  for (const entry of index.recipes) {
    if (!entry || typeof entry.id !== "string"
      || !/^[a-z0-9-]+$/.test(entry.id) || seen.has(entry.id)
      || entry.path !== `recipe-entries/${entry.id}.json`
      || !/^[a-f0-9]{8}$/.test(entry.hash)) throw new Error("Некорректный индекс рецептов.");
    seen.add(entry.id);
    const previous = known.get(entry.id);
    if (!previous) { added++; changes.push(entry); }
    else if (recipeFingerprint(previous) !== entry.hash) { updated++; changes.push(entry); }
  }
  return { added, updated, hasUpdates: Boolean(changes.length), changes };
}

export async function checkOnlineRecipes(config, knownRecipes) {
  // New APKs fetch only a tiny index; old APKs retain their existing catalog endpoint.
  if (config.remoteRecipeIndexUrl) {
    const index = await fetchJson(config.remoteRecipeIndexUrl);
    const result = diffOnlineRecipeIndex(knownRecipes, index);
    return { ...result, kind: "index" };
  }
  if (!config.remoteRecipesUrl) throw new Error("Адрес архива не настроен.");
  const downloaded = normalizeRecipes(await fetchJson(config.remoteRecipesUrl));
  if (!downloaded.length) throw new Error("Удалённый архив недоступен.");
  return { ...diffOnlineRecipes(knownRecipes, downloaded), kind: "legacy", downloaded };
}

async function downloadRecipeChanges(entries, indexUrl) {
  const base = new URL(indexUrl, typeof location === "undefined" ? "https://localhost/" : location.href);
  const records = new Array(entries.length);
  let position = 0;
  async function worker() {
    while (position < entries.length) {
      const i = position++;
      const entry = entries[i];
      const recipe = await fetchJson(new URL(entry.path, base).href);
      if (normalizeRecipes([recipe]).length !== 1 || recipe.id !== entry.id
        || recipeFingerprint(recipe) !== entry.hash) {
        throw new Error(`Проверка целостности не пройдена: ${entry.id}`);
      }
      records[i] = recipe;
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker));
  return records;
}

export async function installOnlineRecipes(config, bundledRecipes, knownRecipes, pending) {
  if (!pending) throw new Error("Нет выбранных обновлений.");
  const changedRecipes = pending.kind === "index"
    ? await downloadRecipeChanges(pending.changes, config.remoteRecipeIndexUrl)
    : normalizeRecipes(Array.isArray(pending) ? pending : pending.downloaded)
      .filter(recipe => {
        const previous = knownRecipes.find(item => item.id === recipe.id);
        return !previous || JSON.stringify(previous) !== JSON.stringify(recipe);
      });
  if (!changedRecipes.length) throw new Error("Нет новых или изменённых рецептов.");
  // Only images belonging to changed recipes are considered; already saved blobs are skipped.
  await cacheRemoteImages(changedRecipes, config.remoteRecipesUrl);
  const nextKnownRecipes = mergeRecipes(knownRecipes, changedRecipes);
  const saved = await saveCachedRecipes(nextKnownRecipes);
  if (!saved) throw new Error("Не удалось сохранить каталог на устройстве.");
  return {
    recipes: await hydrateRecipeImages(nextKnownRecipes, bundledRecipes, config.remoteRecipesUrl),
    knownRecipes: nextKnownRecipes
  };
}
