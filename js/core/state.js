import { DEFAULT_CONFIG, STORAGE_KEYS } from "./config.js";

function loadFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || "[]");
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

export const state = {
  config: structuredClone(DEFAULT_CONFIG),
  recipes: [],
  patrons: [],
  news: [],
  currentCategory: "Все",
  currentSearch: "",
  showFavoritesOnly: false,
  currentRecipe: null,
  cookStepIndex: 0,
  favorites: loadFavorites()
};

export function applyCatalog({ config, recipes, patrons, news = state.news }) {
  state.config = config;
  state.recipes = recipes;
  state.patrons = patrons;
  state.news = Array.isArray(news) ? news : [];

  if (!getAllCategories().includes(state.currentCategory)) {
    state.currentCategory = "Все";
  }
}

export function getAllCategories() {
  const preferred = Array.isArray(state.config.categoryOrder) ? state.config.categoryOrder : ["Все"];
  const discovered = state.recipes.flatMap(recipe => Array.isArray(recipe.categories) ? recipe.categories : []);
  return ["Все", ...new Set([...preferred.filter(item => item !== "Все"), ...discovered])];
}
