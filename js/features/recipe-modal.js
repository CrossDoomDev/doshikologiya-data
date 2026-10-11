import { state } from "../core/state.js";
import { escapeHtml } from "../core/utils.js";
import { isFavorite, toggleFavoriteValue } from "../core/favorites.js";
import { renderRecipes } from "./recipes.js?v=20261011-home-feed1";
import { formatPublicationDate } from "../core/chronology.js";

export function openRecipe(id) {
  const recipe = state.recipes.find(item => item.id === id);
  if (!recipe) return;

  state.currentRecipe = recipe;
  document.getElementById("modalPhoto").src = recipe.image || "";
  document.getElementById("modalPhoto").alt = recipe.title;
  document.getElementById("modalTitle").textContent = recipe.title;
  document.getElementById("modalDescription").textContent = recipe.description;
  document.getElementById("modalMeta").innerHTML =
    `<span class="tag">⏱ ${escapeHtml(recipe.time)}</span><span class="tag">🔥 ${escapeHtml(recipe.difficulty)}</span><span class="tag">💸 ${escapeHtml(recipe.cost)}</span><span class="tag">📅 ${escapeHtml(formatPublicationDate(recipe.publishedAt))}</span>`;
  document.getElementById("modalIngredients").innerHTML =
    recipe.ingredients.map(item => `<li>${escapeHtml(item)}</li>`).join("");
  document.getElementById("modalStory").textContent = recipe.story || "";
  updateModalFavorite();

  const modal = document.getElementById("recipeModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

export function updateModalFavorite() {
  const button = document.getElementById("modalFavoriteBtn");
  if (!state.currentRecipe) return;

  const active = isFavorite(state.currentRecipe.id);
  button.querySelector(".modal-favorite-label").textContent = active ? "В избранном" : "Добавить в избранное";
  button.classList.toggle("is-favorite", active);
  button.setAttribute("aria-pressed", String(active));
}

export function toggleFavorite(id) {
  if (!id) return;
  toggleFavoriteValue(id);
  renderRecipes();
  if (state.currentRecipe?.id === id) updateModalFavorite();
}

export function closeRecipe() {
  const modal = document.getElementById("recipeModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
