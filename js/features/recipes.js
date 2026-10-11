import { state, getAllCategories } from "../core/state.js";
import { escapeHtml, getCategories } from "../core/utils.js";
import { isFavorite } from "../core/favorites.js";
import { goTo } from "../core/router.js";
import { latestRecipes, formatPublicationDate } from "../core/chronology.js";

function recipeCard(recipe) {
  const category = getCategories(recipe)[0];
  const favorite = isFavorite(recipe.id);

  return `<article class="recipe-card">
    <div class="recipe-media">
      <img class="recipe-image" src="${escapeHtml(recipe.image || "")}" alt="${escapeHtml(recipe.title)}" loading="lazy">
      <button class="favorite-btn ${favorite ? "on" : ""}" data-favorite="${escapeHtml(recipe.id)}" aria-label="${favorite ? "Убрать из избранного" : "Добавить в избранное"}" aria-pressed="${favorite ? "true" : "false"}">
        <svg class="favorite-heart" viewBox="0 0 24 24" aria-hidden="true"><use href="images/ui/heart.svg#heart"></use></svg>
      </button>
      <span class="card-category">${escapeHtml(category)}</span>
    </div>
    <div class="recipe-body">
      <h3>${escapeHtml(recipe.title)}</h3>
      <p>${escapeHtml(recipe.description)}</p>
      <div class="meta"><span class="tag">⏱ ${escapeHtml(recipe.time)}</span><span class="tag">🔥 ${escapeHtml(recipe.difficulty)}</span></div>
      <p class="recipe-published">📅 ${escapeHtml(formatPublicationDate(recipe.publishedAt))}</p>
      <button class="btn dosh-action-btn card-open" data-open-recipe="${escapeHtml(recipe.id)}"><span class="btn-emoji" aria-hidden="true">📖</span> Открыть протокол</button>
    </div>
  </article>`;
}

function recentRecipeCard(recipe) {
  return `<button class="recent-recipe" type="button" data-open-recipe="${escapeHtml(recipe.id)}" aria-label="Открыть рецепт: ${escapeHtml(recipe.title)}">
    <img class="recent-recipe-image" src="${escapeHtml(recipe.image || "")}" alt="" loading="lazy">
    <span class="recent-recipe-info">
      <strong>${escapeHtml(recipe.title)}</strong>
      <small>📅 ${escapeHtml(formatPublicationDate(recipe.publishedAt))}</small>
    </span>
  </button>`;
}
function filteredRecipes() {
  const query = state.currentSearch.trim().toLowerCase();

  return state.recipes.filter(recipe => {
    const categories = getCategories(recipe);
    const byCategory = state.currentCategory === "Все" || categories.includes(state.currentCategory);
    const haystack = [
      recipe.title,
      recipe.description,
      recipe.story,
      ...categories,
      ...(Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    ].join(" ").toLowerCase();
    const bySearch = !query || haystack.includes(query);
    const byFavorite = !state.showFavoritesOnly || isFavorite(recipe.id);
    return byCategory && bySearch && byFavorite;
  });
}

export function renderRecipes() {
  const homeLimit = Math.min(5, state.config.homeRecipeLimit || 5);
  const home = latestRecipes(state.recipes, homeLimit);
  const homeBox = document.getElementById("homeRecipes");
  const recipesBox = document.getElementById("recipesGrid");

  homeBox.innerHTML = home.length
    ? home.map(recentRecipeCard).join("")
    : '<div class="empty-state">Архив рецептов пока недоступен.</div>';

  const filtered = filteredRecipes();
  recipesBox.innerHTML = filtered.length
    ? filtered.map(recipeCard).join("")
    : '<div class="empty-state">Лаборатория ничего не нашла. Возможно, рецепт засекречен.</div>';
}

export function renderChips() {
  const categories = getAllCategories();
  const markup = categories.map(category =>
    `<button class="chip ${category === state.currentCategory ? "active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  ).join("");

  document.getElementById("homeCategoryChips").innerHTML = markup;
  document.getElementById("recipeCategoryChips").innerHTML = markup;
}

export function selectCategory(category, { fromHome = false } = {}) {
  state.currentCategory = getAllCategories().includes(category) ? category : "Все";
  renderChips();
  renderRecipes();
  if (fromHome) goTo("recipes");
}

export function setSearch(value) {
  state.currentSearch = String(value || "");
  renderRecipes();
}

export function toggleFavoritesOnly() {
  state.showFavoritesOnly = !state.showFavoritesOnly;
  const button = document.getElementById("favoritesToggle");
  button.querySelector(".favorite-filter-label").textContent = state.showFavoritesOnly ? "Показываем избранное" : "Только избранное";
  button.setAttribute("aria-pressed", String(state.showFavoritesOnly));
  renderRecipes();
}
