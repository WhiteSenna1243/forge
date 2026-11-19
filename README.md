# FORGE

A free calorie tracker for UNC Charlotte students. Log food, hit your calories and macros, plan meals with a coach you can talk to, and pull in today's dining hall menus from Dine On Campus.

- **Works on phones**: open the link, then Add to Home Screen. It runs like an app and works offline.
- **Accounts (optional)**: log in to back up your diary and sync it across devices, or tap "Use without an account" to keep everything on the phone only.
- **Private**: each person can only ever see their own data (enforced by the database's row-level security).
- **No AI bills**: the coach runs on rules in the browser.

## Live

**https://whitesenna1243.github.io/forge/**, hosted free on GitHub Pages. Send friends the link.

To publish changes after editing files in `public/`, commit them, then run:

```bash
git subtree push --prefix public origin gh-pages
```

## Put it online yourself (another host)

The app is just the files in `public/`. Any static host works. The easiest is Netlify Drop:

1. Make a free account at https://app.netlify.com/signup.
2. Go to https://app.netlify.com/drop and drag the **`public`** folder onto the page.
3. You get a link like `https://random-name-123.netlify.app`. Rename it under **Site configuration → Change site name** (for example `forge-unc`).
4. Send the link to friends. On a phone: open it, then Share → **Add to Home Screen** (iPhone) or ⋮ → **Add to Home screen** (Android).

To update the app later, drag the `public` folder onto the site's **Deploys** page.

GitHub Pages or Cloudflare Pages work too: upload the contents of `public/`.

## Accounts (Supabase)

Logins and synced diaries live in a free Supabase project. `public/config.js` holds its URL and public "anon" key, which are meant to be public. The database rules in [supabase.sql](supabase.sql) are what keep data private. To set up a new project, run that script in Supabase's SQL Editor and turn off **Authentication → Sign In / Providers → Confirm email**, because the free plan only sends about 2 emails an hour.

Free projects pause after a week with no activity. Opening the dashboard wakes them up.

## Run it on your computer

```bash
npm start
```

Then open http://127.0.0.1:3000.

## Features

- **Diary**: breakfast, lunch, dinner and snacks, a calories-left gauge, and protein/carbs/fat bars. Use ‹ › to change the day.
- **Campus**: today's menus from every UNC Charlotte dining location, with nutrition and vegetarian/vegan badges. Tap an item to log it.
- **Coach**: say (🎤) or type a goal, like "lose 10 pounds by spring break" or "150g protein, what should I eat tonight?". It understands:
  - losing, gaining or maintaining, in pounds or kg
  - deadlines ("by March 1", "in 8 weeks", "spring break")
  - protein and calorie numbers
  - a meal (breakfast, lunch, dinner, tonight)
  - diets (vegetarian, vegan, pescatarian, halal/no pork, gluten-free, dairy-free), allergies ("allergic to peanuts") and dislikes ("hate rice", "no mushrooms or onions"), checked against Dine On Campus's labels and ingredients

  It sets daily targets, caps unsafe loss rates, and builds meals for the rest of today from the campus menu.
- **Profile**: your daily target comes from the Mifflin-St Jeor formula, using your stats, activity and goal. You can override it.

## Loading campus menus

Dine On Campus blocks other apps and websites from reading its menus. So the import is a bookmark you tap while you're on the real Dine On Campus site. It reads all 24 locations, which takes about 40 seconds. The Campus tab has step-by-step instructions for computer, iPhone and Android.

- **Computer**: drag the **FORGE import** button to your bookmarks bar. Click it on Dine On Campus, then click **Send to FORGE**.
- **Phone**: copy the import code into a bookmark. Tap it on Dine On Campus, tap **Copy**, then **Paste menu** in FORGE.

Load the menus again each day. If Dine On Campus changes their site, the import may stop working.

## Tests

```bash
npm test
```
