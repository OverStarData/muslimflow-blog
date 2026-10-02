#!/usr/bin/env node
/*
 * Checks the blog, saves your changes and uploads them to GitHub, which
 * publishes the blog by itself: npm run publish
 * Add --yes to skip the question.
 */
import { createInterface } from "node:readline/promises";
import { git, runNode } from "./lib.mjs";

if (runNode("build.mjs") !== 0) process.exit(1);

if (git("rev-parse", "--is-inside-work-tree").status !== 0) {
  console.error("This folder is not a git repository. See README.md, step 2.");
  process.exit(1);
}

const branch = git("branch", "--show-current").stdout.trim();
const status = git("status", "--porcelain", "content").stdout.trim();

if (!status) {
  console.log("Nothing new to publish.");
  process.exit(0);
}

console.log(`\nChanges to publish (branch ${branch}):\n${status}\n`);

if (!process.argv.includes("--yes")) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("Upload these now? y/N: ")).trim().toLowerCase();
  rl.close();
  if (!answer.startsWith("y")) {
    console.log("Cancelled. Nothing was uploaded.");
    process.exit(0);
  }
}

for (const args of [["add", "content"], ["commit", "-m", "Blog: update posts"], ["push", "origin", branch]]) {
  const result = git(...args);
  process.stdout.write(result.stdout);
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    console.error(`\nStopped at: git ${args.join(" ")}`);
    process.exit(1);
  }
}

console.log("\nUploaded. The blog goes live in about a minute (queued posts at their time).");
