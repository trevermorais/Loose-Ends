# Loose Ends — from web game to store apps

`www/` is the whole game (plain HTML/CSS/JS, fully offline, no server, no login).
Capacitor wraps `www/` in a real Android / iOS app. The same folder is also a
PWA, which is how you publish to the Microsoft Store.

Progress (coins, kills, upgrades) is saved on-device in localStorage. There is
no backend, so there is nothing to host or pay for, and the privacy policy is
simple: "we collect nothing".

> Your original Flask version is untouched in `ragdoll_archer/`. This folder is
> a separate build for the stores.

## 0. Before anything else (5 minutes, do it once)

1. **App ID**: `capacitor.config.json` -> `appId` is `com.kennoldesigns.looseends`.
   This is permanent once you publish. Change it now if you want something else.
2. **Host the game + privacy page**: both stores need a public HTTPS URL. GitHub Pages (free) can only
   serve the repo root or a `/docs` folder, so copy the *contents* of `www/` into a repo's `docs/` folder
   (or its root), then Settings -> Pages -> deploy from that folder. Your privacy URL is then
   `https://<user>.github.io/<repo>/privacy.html`.
3. **Icons**: `www/icons/` has a placeholder bow-and-arrow mark. Replace it with
   your own Kennol-style artwork (1024x1024 master, plus 512 and 192).
4. **Screenshots** (needed by every store): run `npm run serve`, open
   `localhost:8080` in Chrome DevTools phone mode (landscape), capture 4-8 shots.

## 1. Google Play (Android) — do this first

Requirements as of Oct 2026 (verified, see Sources):
- New apps/updates must **target Android 16 (API 36)** since 31 Aug 2026.
  Capacitor 8 already targets 36 (`android/variables.gradle`).
- A **new personal developer account** must run a **closed test with 12+ testers
  opted in for 14 continuous days** before it can apply for production access.
  Start recruiting testers (friends, classmates) the day you upload.
- Play charges a one-time developer registration fee (about US$25).

Steps (needs Node + Android Studio):
```bash
npm install
npm run add:android     # already done once here; re-run is safe on a fresh checkout
npm run open:android    # opens Android Studio
```
In Android Studio: Build -> Generate Signed App Bundle -> **Android App Bundle (.aab)**.
Create a keystore and **back it up (never commit it)**; if you lose it you can't update the app.
Then in Play Console: create app -> upload `.aab` to **Closed testing** -> add 12+ tester emails
-> fill in store listing, **Data safety** (answer: collects no data), **Content rating**
(stylised cartoon violence: expect Teen/PEGI 12), target audience, privacy policy URL.
After 14 days, "Apply for production access".

## 2. Microsoft Store (Windows laptops) — easiest, and free for individuals

Individual developer registration is now free.
1. Host `www/` on HTTPS (see step 0.2).
2. Register at **storedeveloper.microsoft.com** -> "Individual developer" (free; needs a Microsoft account with MFA,
   a government ID and a selfie).
3. In Partner Center reserve the name "Loose Ends" and note the Package ID, Publisher ID and Publisher display name
   (Product management -> Product identity).
4. At **pwabuilder.com** enter your site URL, fix anything it flags, choose **Windows**, paste those three values, download the package.
5. Partner Center -> your app -> Start submission -> upload the `.msixbundle`/`.msix`, fill in the listing
   (screenshots, description, age rating, privacy URL) and submit. Certification usually takes a few days.

## 3. Apple App Store (iOS)

Needs a **Mac with Xcode** and an **Apple Developer Program** membership (about US$99/year).
If you don't have a Mac, use a cloud Mac / CI service (e.g. Codemagic) for the build step.
```bash
npm run add:ios
npm run open:ios        # Xcode -> set Team + bundle ID -> Product > Archive -> upload to App Store Connect
```
Test via TestFlight first. Apple reviewers reject apps that feel like "just a website",
so lean on what is genuinely app-like here: offline play, touch controls, saved progress.

## Updating after launch
Edit files in `www/`, bump `versionCode`/`versionName` in `android/app/build.gradle`
(and bump `CACHE` in `www/sw.js`), run `npm run sync`, build a new bundle, upload.

## Reusable ART prompt for your next app
```
A: Act as a senior mobile game developer who ships Capacitor apps to Play, App Store and Microsoft Store.
R: Convert my web game (attached zip) into an offline store-ready app: remove server/login,
   add touch controls, PWA files, privacy page, icons, and a publishing checklist.
T: Landscape only. Keep my art style. Output a runnable folder + PUBLISHING.md.
   Test in a headless phone-sized browser. No ads or trackers. List anything I must do myself.
```

## Sources
- Play Console Help — [testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- Median — [Google Play target API requirements 2026](https://median.co/blog/google-plays-target-api-level-requirement-for-android-apps)
- Windows Developer Blog — [free registration for individual developers](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/)
