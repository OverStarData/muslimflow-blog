#!/usr/bin/env node
/*
 * Adds a blog post (now, or queued for later) and rebuilds the feed.
 *
 *   npm run add -- --title "Heading" --text "Message" [--image pic.jpg]
 *                  [--at "2026-10-05 09:00"] [--notify-title "..."] [--notify-body "..."]
 *                  [--ar "..."] [--ms "..."] [--es "..."] [--fr "..."]
 *   npm run add -- --sample sample-text-and-image
 *
 * --text and --title are English; --ar/--ms/--es/--fr give the text in another
 * language. --at queues the post (local time). Without --at it goes live now.
 * Easier: npm run new  (asks you questions).
 */
import { addPost, parseWhen, readSamples, runNode } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

try {
  const sampleId = flag("sample");
  const sample = sampleId ? readSamples().find((entry) => entry.id === sampleId) : undefined;
  if (sampleId && !sample) throw new Error(`No sample called "${sampleId}". See content/samples.json.`);

  const text = flag("text");
  const title = flag("title");
  const image = flag("image");
  if (!sample && !text && !title && !image) throw new Error('Give at least --text "...", --title "..." or --image path');

  const localized = (english) => {
    if (!english) return undefined;
    const value = { en: english };
    for (const language of ["ar", "ms", "es", "fr"]) if (flag(language)) value[language] = flag(language);
    return value;
  };

  const when = parseWhen(flag("at"));
  const post = addPost({
    title,
    text: localized(text),
    image,
    when,
    sample,
    notify: { title: flag("notify-title"), body: flag("notify-body") },
  });

  console.log(`Added ${post.id} (${when > new Date() ? "queued for " + when.toISOString() : "live now"})`);
  process.exit(runNode("build.mjs"));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
