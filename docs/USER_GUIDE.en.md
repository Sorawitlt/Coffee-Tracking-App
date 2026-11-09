# Brew Log — Quick User Guide

> 🔗 Open the app: **https://sorawitlt.github.io/Coffee-Tracking-App/**\
> ฉบับภาษาไทย: [USER_GUIDE.md](USER_GUIDE.md)

Brew Log helps you **log brews, time them step by step, and tells you the one thing to change next time.**
Works on phone, tablet and computer, works offline, no sign-up.

---

## 1. Install it (recommended, one time)

Installing makes it open like a normal app, work offline, and **lowers the risk of losing data**.

| Device | How to install |
|--------|----------------|
| iPhone / iPad (Safari) | Share ⬆️ → **Add to Home Screen** |
| Android (Chrome) | Menu ⋮ → **Install app** |
| Computer (Chrome / Edge) | Install icon ⊕ in the address bar → **Install** |

> Open the app online once; after that it works offline.

---

## 2. Get started in 3 steps

**Bottom menu:** ☕ Brew · 📖 Log · 🫘 Beans · 📊 Insights\
**Top right:** 🌐 language (ไทย/English) · 🌓 theme · 💾 My data

1. **Add beans** — 🫘 Beans → **+ Add beans**. Enter name, roast date and bag weight (add the price to see cost per cup).
   The app counts days since roast and deducts the remaining weight automatically.
2. **(Optional) Add gear** — same tab → **⚙️ Gear** → **+ Add gear**. Type your model in
   **📚 Find your model in the catalog** (e.g. `DF64`, `Flair 58`, `V60`) and tap the match — the app fills in type,
   brand, model and **grind scale**, and shows a spec card with notes and **sources** (see 2.1).
   Not listed? Enter brand, model and grind scale yourself — the scale lets advice use real settings,
   e.g. "Grind 1 step finer (20 → 19)".
3. **Brew** — ☕ Brew → pick a method and beans → **▶ Start brewing**. Values come from the standard recipe or your last brew.

### 2.1 Reference catalog (gear · varieties · origins)

| Part | What's in it | Where it's used |
|------|--------------|-----------------|
| **Gear**, 42 models | Grinders (e.g. DF64 Gen 2, Niche Zero, Comandante C40, 1Zpresso, Baratza, Fellow) · brewers & espresso (e.g. Flair 58 Plus 2, Hario V60, AeroPress, Gaggia, La Marzocco) · kettles · scales · filters | Gear form → auto-fill + spec card |
| **Maker's recommended grind** | Only where the maker publishes it (e.g. Comandante: espresso 7–13 clicks) | Brew form → under "Grind setting" you see "Maker suggests …" for the chosen method |
| **Varieties** | International, from World Coffee Research (Typica, Bourbon, Geisha …) + Thai varieties from the Department of Agriculture (Chiang Mai 80, Chumphon 2 …) | Bean form → "Variety" suggestions |
| **Origins** | Producing countries + Thai origins (e.g. Chiang Rai – Doi Chaang / Doi Tung, per the GI register) | Bean form → "Origin" suggestions |

- **Every entry is sourced** — open "Sources" on the card to visit the maker's or institution's page. Each source is labelled
  (Manufacturer · Institution · Community) and dated.
- **Your own settings are kept** — a custom name (e.g. "Home DF64") and a grind scale you calibrated to your true zero are not overwritten.
- **Gear you added earlier** — open it; the app guesses the model from its name ("Is it one of these?"). Tap to link.
- **No roaster list** — roasters change too often to keep accurate. The "Roaster" field suggests names you entered before.
- Full list with links: [docs/CATALOG.md](CATALOG.md)

---

## 3. While brewing (Brew Assistant)

- Tap **▶ Start timer** when you start pouring. The app shows the next step with a **target weight** (e.g. "to 150 g").
- **Sound 🔔 / vibration 📳** alerts for each step (can be turned off), and the **screen stays on** while brewing.
- You can close the app mid-brew — the timer keeps correct time when you come back.
- When done, tap **✓ Finish** → **Save brew**.

---

## 4. Taste → get "Next time, try"

1. Give **1–5 stars** and pick taste **sour ↔ bitter** and body **thin ↔ strong** (~10 seconds).
2. Save → the app shows **"Next time, try (change just one thing)"**, e.g. grind finer, use more coffee, hotter water.
3. If it's great, tap **⭐ Save as the best recipe** for those beans.

> 💡 **Change one thing at a time** — the form highlights values that differ from last time (▲).

---

## 5. Quick log & brew again

- **Log without the timer:** 📖 Log → **+ Log a brew** (pre-filled from your last brew).
- **Brew again:** tap **🔁 Brew again** on any log card — all values are copied; change only what you want.
- **Search / filter** by beans, method, rating, or **Only ⭐ best recipes**.

---

## 6. See the big picture (📊 Insights)

- Number of brews, average rating, and trend (improving / declining).
- **Best recipe per bean** and **Rating over time** chart.
- **Brew Control Chart** (if you measure TDS). Every chart has **▦ View table** to see the numbers.

---

## 7. Your data (💾 button, top right)

| You want to | Do this |
|-------------|---------|
| **Back up** | **⬇️ Download backup file** (.json) → keep it in Google Drive / OneDrive. Reminder every 2 weeks (red dot on 💾). |
| **Move to a new device** | Old device: download backup → New device: **Restore data** and choose that file. |
| **Analyze in Excel** | **Export CSV** → double-click to open in Excel (Thai text displays correctly). |
| **Use in Google Sheets** | Export CSV → Google Sheets: **File → Import → Upload**. |
| **Gear register / ERP** | **⚙️ Gear (.csv)** has separate `brand`, `model` and `catalog_id` columns → use it as an asset register or map it to material codes in an ERP (e.g. SAP). The brews file has `grinder_id` and `brewer_id` to join on. |

> ⚠️ Restore **replaces** all data on that device — use **Back up current data first** before confirming.

---

## 8. FAQ

**How reliable is the reference catalog?**
Only values confirmed by a source are included (mostly the maker's own pages); anything unconfirmed is left blank.
Community-sourced values (e.g. the DF64 0–90 dial) carry a ⚠️ note. Specs can differ by revision or market — check your unit's manual.

**My model isn't in the catalog?**
Enter brand and model yourself; everything works as before (except the spec card and the maker's grind range).

**Where is my data stored? Is it private?**
**Only on your device.** Nothing is sent to a server and there is no account — so back up regularly.

**Does it sync between devices?**
Not automatically (no cloud sync yet). Use backup + Restore to move data.

**Can data be lost?**
Yes, if you clear browser data, or use Safari on iPhone/iPad **without adding it to the Home Screen** and don't open it for a long time.
→ **Install the app and back up regularly.** Check status at 💾 → **Storage on this device**.

**How do I update?**
Automatic when you open the app online. If you don't see the new version, close the app and open it again.

**Change language / dark mode?**
Use 🌐 (language) and 🌓 (theme) at the top. "Auto" theme follows your device setting.
