# Real-Estate Videos for Afik Hanahal (property reels, tours, project launches)

> House skill for the Afik Hanahal office (real estate, Sharon region, Israel). Read it for ANY property / real-estate /
> "נכס" / "דירה" / "מגרש" / "פרויקט" video request, together with `AGENT_GUIDE.md`, the pipeline's own director skills and
> `skills/creative/short-form.md` (vertical) or `skills/creative/long-form.md` (horizontal).
> Style playbook: **`afik-hanahal`** (`styles/afik-hanahal.yaml`). Never pick another playbook unless the user asks.

## 0. The rules that never bend

1. **Truth first.** Price, rooms, sqm, floor, parking, balcony, town, street: exactly as in the brief / the property's
   record. Never invent a feature, a view, a distance or a number. Unknown → leave it out.
2. **Generated or simulated visuals are labelled "הדמיה"** (English videos: "Visualization") on screen, bottom corner,
   the whole time they show. Real photos of the property are never "improved" into something they are not (no added rooms,
   no fake views, no removed walls). Sky replacement / light correction is fine.
3. **Hebrew is the default language**, right-to-left, Rubik. Captions max 2 lines, ~32 characters a line.
   Plural, gender-neutral address: "אתם", "לכם", "תתקשרו" — never "את/ה", never singular "אתה".
4. **The brand is a signature, not the subject**: logo + phone + booking link on the last 2–3 seconds only.
   - Name: אפיק הנחל (English: Afik Hanahal) — never translated.
   - Phone: 055-981-1814 · WhatsApp: https://wa.me/972559811814
   - Booking: https://www.afikhanahal.co.il/book · Site: https://www.afikhanahal.co.il
   - Logo (download once into `assets/brand/`): https://www.afikhanahal.co.il/logo.svg (dark backgrounds) ·
     https://www.afikhanahal.co.il/logo-black.svg (light backgrounds)
5. **Cost**: propose the cheapest path that reaches the quality bar (real photos + Remotion motion first, paid
   generation only for gaps). State the estimated cost before any paid call.

## 1. Getting the property's material

Every published property is on the office's public API (no key needed):

- One property: `https://www.afikhanahal.co.il/api/properties?one=<id>`
- All published: `https://www.afikhanahal.co.il/api/properties`

Useful fields: `title`, `location`, `neighborhood`, `category` (apartments / land / commercial / rentals), `type`,
`price`, `rooms`, `size` or `buildSqm`, `dunams`, `floor`, `description`, `images[]` (photo URLs, the first is the cover),
`videos` (if any), `gush` / `helka` (land plots), `status` (sold / rented → do not make a "for sale" video).
Download the photos into the project's `assets/` folder at full size. Prefer the user's own raw footage / drone clips
when they hand a folder over — those are the hero shots.

## 2. Formats (ask only if the user did not say)

| Format | Size | Length | Use |
|---|---|---|---|
| Reel / Story / TikTok | 1080×1920 (9:16) | 25–40 s | Instagram, Facebook, TikTok, WhatsApp status — **default** |
| Feed square | 1080×1350 (4:5) | 20–30 s | Facebook / Instagram feed ads |
| Tour | 1920×1080 (16:9) | 60–120 s | YouTube, the site, a project launch |

Deliver H.264 High, 8–15 Mbps, -14 LUFS, captions burned in AND an `.srt`.

## 3. Structure of a property reel (30–40 s)

| Beat | Time | What |
|---|---|---|
| Hook | 0–2 s | The strongest shot (view / living room / facade) + one line that says WHAT and WHERE: "4 חדרים עם מרפסת שמש · כפר סבא" or the price. No logo, no "שלום". |
| Space | 2–12 s | 3–5 wide shots, slow push-in / drift (Ken Burns on stills, 1.8–3 s each), the flow of the home: entrance → living → kitchen → balcony |
| Details | 12–22 s | 3–4 detail shots (light, finishes, storage, the view) with short captions of facts only |
| Spec card | 22–27 s | One clean card: price · rooms · sqm · floor · parking (only what is known), purple accent `#8490D8` |
| Location | 27–32 s | A map pin / the street / what is nearby — only true, checked facts |
| CTA | 32–38 s | "לפרטים ותיאום ביקור" + phone + "קביעת שיחה: afikhanahal.co.il/book" + logo |

For **land / a plot (מגרש)**: hook = the plot from above or the street; add gush/helka, size in dunams / sqm, zoning
only when given; a simple map frame; "הדמיה" on any visualized building.
For **a project launch**: hook = the visualization of the building (labelled "הדמיה") or the location; beats: the
project, the apartment mix, the neighborhood, timeline, CTA. Never promise prices or dates that are not in the brief.
For **a rental**: lead with the monthly rent and the entry date.

## 4. Voice and music

- Default: **no voice-over**, music + captions (most reels are watched muted). Voice-over only when asked.
- Voice-over: warm Israeli-Hebrew, natural pace (ElevenLabs multilingual or Google TTS he-IL; piper has no good Hebrew —
  don't use it for Hebrew). Script in short spoken sentences, plural address.
- Music: warm modern piano / soft house, 95–115 BPM, no lyrics, ducked under voice, cuts on the beat.
- Sound design: a soft whoosh on transitions, nothing on every cut.

## 5. Pipeline choice

- Photos / footage of a real property → **`hybrid`** (source footage + designed overlays). Default.
- A pure brand / project-launch film with generated shots → **`cinematic`** (label generated shots "הדמיה").
- Many short cuts from one long tour video / drone clip → **`clip-factory`**.
- A Hebrew video that also needs an English version → produce Hebrew first, then **`localization-dub`** (English
  captions in natural real-estate English: "plot", "land", "Tabu registration", "Sharon region").

## 6. Quality gate before rendering (the reviewer must check)

- [ ] Every number on screen matches the brief / API record.
- [ ] Hebrew renders RTL, no mirrored or broken letters, no punctuation on the wrong side.
- [ ] Text inside the 9:16 safe zone (900×1400 centered); nothing in the bottom 320 px.
- [ ] "הדמיה" on every generated / simulated visual.
- [ ] First 2 seconds say what + where (or price). Logo only at the end.
- [ ] Contrast ≥ 4.5:1 for every caption (dark scrim behind text on bright photos).
- [ ] Phone and booking link correct.

## 7. Batch work ("ערוך הרבה סרטונים")

When the user asks for several properties at once: one project per property (`projects/<property-id>-<slug>/`), the
same playbook and the same CTA card for all, render one reel first for approval, then run the rest without asking
again unless a property is missing photos. Keep a `batch-report.md` listing each video, its length, its cost and
anything left out.
