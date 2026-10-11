import { state } from "../core/state.js";
import { escapeHtml } from "../core/utils.js";
import { newestPatrons, formatPublicationDate } from "../core/chronology.js";

export function renderPatrons() {
  const box = document.getElementById("commentsList");

  if (!state.patrons.length) {
    box.innerHTML = '<div class="empty-state">Стена пока пуста. Первый меценат получает почётное право сказать: «Я был здесь до хайпа».</div>';
    return;
  }

  const icons = ["🍜", "🥚", "🔥", "🥢", "🧄"];
  box.innerHTML = newestPatrons(state.patrons).map((patron, index) => `
    <article class="comment">
      <div class="comment-top">
        <div class="donor">
          <div class="avatar">${icons[index % icons.length]}</div>
          <div>
            <div>${escapeHtml(patron.name)}</div>
            <small style="color:var(--muted)">${escapeHtml(patron.date ? formatPublicationDate(patron.date) : "")}</small>
          </div>
        </div>
        <div class="amount">${escapeHtml(patron.amount || "")}</div>
      </div>
      <p>${escapeHtml(patron.text)}</p>
    </article>
  `).join("");
}
