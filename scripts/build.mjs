#!/usr/bin/env node
/*
 * Builds the blog the app and the share links read.
 *
 *   npm run blog:build
 *
 * Reads content/posts.json and the pictures in content/images, checks every
 * post and writes dist/:
 *
 *   index.json        { version, updatedAt, pageSize, total, pages, upcoming }
 *   page-1.json ...   published posts, newest first, `pageSize` per page
 *   posts/<id>.json   one published post (used by share links and notifications)
 *   p/<id>.html       the web page a shared link opens
 *   privacy.html      the privacy policy page (when content/privacy.json exists)
 *   images/           copy of the pictures
 *
 * A post whose `date` is in the future is QUEUED: it is left out of every file
 * above (so nobody can read it early) and only listed in `upcoming` with its
 * time and optional `notify` text, which lets the app schedule a notification.
 * Publishing is simply running this build again after that time; the GitHub
 * workflow in .github/workflows/publish.yml does it every 10 minutes.
 *
 * The site address comes from --site-url, the BLOG_SITE_URL variable or
 * content/config.json, in that order.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const blogDir = join(root, "content");
const distDir = join(root, "dist");
const imagesDir = join(blogDir, "images");

const PAGE_SIZE = 10;
const UPCOMING_DAYS = 30;
const LANGUAGES = ["en", "ar", "ms", "es", "fr"];
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const config = JSON.parse(readFileSync(join(blogDir, "config.json"), "utf8"));
const siteUrl = (argValue("site-url") ?? process.env.BLOG_SITE_URL ?? config.siteUrl).replace(/\/+$/, "");
const app = { name: config.appName, scheme: config.scheme, android: { package: config.androidPackage } };

const errors = [];
const warnings = [];

/* ------------------------------------------------------------------ */
/* Checks                                                               */
/* ------------------------------------------------------------------ */

function checkLocalized(value, label, id) {
  if (value === undefined || typeof value === "string") return;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of Object.keys(value)) {
      if (!LANGUAGES.includes(key)) warnings.push(`${id}: ${label} has unknown language "${key}"`);
      if (typeof value[key] !== "string") errors.push(`${id}: ${label}.${key} must be text`);
    }
    if (!value.en) warnings.push(`${id}: ${label} has no "en" text (the app falls back to it)`);
    return;
  }
  errors.push(`${id}: ${label} must be text or { en, ar, ms, es, fr }`);
}

const source = JSON.parse(readFileSync(join(blogDir, "posts.json"), "utf8"));
const posts = Array.isArray(source.posts) ? source.posts : [];
const seen = new Set();

for (const post of posts) {
  const id = post.id ?? "(missing id)";
  if (!post.id || typeof post.id !== "string" || !ID_PATTERN.test(post.id)) {
    errors.push(`${id}: "id" must be letters, numbers, - or _ only (it is used in the link)`);
  }
  if (seen.has(post.id)) errors.push(`${id}: duplicate id`);
  seen.add(post.id);
  if (!post.date || Number.isNaN(Date.parse(post.date))) errors.push(`${id}: "date" must be a date like 2026-10-02T08:00:00Z`);
  checkLocalized(post.title, "title", id);
  checkLocalized(post.text, "text", id);
  checkLocalized(post.imageAlt, "imageAlt", id);
  checkLocalized(post.notify?.title, "notify.title", id);
  checkLocalized(post.notify?.body, "notify.body", id);
  if (!post.text && !post.image && !post.title) errors.push(`${id}: a post needs text, a title or an image`);
  if (post.image && !/^https?:\/\//i.test(post.image) && !existsSync(join(blogDir, post.image))) {
    errors.push(`${id}: image file not found: content/${post.image}`);
  }
}

if (errors.length) {
  console.error("Blog not built. Fix these first:\n - " + errors.join("\n - "));
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Published and queued                                                 */
/* ------------------------------------------------------------------ */

const now = Date.now();
const published = posts.filter((post) => Date.parse(post.date) <= now).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
const queued = posts.filter((post) => Date.parse(post.date) > now).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

/* ------------------------------------------------------------------ */
/* Share page                                                           */
/* ------------------------------------------------------------------ */

const LABELS = {
  open: { en: "Open in the app", ar: "افتح في التطبيق", ms: "Buka dalam aplikasi", es: "Abrir en la aplicación", fr: "Ouvrir dans l’application" },
  get: { en: "Get the app", ar: "حمّل التطبيق", ms: "Dapatkan aplikasi", es: "Descargar la aplicación", fr: "Obtenir l’application" },
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const asMap = (value) => (typeof value === "string" ? { en: value } : value ?? {});
const absolute = (path) => (/^https?:\/\//i.test(path) ? path : `${siteUrl}/${path.replace(/^\/+/, "")}`);

function renderPage(post) {
  const titles = asMap(post.title);
  const texts = asMap(post.text);
  const alts = asMap(post.imageAlt);
  const languages = LANGUAGES.filter((language) => titles[language] || texts[language]);
  const available = languages.length ? languages : ["en"];
  const first = available.includes("en") ? "en" : available[0];
  const title = titles.en ?? Object.values(titles)[0] ?? app.name;
  const description = (texts.en ?? Object.values(texts)[0] ?? "").replace(/\s+/g, " ").slice(0, 200);
  const image = post.image ? absolute(post.image) : "";
  const deepLink = `${app.scheme}://blog/post?id=${encodeURIComponent(post.id)}`;
  const store = `https://play.google.com/store/apps/details?id=${app.android.package}`;
  const date = new Date(post.date).toISOString().slice(0, 10);

  const articles = available
    .map((language) => {
      const body = (texts[language] ?? "")
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
        .join("\n");

      return `<article data-lang="${language}" lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}"${language === first ? "" : " hidden"}>
${titles[language] ? `<h1>${escapeHtml(titles[language])}</h1>` : ""}
${body}
<div class="buttons"><a class="primary" href="${escapeHtml(deepLink)}">${LABELS.open[language]}</a><a href="${escapeHtml(store)}">${LABELS.get[language]}</a></div>
</article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="${first}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ${escapeHtml(app.name)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${escapeHtml(app.name)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">\n<meta name="twitter:card" content="summary_large_image">` : ""}
<style>
:root{color-scheme:light dark;--bg:#f3f7f6;--card:#fff;--text:#0a2a26;--muted:#5a7570;--accent:#2e8a7c;--border:#d6e5e2}
@media (prefers-color-scheme:dark){:root{--bg:#0c1a1a;--card:#142625;--text:#e8f2f0;--muted:#9bb5b0;--accent:#7cc4b8;--border:#244542}}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.7 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:640px;margin:0 auto;padding:24px 16px 48px}
.brand{font-weight:800;color:var(--accent);margin-bottom:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:24px;padding:24px;overflow:hidden}
time{color:var(--muted);font-size:14px}
h1{font-size:26px;line-height:1.3;margin:8px 0 12px}
p{margin:0 0 14px}
img{display:block;width:100%;height:auto;border-radius:16px;margin:16px 0}
.buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
a{display:inline-block;padding:12px 18px;border-radius:14px;border:1px solid var(--border);color:var(--text);text-decoration:none;font-weight:700;font-size:15px}
a.primary{background:var(--accent);border-color:var(--accent);color:#fff}
</style>
</head>
<body>
<main>
<div class="brand">${escapeHtml(app.name)}</div>
<div class="card">
<time datetime="${date}">${date}</time>
${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(alts.en ?? title)}">` : ""}
${articles}
</div>
</main>
<script>
(function(){var langs=${JSON.stringify(available)};var prefs=(navigator.languages||[navigator.language||"en"]).map(function(l){return String(l).slice(0,2)});
var pick=prefs.filter(function(l){return langs.indexOf(l)>=0})[0]||${JSON.stringify(first)};
document.querySelectorAll("[data-lang]").forEach(function(el){el.hidden=el.getAttribute("data-lang")!==pick});
document.documentElement.lang=pick;})();
</script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* Privacy policy page (content/privacy.json, made by the app project)   */
/* ------------------------------------------------------------------ */

const LANGUAGE_NAMES = { en: "English", ar: "العربية", ms: "Bahasa Melayu", es: "Español", fr: "Français" };

function renderPrivacy(privacy) {
  const codes = LANGUAGES.filter((code) => privacy.languages[code]);
  const mail = escapeHtml(privacy.supportEmail);

  const articles = codes
    .map((code) => {
      const text = privacy.languages[code];
      const highlights = text.highlights
        .map((item) => `<div class="tile"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></div>`)
        .join("");
      const sections = text.sections
        .map(
          (section) => `<section id="${code}-${section.id}">
<h2>${escapeHtml(section.title)}</h2>
<p>${escapeHtml(section.description)}</p>
<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
</section>`
        )
        .join("\n");

      return `<article data-lang="${code}" lang="${code}" dir="${code === "ar" ? "rtl" : "ltr"}"${code === "en" ? "" : " hidden"}>
<h1>${escapeHtml(text.title)}</h1>
<p class="muted">${escapeHtml(text.updatedLabel)}</p>
<p>${escapeHtml(text.intro)}</p>
<div class="tiles">${highlights}</div>
${sections}
<section><h2>${escapeHtml(text.contactTitle)}</h2><p>${escapeHtml(text.contactDescription)}</p><p><a class="primary" href="mailto:${mail}">${mail}</a></p></section>
</article>`;
    })
    .join("\n");

  const switcher = codes.map((code) => `<button type="button" data-pick="${code}">${LANGUAGE_NAMES[code]}</button>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy · ${escapeHtml(privacy.appName)}</title>
<meta name="description" content="Privacy policy of ${escapeHtml(privacy.appName)}.">
<style>
:root{color-scheme:light dark;--bg:#f3f7f6;--card:#fff;--text:#0a2a26;--muted:#5a7570;--accent:#2e8a7c;--border:#d6e5e2}
@media (prefers-color-scheme:dark){:root{--bg:#0c1a1a;--card:#142625;--text:#e8f2f0;--muted:#9bb5b0;--accent:#7cc4b8;--border:#244542}}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.7 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 56px}
.brand{font-weight:800;color:var(--accent);margin-bottom:12px}
.switch{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
button{font:inherit;font-size:14px;font-weight:700;padding:8px 14px;border-radius:12px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer}
button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
.card{background:var(--card);border:1px solid var(--border);border-radius:24px;padding:24px}
h1{font-size:28px;line-height:1.25;margin:0 0 4px}
h2{font-size:19px;margin:28px 0 6px}
p{margin:0 0 12px}.muted{color:var(--muted);font-size:14px}
ul{margin:0 0 12px;padding-inline-start:22px}li{margin-bottom:8px}
.tiles{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:18px 0}
.tile{border:1px solid var(--border);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:4px}
.tile span{color:var(--muted);font-size:14px}
a.primary{display:inline-block;padding:10px 16px;border-radius:12px;background:var(--accent);color:#fff;text-decoration:none;font-weight:700}
</style>
</head>
<body>
<main>
<div class="brand">${escapeHtml(privacy.appName)}</div>
<div class="switch">${switcher}</div>
<div class="card">
${articles}
</div>
</main>
<script>
(function(){var langs=${JSON.stringify(codes)};
function show(code){document.querySelectorAll("[data-lang]").forEach(function(el){el.hidden=el.getAttribute("data-lang")!==code});
document.querySelectorAll("[data-pick]").forEach(function(b){b.setAttribute("aria-pressed",String(b.getAttribute("data-pick")===code))});
document.documentElement.lang=code;document.documentElement.dir=code==="ar"?"rtl":"ltr"}
document.querySelectorAll("[data-pick]").forEach(function(b){b.addEventListener("click",function(){show(b.getAttribute("data-pick"))})});
var prefs=(navigator.languages||[navigator.language||"en"]).map(function(l){return String(l).slice(0,2)});
show(prefs.filter(function(l){return langs.indexOf(l)>=0})[0]||"en");})();
</script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* Write                                                                */
/* ------------------------------------------------------------------ */

rmSync(distDir, { recursive: true, force: true });
mkdirSync(join(distDir, "images"), { recursive: true });
mkdirSync(join(distDir, "posts"), { recursive: true });
mkdirSync(join(distDir, "p"), { recursive: true });

const pageCount = Math.max(1, Math.ceil(published.length / PAGE_SIZE));

for (let page = 1; page <= pageCount; page += 1) {
  writeFileSync(join(distDir, `page-${page}.json`), JSON.stringify(published.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)));
}

for (const post of published) {
  writeFileSync(join(distDir, "posts", `${post.id}.json`), JSON.stringify(post));
  writeFileSync(join(distDir, "p", `${post.id}.html`), renderPage(post));
}

const privacyFile = join(blogDir, "privacy.json");
if (existsSync(privacyFile)) {
  const page = renderPrivacy(JSON.parse(readFileSync(privacyFile, "utf8")));
  mkdirSync(join(distDir, "privacy"), { recursive: true });
  writeFileSync(join(distDir, "privacy.html"), page);
  writeFileSync(join(distDir, "privacy", "index.html"), page);
}

const horizon = now + UPCOMING_DAYS * 86_400_000;
const upcoming = queued
  .filter((post) => Date.parse(post.date) <= horizon)
  .map((post) => ({ id: post.id, at: new Date(post.date).toISOString(), ...(post.notify?.title ? { title: post.notify.title } : {}), ...(post.notify?.body ? { body: post.notify.body } : {}) }));

writeFileSync(
  join(distDir, "index.json"),
  JSON.stringify({ version: 2, updatedAt: new Date(now).toISOString(), pageSize: PAGE_SIZE, total: published.length, pages: pageCount, upcoming })
);

if (existsSync(imagesDir)) {
  for (const file of readdirSync(imagesDir)) copyFileSync(join(imagesDir, file), join(distDir, "images", file));
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
console.log(`Blog built: ${published.length} published in ${pageCount} page(s), ${queued.length} queued -> dist`);
if (queued.length) console.log(`Next to publish: ${queued[0].id} at ${new Date(queued[0].date).toISOString()}`);
