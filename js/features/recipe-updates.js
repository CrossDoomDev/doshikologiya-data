import { checkOnlineRecipes, installOnlineRecipes } from "../core/api.js?v=20261011-link-audit1";
import { applyCatalog, state } from "../core/state.js";
import { renderFeatured } from "./home.js";
import { renderChips, renderRecipes } from "./recipes.js?v=20261011-home-feed1";

export function initRecipeUpdates(catalog) {
  const checkButton = document.getElementById("recipeUpdateCheckBtn");
  const downloadButton = document.getElementById("recipeUpdateDownloadBtn");
  const status = document.getElementById("recipeUpdateStatus");
  if (!checkButton || !downloadButton || !status) return;

  let knownRecipes = catalog.knownRecipes;
  let pending = null;
  let busy = false;

  const setStatus = message => { status.textContent = message; };
  const setBusy = value => {
    busy = value;
    checkButton.disabled = value;
    downloadButton.disabled = value;
  };
  const resetDownload = () => {
    pending = null;
    downloadButton.classList.add("hidden");
    downloadButton.textContent = "↓ Скачать рецепты";
  };

  checkButton.disabled = false;

  checkButton.addEventListener("click", async () => {
    if (busy) return;
    resetDownload();
    setBusy(true);
    checkButton.textContent = "↻ Проверяем…";
    setStatus("Связываемся с архивом только по твоему запросу…");
    try {
      const result = await checkOnlineRecipes(state.config, knownRecipes);
      if (!result.hasUpdates) {
        setStatus("✓ Новых и изменённых рецептов нет. Всё уже на устройстве.");
      } else {
        pending = result;
        const changes = [
          result.added ? `новых: ${result.added}` : "",
          result.updated ? `обновлённых: ${result.updated}` : ""
        ].filter(Boolean).join(", ");
        setStatus(`Найдены изменения (${changes}). Скачать их на устройство?`);
        downloadButton.textContent = `↓ Скачать рецепты (${result.added + result.updated})`;
        downloadButton.classList.remove("hidden");
      }
    } catch (error) {
      console.warn("Ручная проверка архива не удалась:", error);
      setStatus("Не удалось проверить архив. Проверь интернет и попробуй снова.");
    } finally {
      checkButton.textContent = "↻ Проверить обновления";
      setBusy(false);
    }
  });

  downloadButton.addEventListener("click", async () => {
    if (busy || !pending) return;
    setBusy(true);
    setStatus("Докачиваем только новые и изменённые рецепты с изображениями…");
    try {
      const result = await installOnlineRecipes(state.config, catalog.bundledRecipes, knownRecipes, pending);
      knownRecipes = result.knownRecipes;
      applyCatalog({ config: state.config, recipes: result.recipes, patrons: state.patrons });
      renderFeatured();
      renderChips();
      renderRecipes();
      resetDownload();
      setStatus("✓ Архив обновлён. Загруженные рецепты доступны без интернета.");
    } catch (error) {
      console.warn("Не удалось сохранить обновления рецептов:", error);
      setStatus("Загрузка не завершена. Проверь интернет и свободное место, затем попробуй снова.");
    } finally {
      setBusy(false);
    }
  });
}
