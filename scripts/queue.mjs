#!/usr/bin/env node
/* Lists what is queued and what is live: npm run queue */
import { readPosts } from "./lib.mjs";

const { posts = [] } = readPosts();
const now = Date.now();

const label = (post) => {
  const title = typeof post.title === "string" ? post.title : post.title?.en ?? post.text?.en ?? "";
  return `${new Date(post.date).toISOString().replace(".000Z", "Z")}  ${post.id}  ${String(title).slice(0, 50)}`;
};

const queued = posts.filter((post) => Date.parse(post.date) > now).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
const published = posts.filter((post) => Date.parse(post.date) <= now).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

console.log(`Queued (${queued.length}), publishes in this order:`);
for (const post of queued) console.log("  " + label(post));
console.log(`\nPublished (${published.length}), newest first:`);
for (const post of published.slice(0, 15)) console.log("  " + label(post));
if (published.length > 15) console.log(`  ... and ${published.length - 15} more`);
