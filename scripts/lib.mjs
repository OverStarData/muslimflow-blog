/* Shared helpers for the blog scripts. */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const contentDir = join(root, "content");
const postsFile = join(contentDir, "posts.json");

export const LANGUAGES = ["en", "ar", "ms", "es", "fr"];

export function readPosts() {
  return JSON.parse(readFileSync(postsFile, "utf8"));
}

export function readSamples() {
  return JSON.parse(readFileSync(join(contentDir, "samples.json"), "utf8")).posts;
}

/* "2026-10-05 09:00" is read as local time; anything with a "T" is read as written. */
export function parseWhen(value) {
  if (!value) return new Date();
  const when = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(when.getTime())) {
    throw new Error(`Could not read the time "${value}". Use for example "2026-10-05 09:00".`);
  }
  return when;
}

/*
 * Builds a post and adds it to content/posts.json (newest first).
 * title/text: English text or { en, ar, ms, es, fr }. image: path of a picture file.
 */
export function addPost({ title, text, image, when = new Date(), notify, sample }) {
  const asLocalized = (value) => (typeof value === "string" ? { en: value } : value);
  const english = (value) => (typeof value === "string" ? value : value?.en);

  const slug = (sample ? sample.id.replace(/^sample-/, "") : english(title) ?? english(text) ?? (image ? basename(image) : "post"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const data = readPosts();
  let id = `${when.toISOString().slice(0, 10)}-${slug || "post"}`;
  if ((data.posts ?? []).some((entry) => entry.id === id)) id = `${id}-${Date.now().toString(36)}`;

  const post = { id, date: when.toISOString() };

  if (sample) {
    const { id: _id, date: _date, ...rest } = sample;
    Object.assign(post, rest);
  }
  if (title) post.title = asLocalized(title);
  if (text) post.text = asLocalized(text);
  if (notify && (notify.title || notify.body)) {
    post.notify = {};
    if (notify.title) post.notify.title = asLocalized(notify.title);
    if (notify.body) post.notify.body = asLocalized(notify.body);
  }

  if (image) {
    const from = resolve(image.replace(/^['"]|['"]$/g, "").trim());
    if (!existsSync(from)) throw new Error(`Picture not found: ${from}`);
    const name = `${id}${extname(from).toLowerCase()}`;
    copyFileSync(from, join(contentDir, "images", name));
    post.image = `images/${name}`;
  }

  data.posts = [post, ...(data.posts ?? [])];
  writeFileSync(postsFile, JSON.stringify(data, null, 2) + "\n");

  return post;
}

export function runNode(script) {
  return spawnSync(process.execPath, [join(root, "scripts", script)], { stdio: "inherit" }).status ?? 1;
}

export function git(...args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}
