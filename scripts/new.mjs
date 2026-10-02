#!/usr/bin/env node
/* Asks a few questions, adds the post and rebuilds: npm run new */
import { createInterface } from "node:readline/promises";
import { addPost, LANGUAGES, parseWhen, runNode } from "./lib.mjs";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (question, fallback = "") => (await rl.question(question)).trim() || fallback;
const unescape = (value) => value.replace(/\\n/g, "\n");

try {
  console.log("New blog post. Press Enter to skip a question. Use \\n for a new paragraph.\n");

  const title = { en: await ask("Title (English, optional): ") };
  const text = { en: unescape(await ask("Text (English): ")) };

  if ((await ask("Add other languages (ar, ms, es, fr)? y/N: ")).toLowerCase().startsWith("y")) {
    for (const language of LANGUAGES.filter((code) => code !== "en")) {
      const translatedTitle = await ask(`  Title in ${language}: `);
      const translatedText = unescape(await ask(`  Text in ${language}: `));
      if (translatedTitle) title[language] = translatedTitle;
      if (translatedText) text[language] = translatedText;
    }
  }

  const image = await ask("Picture file (drag it here, optional): ");
  const at = await ask('Publish time like "2026-10-05 09:00" (Enter = now): ');
  const when = parseWhen(at);

  let notify;
  if (when > new Date()) {
    const notifyTitle = await ask("Notification title (optional): ");
    const notifyBody = await ask("Notification text (optional): ");
    notify = { title: notifyTitle, body: notifyBody };
  }

  if (!title.en && !text.en && !image) throw new Error("A post needs a title, text or a picture.");

  const post = addPost({
    title: title.en || Object.keys(title).length > 1 ? title : undefined,
    text: text.en || Object.keys(text).length > 1 ? text : undefined,
    image,
    when,
    notify,
  });

  rl.close();
  console.log(`\nAdded ${post.id} (${when > new Date() ? "queued for " + when.toISOString() : "live now"})`);
  console.log("Next: npm run publish\n");
  process.exit(runNode("build.mjs"));
} catch (error) {
  rl.close();
  console.error(error.message);
  process.exit(1);
}
