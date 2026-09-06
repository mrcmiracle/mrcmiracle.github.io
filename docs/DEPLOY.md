# Deploying MRC Miracle

Follow these in order. Steps 1–3 put the site online. Steps 4–5 turn on data
collection and analytics. Nothing here costs money.

Set aside about an hour for the first run.

---

## Before you start

You need a GitHub account. If you do not have one, go to <https://github.com/signup>
and make one. Use an email you will still have after graduation.

> **Do the whole of Step 1 before you print anything.** The URL is decided there,
> and changing it later breaks every poster already in the wild.

---

## Step 1 — Create the organization and the repository

We are using a GitHub **organization** rather than your personal account. Two reasons:
the URL says the project's name instead of your username, and you can add next year's
officers as owners so the site outlives you.

1. Go to <https://github.com/account/organizations/new>.
2. Choose the **Free** plan.
3. Organization name: `mrcmiracle`
   - This becomes your URL, so it must be exactly what you want.
   - If it is taken, try `mrc-miracle` or `mrcmiracleking`. **Write down which one you
     got** — every step below assumes `mrcmiracle`, so substitute yours.
4. Contact email: your school email. "My personal account" is the right choice for
   "This organization belongs to".
5. Skip inviting members for now. You can add people later under **People**.

Now the repository:

6. Go to <https://github.com/organizations/mrcmiracle/repositories/new>.
7. Repository name: **`mrcmiracle.github.io`** — exactly this, matching your org name.
   This exact naming is what produces a URL with no folder path after it.
8. Set it to **Public**. GitHub Pages requires public on the free plan.
9. Do **not** check "Add a README file" — you are uploading one.
10. Click **Create repository**.

Your permanent URL will be:

```
https://mrcmiracle.github.io
```

---

## Step 2 — Upload the site

### The easy way (no software to install)

1. On the empty repository page, click **uploading an existing file**.
2. Open the `mrc-miracle` folder on your computer.
3. Select everything **inside** it — `index.html`, the other four `.html` files, and
   the `css`, `js`, `data`, `i18n`, `assets`, `apps-script`, `docs` folders — and drag
   them into the browser window.
   - Drag the *contents*, not the folder itself. If you upload the folder, your URL
     gains an extra `/mrc-miracle/` and the site will not load.
4. Wait for every file to finish uploading. There are about 25.
5. In the "Commit changes" box type `Initial site`, then click **Commit changes**.

### The command-line way

If you would rather use Terminal, the repository is already initialized locally:

```bash
cd ~/Downloads/mrc-miracle && git add -A && git commit -m "Initial site" && git branch -M main && git remote add origin https://github.com/mrcmiracle/mrcmiracle.github.io.git && git push -u origin main
```

GitHub will ask for a password. It will **not** accept your account password — you need
a personal access token from <https://github.com/settings/tokens> (choose "Generate new
token (classic)", tick the `repo` box, copy the token, paste it as the password).

---

## Step 3 — Turn on GitHub Pages

1. In the repository, click **Settings** (top bar), then **Pages** (left sidebar).
2. Under "Build and deployment", set Source to **Deploy from a branch**.
3. Branch: **main**, folder: **/ (root)**. Click **Save**.
4. Wait two or three minutes. Refresh the page and a green banner shows your live URL.

Open <https://mrcmiracle.github.io> on your phone. You should see the site.

**If you get a 404,** wait five more minutes — the first deploy is the slowest. If it
persists, check that `index.html` is at the top level of the repository and not inside
a subfolder.

From here on, any change you commit is live in about a minute.

---

## Step 4 — Connect the data collection

This is what fills your spreadsheet. Until you finish it, the site works fine but
records nothing.

1. Go to <https://sheets.google.com> and create a **new blank spreadsheet**.
2. Name it something like `MRC Miracle data`.
3. In the menu: **Extensions → Apps Script**. A code editor opens in a new tab.
4. Delete the sample `function myFunction() {}` that is already there.
5. Open `apps-script/Code.gs` from this project, copy **all** of it, and paste it in.
6. Click the save icon (or Ctrl/Cmd+S).
7. **Test it first.** In the toolbar, pick `testWrite` from the function dropdown and
   click **Run**. Google will ask for permission:
   - "Google hasn't verified this app" → click **Advanced** → **Go to (project name)**.
   - This warning is normal for your own scripts. You are granting access to your own
     spreadsheet, nothing else.
   - Approve it. Then check the spreadsheet: a tab named `events` now exists with a
     header row and one test row. **Delete the test row.**
8. Now deploy: **Deploy → New deployment**.
   - Click the gear next to "Select type" and choose **Web app**.
   - Description: `collector`
   - Execute as: **Me**
   - Who has access: **Anyone** ← this must be "Anyone", not "Anyone with Google account".
     Library visitors are not signed in to Google.
   - Click **Deploy**, approve again if asked.
9. Copy the **Web app URL**. It ends in `/exec`.
10. Paste that URL into `js/track.js`, between the quotes on this line near the top:

    ```js
    var ENDPOINT = '';
    ```

    becomes

    ```js
    var ENDPOINT = 'https://script.google.com/macros/s/AKfy..../exec';
    ```

11. Commit that change (edit the file directly on GitHub: open `js/track.js`, click the
    pencil icon, paste, then **Commit changes**).

**Check it worked:** open the live site, run the kit calculator, then look at your
spreadsheet. Rows should appear within a few seconds. If nothing arrives, open the site,
press F12 for the browser console, and look for a line starting `[track]`.

> **Export to a spreadsheet** is just **File → Download → Comma Separated Values** in
> Google Sheets. The data is already in a spreadsheet; nothing to migrate.

> **A note on the endpoint being public:** anyone who views your site's source can see
> that URL and could send junk rows. That is unavoidable for a site with no login, and
> it is not a privacy problem — nothing personal is stored. If you ever get spam rows,
> filter them out by the `site_version` column, or ask for help adding a shared token.

---

## Step 5 — Turn on analytics

GoatCounter gives page views, unique visitors, and per-page numbers. It sets no
cookies, so no consent banner is required.

1. Go to <https://www.goatcounter.com/signup>.
2. Pick a code — for example `mrcmiracle`. Your dashboard becomes
   `https://mrcmiracle.goatcounter.com`.
3. Choose the **Free / non-commercial** plan.
4. Open `js/app.js` on GitHub, click the pencil, and set:

   ```js
   var GOATCOUNTER_CODE = 'mrcmiracle';
   ```

5. Commit. Wait a minute, load your live site, then check your GoatCounter dashboard —
   your own visit should appear.

Under **Settings** in GoatCounter you can make the dashboard public, which is handy for
showing judges live numbers without handing over your login.

---

## Step 6 — Before the posters go to print

Work through this list. Several items need someone other than you.

- [ ] Real clean air locations are in `data/clean-air-sites.json`, every
      `"placeholder": true` entry is gone, and `"verified"` is set to `true`
      (see `UPDATING-SITES.md`)
- [ ] A fluent Spanish speaker has read `i18n/es.json` and `_meta.reviewed` is now `true`
- [ ] Your MRC Unit 503 contact has read the earthquake and smoke text and approved it
- [ ] The wound care link in `index.html` points at your teammate's real tool
- [ ] The logo placeholder in the footer has been replaced, or is deliberately left
- [ ] You have opened the live URL on a real phone, on library wifi if you can
- [ ] The QR code on the poster points to `https://mrcmiracle.github.io` and you have
      scanned the printed proof yourself
- [ ] Data is arriving in your spreadsheet
- [ ] Analytics is counting

---

## Keeping the URL alive after you graduate

Under **Settings → People** in the organization, add at least one other owner — an
advisor, or next year's officers. An organization with two owners survives any one
person losing access. This is the single most important thing you can do to keep a
printed poster from going dead.
