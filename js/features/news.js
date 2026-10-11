import { state } from "../core/state.js";
import { escapeHtml } from "../core/utils.js";
import { latestNews, formatPublicationDate } from "../core/chronology.js";

export function renderNews() {
  const box = document.getElementById("homeNewsList");
  if (!box) return;
  const articles = latestNews(state.news, 3);
  if (!articles.length) {
    box.innerHTML = '<p class="home-news-empty">Здесь скоро появятся новости института. Пока мы готовим первую сводку. 🍜</p>';
    return;
  }
  box.innerHTML = articles.map(article => `
    <article class="home-news-item">
      <time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(formatPublicationDate(article.publishedAt))}</time>
      <h3>${escapeHtml(article.title)}</h3>
      <p>${escapeHtml(article.text)}</p>
    </article>
  `).join("");
}
