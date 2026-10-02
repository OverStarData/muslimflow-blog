# Muslim Flow blog

The posts of the Muslim Flow app blog live here, in their own **public**
repository. Pushing a change publishes it; the app reads the result. There are
no user accounts and no server to run.

```
you write a post  ->  push to GitHub  ->  GitHub builds and publishes it
                                          ->  the app loads it (cached for offline)
                                          ->  users read, like, share, save pictures
```

## One-time setup (about 10 minutes)

1. **Create the repository** on GitHub: name `muslimflow-blog`, **Public**
   (free Pages and free automatic publishing need a public repository; your app
   code stays private in its own repository).
2. **Upload this folder** (run these in this folder):

   ```bash
   git remote add origin https://github.com/<your-user>/muslimflow-blog.git
   git push -u origin main
   ```

3. **Turn on publishing:** repository **Settings -> Pages -> Source: GitHub
   Actions**. Then open the **Actions** tab, choose **Publish blog** and press
   **Run workflow** once.
4. **Check it works:** open `https://<your-user>.github.io/muslimflow-blog/index.json`.
   You should see a short piece of JSON.
5. **Tell the app where the blog is** (only if your user or repository name is
   different from the default): set `BLOG_BASE_URL` in the app's
   `constants/resources.ts` to `https://<your-user>.github.io/muslimflow-blog`,
   and set `siteUrl` in `content/config.json` here to the same address. Release
   a new app build after changing it.

## Every day: add a post

**From your computer** (needs Node 18 or newer):

```bash
npm run new        # asks for the title, text, picture and time
npm run publish    # saves and uploads; the blog updates in about a minute
```

Or in one command:
`npm run add -- --title "Heading" --text "Message" --image ~/Desktop/pic.jpg`
(then `npm run publish`). Use `--ar "..."`, `--ms "..."`, `--es "..."`,
`--fr "..."` for the text in other languages.

**From the GitHub website, with no tools** (works on a phone too):

1. Upload the picture: **content/images -> Add file -> Upload files**.
2. Open **content/posts.json** -> pencil icon -> add a post at the top of the
   list (copy one from `content/samples.json`) -> **Commit changes**.
3. The blog updates in about a minute.

## Queue a post for a later time

```bash
npm run add -- --title "Friday reminder" --text "..." --at "2026-10-09 09:00" \
  --notify-title "Jumu'ah reminder" --notify-body "A reminder is waiting for you."
npm run publish
```

- `--at` uses your local time (or a full date such as `2026-10-09T09:00:00Z`).
- A queued post is **not published**: its content is in no public file until
  its time has passed. Only its time and the optional notification text are
  listed, so phones can schedule a notification.
- It goes live on the first publishing run after its time (runs happen every 10
  minutes, so up to about 10 to 15 minutes late). Phones show the notification
  15 minutes after the time, when the post can be opened.
- `npm run queue` shows what is queued and what is live. Change or delete a
  queued post any time by editing `content/posts.json` and publishing again.
- Notifications are local: a phone learns about queued posts when the app
  loads the blog (Home or Blog, at most every 30 minutes). A phone that has not
  opened the app since a post was queued will not get its notification.

## Privacy policy page (for Google Play and the App Store)

The blog site also publishes the app's privacy policy, in all five app
languages, at:

```
https://<your-user>.github.io/muslimflow-blog/privacy.html
```

Paste that address into **Play Console -> App content -> Privacy policy** (and
the App Store Connect "Privacy Policy URL"). The page comes from
`content/privacy.json`, which the app project writes from the policy text in
the app, so the app and the web page always match. After changing the policy in
the app project, run `npm run blog:export-privacy` there, copy the new
`content/privacy.json` into this repository and publish.

## Examples

`content/samples.json` has one example of every kind of post (text, long text,
text and picture, picture only, title and picture, link, queued). Samples are
never published. Start from one with
`npm run add -- --sample sample-text-and-image`.

## Post fields

| Field | Notes |
| --- | --- |
| `id` | Unique, letters, numbers, `-` or `_` only. Used in the link and for likes. Never reuse it. |
| `date` | Publish time, like `2026-10-02T08:00:00Z`. A future date means queued. |
| `title`, `text` | Text, or `{ "en": "...", "ar": "...", "ms": "...", "es": "...", "fr": "..." }`. The app shows the reader's language and falls back to `en`. Blank lines make paragraphs. |
| `image` | `images/file.jpg` (picture in `content/images`) or a full `https://` address. |
| `imageWidth`, `imageHeight` | Optional. Stops the list jumping while the picture loads. |
| `imageAlt` | Optional description for screen readers (text or per language). |
| `link` | Optional `{ "url": "https://...", "label": "Read more" }`. |
| `notify` | Optional `{ "title": ..., "body": ... }` for the queued-post notification. |

Keep pictures under about 1 MB (about 1080 px wide).

## What readers get

- A feed that loads page by page, works offline for posts already opened, and
  has a page per post for reading, liking, sharing and saving the picture.
- **Share link:** `https://<user>.github.io/muslimflow-blog/p/<id>.html` is a
  clean web page with the full post, the picture and the buttons "Open in the
  app" (`muslimflow://blog/post?id=...`) and "Get the app".
- Likes stay on each phone (there are no accounts).

## If something is wrong

- **The app says "No posts yet":** the address in the app does not open
  `index.json` yet. Re-check steps 3 to 5.
- **A post does not appear:** its `date` is in the future (queued), or the
  Actions tab shows a red run. Open the run to see the message; the build also
  prints what to fix when `posts.json` has a mistake.
- **Scheduled runs stop:** GitHub pauses scheduled workflows after 60 days with
  no commits. Any new post, or **Run workflow**, turns them back on.
- **Another host** (Netlify, Cloudflare Pages, your own server): run
  `npm run build`, upload the `dist` folder, and run it again at queued times.
