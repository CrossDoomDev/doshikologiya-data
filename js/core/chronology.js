const LEGACY_DATE = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/;
const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

// For comments, DD.MM.YYYY HH:mm is accepted for easy editing on a phone.
// For recipes, use an ISO timestamp with a timezone so publication is unambiguous.
export function publicationTime(value) {
  if (typeof value !== "string") return NaN;
  const raw = value.trim();
  const legacy = LEGACY_DATE.exec(raw);
  if (legacy) {
    const [, dd, mm, yyyy, hh = "0", min = "0"] = legacy;
    const day = Number(dd), month = Number(mm), year = Number(yyyy);
    const hour = Number(hh), minute = Number(min);
    if (year < 2000 || hour > 23 || minute > 59) return NaN;
    const stamp = Date.UTC(year, month - 1, day, hour, minute);
    const check = new Date(stamp);
    return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 &&
      check.getUTCDate() === day ? stamp : NaN;
  }
  if (!ISO_WITH_TZ.test(raw)) return NaN;
  const stamp = Date.parse(raw);
  return Number.isFinite(stamp) ? stamp : NaN;
}

function sortNewest(items, property, newestOnTie) {
  return items.map((item, index) => ({ item, index, stamp: publicationTime(item?.[property]) }))
    .sort((a, b) => {
      const at = Number.isFinite(a.stamp) ? a.stamp : -Infinity;
      const bt = Number.isFinite(b.stamp) ? b.stamp : -Infinity;
      return bt - at || (newestOnTie ? b.index - a.index : a.index - b.index);
    }).map(entry => entry.item);
}

export function latestRecipes(recipes, limit = 5) {
  return sortNewest(Array.isArray(recipes) ? recipes : [], "publishedAt", true).slice(0, limit);
}

export function latestNews(news, limit = 3) {
  return sortNewest(Array.isArray(news) ? news : [], "publishedAt", true).slice(0, limit);
}

export function newestPatrons(patrons) {
  return sortNewest(Array.isArray(patrons) ? patrons : [], "date", false);
}

export function formatPublicationDate(value) {
  if (!Number.isFinite(publicationTime(value))) return "Дата не указана";
  if (LEGACY_DATE.test(value.trim())) return value.trim();
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).format(new Date(publicationTime(value)));
}
