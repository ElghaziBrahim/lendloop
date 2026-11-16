# LendLoop landing page — measured redesign spec

Status: measured, ready for K-552
Project: lendloop
Card: K-551 (after K-550 photo brief)
Source of truth for styling: `docs/design-reference.jpg` (1024×1536)
Source of truth for content and behaviour: the app in `src/`
Created: 2026-11-15

This document converts the design image into numbers the build can be checked against. Every
number below was measured from the image with PIL (Python 3, no numpy). Nothing in `src/` was
changed to produce it.

Read this with `docs/design/photo-brief.md`, which owns the three photographs and their prompts.

---

## 0. Baseline: the page as it stands today

Captured from the existing production build (`npx next start -p 3111`) against the deployment in
`.env.local`, signed out, after fonts and the Convex shelf had settled.

| Viewport | File | Pixel size | Notes |
| --- | --- | --- | --- |
| 1440 | `docs/screenshots/baseline-1440.png` | 1440×1145 | DPR 1, full page, 9 real tools |
| 390 | `docs/screenshots/baseline-390.png` | 1170×7107 | DPR 3, full page, 390 CSS px wide |

What today's page is (from `src/app/page.tsx`, confirmed by the screenshots):

- A 64 px header (`h-16`) with the wordmark and a quiet "Sign in"; no nav, no dark CTA.
- A `max-w-5xl` (1024 px) container with `px-6`. Hero text left, three bordered step cards right.
- One plain zinc hero band (`bg-zinc-50`), then a white "On the shelf" band: a 3-column grid of
  9 bordered cards, each a name plus a grey category pill.
- A one-line footer. No photographs, no serif display face, no sage or forest colour.
- Page height 1145 px at 1440; 2369 CSS px at 390.

The redesign replaces the shell; the shelf data path (server-rendered, name + category only) and
the Clerk/Convex behaviour do not change.

---

## 1. Source and method

- Image: `docs/design-reference.jpg`, 1024×1536, RGB JPEG.
- Measurement: `PIL.Image.getpixel` scans for ink bands, colour runs, edge gradients and flat-colour
  medians. Cap heights are measured on a single capital letter per text element, then divided by
  the face's cap ratio (0.727 for the Geist sans, 0.70 for the Fraunces serif) to estimate the font
  size in reference pixels.
- Touch tolerance: an AI-rendered comp has soft edges, so every coordinate below carries **±4
  reference px** (≈ 6 CSS px at the build factor). Band boundaries are the most reliable reading;
  individual row centres are the least.
- All "ref" values are image pixels. All "CSS" values are at the 1440 build canvas, converted by
  **×1.40625** (see §2). Coordinates are rounded to whole pixels; grid widths to the nearest 2–4.

Three reference readings worth keeping:

- The image is a *composition*, not a browser screenshot: its border radii are elliptical, its
  how-it-works grid starts 27 ref px inside the main container (so it is not centred), and its text
  is set at ~16 ref px on a 1024 canvas. The spec keeps its proportions and normalises the grid, it
  does not copy its artefacts.
- Text in the image measures as 16 px body at 1024. That is the image's own scale, not the build's.
  Converting proportionally is the only way a 1440 screenshot can be overlaid on it.
- Everything is sampled in sRGB. JPEG noise moves a flat colour by 2–4 per channel; the hexes below
  are medians over flat patches, not single pixels.

---

## 2. Canvas, factor, and the measured features that fix the grid

**Build canvas: 1440 CSS px. Conversion factor: 1024 → 1440 = ×1.40625.**

The image is scale-free: any canvas reproduces it if every number is multiplied by `C / 1024`.
The plan's desktop target is 1440, so the factor is 1.40625 and the page is 1536 × 1.40625 =
**2160 px tall** at that width — exactly 1.5 × 1440, a 2:3 page.

Three independent horizontal features fix the widths *inside* that canvas:

1. **Shared left margin.** The header icon, the H1, the hero paragraph and the shelf card all begin
   at x = 53. Four different elements agreeing makes this the strongest reading in the image.
   `53 → 74.5 CSS`.
2. **Header band's right edge.** The "Get started" button ends at x = 978. `978 → 1375.3 CSS`.
   With (1) this gives the main band: **75 → 1375, 1300 px wide, 70 px gutters.**
3. **Cross-check on a different container — the CTA panel.** The pale green panel spans x = 28 →
   998. `28 → 39.4 CSS`, `998 → 1403.4 CSS`. Spec: **39 → 1403, 1364 px wide, 38 px gutters.**

All three land inside 0.6 px of the spec values and none depends on the type scale, so the grid is
derived from geometry alone. A fourth check, the full page: the same factor turns the 1536 ref page
into 2160 CSS, exactly 1.5 × 1440.

The composer's other bands are not on this grid: the footer runs 37–987, the how-it-works grid
80–978, and the shelf's margin note reaches 997. They all sit within 40 CSS px of the 1300 band and
are **normalised to 75–1375**; the deviation is the image's artefact, not a second container. The
one deliberate exception is the CTA panel, which really is wider (1364).

Be precise about what these features prove: the reference is scale-free, so **no feature can prove
a canvas** on its own — a 1024 canvas would put the H1 at 43 px and the three columns at 250 px
(tablet proportions for a layout the plan requires at desktop), and a 1280 canvas would give
1156 / 1212 / 1188 with the identical look. The canvas is a build decision fixed by the plan
(1440); the features above are what convert it into container widths. Every table in this document keeps the
reference column, so if the build canvas ever changes, the new value is `ref × C / 1024` and nothing
else moves.

Sanity note: at this factor the body text is 22 px and the H1 is 60 px. That is deliberately larger
than the dashboard's type — the landing page is an editorial composition, the dashboard is not
touched by this redesign.

---

## 3. Band map

Reference y → CSS y at 1440. "CSS h" is the band height, not the next band's start, because the
rounding accumulates.

| # | Band | Ref y | Ref h | CSS y | CSS h | Background |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Header | 0–58 | 59 | 0–83 | 83 | canvas `#FAF6F0` |
| 2 | Hero | 59–444 | 386 | 83–626 | 543 | canvas + photo bleeding right |
| 3 | Shelf section | 445–837 | 393 | 626–1179 | 553 | canvas |
| 3a | — shelf card | 475–806 | 332 | 668–1135 | 467 | surface `#FCFBF7` |
| 4 | How it works | 838–1084 | 247 | 1179–1525 | 346 | canvas |
| 5 | Why LendLoop | 1085–1290 | 206 | 1525–1815 | 290 | warm `#F7F2EA` |
| 6 | CTA band | 1291–1474 | 184 | 1815–2074 | 259 | canvas, panel inset |
| 6a | — CTA panel | 1312–1474 | 163 | 1845–2073 | 228 | panel `#EBEEDF` |
| 7 | Footer | 1475–1536 | 62 | 2074–2160 | 86 | canvas |

Sum of the CSS bands: **2160** (§2); the heights are the differences between the rounded
boundaries, so they drift by a pixel from the raw `ref × 1.40625` product. The shelf and
how-it-works bands share one cream background; the boundary at 837 ref is whitespace, not a rule.
There is no horizontal rule anywhere between sections except the card's own 1 px border and the
edge of the why band's background.

Section rules the build can fail against (at 1440):

| Boundary | CSS y (±8) |
| --- | --- |
| Header bottom / hero top | 83 |
| Hero bottom (photo) | 626 |
| Shelf card top | 668 |
| Shelf card bottom | 1135 |
| How-it-works top (eyebrow) | 1179 |
| Why band top | 1525 |
| Why band bottom | 1815 |
| CTA panel top | 1845 |
| CTA panel bottom / footer top | 2073 |
| Page bottom | 2160 |

---

## 4. Section geometry

All x values are CSS at 1440. `L` = 75 (container left), `R` = 1375 (container right).

### 4.1 Header — ref 0–58

| Element | Ref box | CSS box |
| --- | --- | --- |
| Icon (chain link) | x 53–96, y 18–39; glyph ink 43×21 | 60×60 icon box at x 75, y 23 |
| Wordmark text | x 107–220, y 19–42 | x 150–309, 35 px |
| Nav link 1 "How it works" | x 317–397 | x 446–558 |
| Nav link 2 "Explore tools" | x 434–516 | x 610–726 |
| Nav link 3 "Why LendLoop" | x 552–646 | x 776–909 |
| CTA button "Get started" | x 861–978, y 10–46 | x 1211–1375, 164×52 |

- Header height 83. The build may use 84 without affecting any other band check.
- Logo block and nav are vertically centred; the CTA is 52 tall with a 14 px top offset.
- Nav item gap: `317→434` is 117 ref, but link widths differ; the *gap* between the ink boxes is
  37 ref (52 CSS). Spec: `gap-12` (48) between links, `gap-16` (64) between the nav group and CTA.
- The nav sits roughly centred on the page: its ink spans 446–909 CSS (centre 677) against a page
  centre of 720, so the nav is left-shifted by 43 px. In the build it is left-aligned after the
  wordmark with `gap-12`; centring it would break the 1300 container. Do not centre it.
- Sticky is not in the image. **Static** header, no border, no shadow.

### 4.2 Hero — ref 59–444

| Element | Ref box | CSS box |
| --- | --- | --- |
| Photo slot | x 460–1023, y 59–444; 564×386 | x 647–1440, y 83–626; 793×543 |
| H1 line 1 | x 53–461, cap 128–159, descender 167 | x 75–648, cap 180–224 |
| H1 line 2 | x 53–428, cap 172–203 | x 75–602, cap 242–285 |
| Squiggle underline | x 53–199, y 205–223; 146×19 | x 75–280, y 288–314; 205×27 |
| Lead paragraph | x 53–452, 3 lines, 235–307; pitch 23 | x 75–636, 3 lines, 330–432; pitch 32 |
| Primary pill | x 53–299, y 328–370; 247×43 | x 75–420, y 461–520; 347×60 |
| Text link "List something to lend" | x 287–418, y 340–356 | x 404–588, y 478–500 |
| Trust icon | x 56–73, y 393–413; 18×21 | x 79–103, y 553–581; 25×29 |
| Trust line | x 86–421, y 393–411 | x 121–592, y 553–578 |

- The photo is full-bleed on the right and runs from the header's bottom edge to the hero's bottom
  edge. It has no radius and no border.
- A cream scrim fades the photo's left edge into the page over roughly 60 ref px (≈ 85 CSS). Build
  it as a linear gradient overlay, not as part of the JPEG.
- H1 line pitch is 44 ref = 62 CSS, i.e. line-height ≈ 1.03 at 60 px. The build's two lines should
  break after "you have." at 1440; do not copy the image's break — the copy differs.
- The squiggle sits 2 ref below the H1's baseline, under the first two words of line 2, spanning
  39 % of that line's width. Reproduce as an inline SVG path (146×19 ref → 205×27 CSS), stroke
  3 ref (4 CSS), colour `#4E9B38`.
- The text column's max width is 561 CSS (paragraph) and 574 for the H1. Build: `max-w-[580px]`.
- The primary pill is 60 tall, fully rounded, forest fill, cream label, icon 20. The text link is
  16 px, underlined on hover, with a 16 px arrow.

### 4.3 Shelf card — ref x 53–839, y 475–806

| Element | Ref box | CSS box |
| --- | --- | --- |
| Card | x 53–839, y 475–806; 787×332 | x 75–1180, y 668–1135; 1105×467 |
| Left panel (map in the image) | x 55–393, y 476–806 | x 77–553, 476 wide |
| Right rows panel | x 394–839 | x 554–1180, 626 wide |
| Search field | x 72–322, y 492–529; 250×37 | x 101–453, y 692–744; 352×52 |
| Filter button | x 334–387, y 487–530; 53×43 | x 470–544, y 685–745; 74×60 |
| Row 1 / 2 / 3 | y 476–588 / 589–705 / 706–806 | 3 rows × 156 |
| Thumbnail | x 413–524, y 495–566; 111×70 | x 581–737, y 694–792; 156×98 |
| Row title | x 543, cap 499–510 | x 764, 22 px |
| Row meta line | x 543, y 518–535 | x 764, 18 px |
| Row action button | x 730–820, y 544–573; 90×29 | x 1027–1153, y 765–806; 127×41 |
| Margin note icon | x 863–909, y 560–594; 46×34 | x 1214–1278, y 788–835; 65×48 |
| Margin note text | x 865–997, y 606–679; 4 lines, pitch 21 | x 1217–1402, y 852–955, 4 lines |

- The card is 1105 wide; the margin note starts at 1217 (37 px after the card) and its longest
  line reaches 1402, 27 px past the container's right edge. **Clamp the note box to R = 1375** in
  the build (158 wide, 37 px gap); the copy wraps to four lines at 20 px either way.
- Card radius 24 (§7). Card border 1 px `#DCD9D0`, surface `#FCFBF7`.
- Left panel: in the image it is a map with pins, a search field and zoom controls. **Replace it**
  with a sage-tinted search and category panel; keep its size, its inset search field and its
  filter button position (§9).
- Rows: three equal 156 px rows separated by 1 px `#ECE9E0` rules. Each row: thumbnail, title,
  category, action. Padding 27 on both sides (measured 581-554 and 1180-1153).
- Thumbnails: in the image they are tool photographs. The app has no tool photographs; **replace**
  them with a category icon tile at the same 156×98 box, radius 12, fill `#EFEDE4`.
- The heart (top-right of each row, 18 ref) is removed: there is no favourite model.

### 4.4 How it works — ref 838–1084

| Element | Ref box | CSS box |
| --- | --- | --- |
| Eyebrow "HOW IT WORKS" | x 460–562, y 838–848 | centred, 16 px, tracking 0.14em |
| H2 | x 251–774, cap 866–887 | centred, 44 px |
| Icon circles | 51×51: x 77, 402, 726; y 912–962 | 72×72: x 75, 543, 1011 (normalised); y 1282–1353 |
| Step 1 title | x 80–279, cap 1001–1011 | x 75 (normalised), 22 px |
| Step 2 title | x 404–613 | x 543 |
| Step 3 title | x 730–931 | x 1011 |
| Step body | y 1018–1051, 2 lines, pitch 20 | 20 px / 28, 2 lines |
| Arrow 1 / 2 | x 339–348 / 663–672, y 968–981 | between columns, 24 px |

- The measured grid: three 250 ref columns with 74 ref gaps, 80 → 978. Normalise to the container:
  **three 364 px columns, two 104 px gaps, 75 → 1375.** The measured columns are 352 wide with
  104 px gaps and start at 112 / 568 / 1027 CSS; normalising gives 75 / 543 / 1011. The image's
  extra left inset is an artefact, not a design feature.
- Icon circle 72, fill `#E6F1CE`, stroke `#314B31`, glyph 32.
- Step title 22/28 semibold; body 20/28, colour `#3A3C36`.
- Arrows are decorative and sit at the vertical centre of the icon row, in the gaps. Hide them
  below 1024.

### 4.5 Why LendLoop — ref 1085–1290

| Element | Ref box | CSS box |
| --- | --- | --- |
| Band | full width, y 1085–1290 | y 1525–1815; 290 tall |
| Photo slot | x 0–535, y 1085–1290; 536×207 | x 0–752, y 1525–1815; 752×290 |
| Heading line 1 | x 590–885, cap 1109–1130 | x 830, 52 px |
| Heading line 2 | x 590–926, cap 1145–1166 | x 830 |
| Check rows | icons x 597–607; text x 627–952 | icons x 840; text x 882 |
| Check row pitch | 26.5 ref | 37 CSS |
| First row top | y 1197 | y 1684 |

- Band background `#F7F2EA`, full width, no radius.
- The photo is the full-bleed left half; its right edge is a hard edge (no fade).
- Content column x 830–1302 (472 wide), vertically centred (heading block 1557–1645, rows
  1684–1776). Build: `grid-cols-[52%_48%]`, content padded `pl-20 pr-[72px]`.
- Check icons: 24 px box, 15 px glyph (11 ref), stroke `#203B2D`; text 20/28 `#272A26`; gap 16.

### 4.6 CTA band — ref 1290–1474

| Element | Ref box | CSS box |
| --- | --- | --- |
| Panel | x 28–998, y 1312–1474; 970×163 | x 39–1403, y 1845–2073; 1364×228 |
| Heading | x 74–521, cap 1332–1353 | x 104–733, 44 px |
| Copy line 1 | x 76–522, y 1371–1384 | x 107–734, 20/28 |
| Copy line 2 | x 76–437, y 1390–1403 | x 107 |
| Button | x 75–260, y 1421–1457; 186×37 | x 105–366, y 1998–2049; 262×52 |
| Photo | x 600–996, y 1312–1474; 397×162 | x 844–1401, y 1845–2073; 557×228 |

- Panel radius 16, fill `#EBEEDF`, no border.
- Panel inner padding: left 65 (spec 64), top 25 (spec 24), bottom 17 (spec 16). The heading sits
  close to the top edge on purpose.
- Text column max 630 wide; the photo fills the right 41 % of the panel (557 of 1364) and is clipped
  by the panel's 16 px radius.
- Photo slot ratio 2.45:1. The 163 ref height is the panel height, so the photo is full-bleed
  top-to-bottom inside the panel.

### 4.7 Footer — ref 1475–1536

| Element | Ref box | CSS box |
| --- | --- | --- |
| Footer | full width, y 1475–1536 | y 2074–2160; 86 tall |
| Icon + wordmark | x 37–152, y 1500–1516 | x 52–214 |
| Tagline | x 201–435 | x 283–612 |
| Links "How it works / Explore tools / Why LendLoop" | x 594–848 | x 835–1192 |
| "Privacy" | x 897–931 | x 1261–1309 |
| "Terms" | x 959–987 | x 1348–1388 |

- Footer content band 37–987 ref = 950 → **52–1388**. The image's footer is 36 CSS wider than the
  main container; normalise it to the 1300 container (75–1375) so the page has one grid. The
  difference is invisible at a glance and keeps the build honest.
- Footer height 86, content vertically centred. No top border; the CTA panel's bottom edge is the
  only separation. Background `#FAF6F0` (same as canvas).
- Wordmark 25 px, tagline 16 px `#595957`, links 16 px `#3A3B3A`, a 1 px `#DCD9D0` vertical rule
  between the wordmark and the tagline at x 170 ref (239 CSS), 40 tall.

---

## 5. Type scale

### 5.1 Measured in the reference

Cap heights were measured on a capital letter, then divided by the face cap ratio (sans 0.727,
serif 0.70). "Build" is `ref × 1.40625`, snapped to the nearest step of the build scale in §5.2 —
which is why a few rows sit 1–2 px below the raw product (nav 20.3 → 18, eyebrow 17.4 → 16).

| Role | Reference sample | Cap (ref) | Font (ref) | Build px |
| --- | --- | --- | --- | --- |
| H1 | "Borrow" B | 30 | 42.9 | **60** |
| H2 large (why) | "Good" G | 26 | 37.1 | **52** |
| H2 (how, CTA) | "Lend"/"Have" | 22 | 31.4 | **44** |
| Card title | "Cordless" C | 12 | 16.5 | **22** |
| Step title | "Find" F | 11 | 15.1 | **22** |
| Lead | hero paragraph | x-height 9 | 16.0 | **22** |
| Body | step body "Browse" B | 11 | 15.1 | **20** |
| Nav | "How it works" H | 10.5 | 14.4 | **18** |
| Eyebrow | "HOW IT WORKS" H | 9 | 12.4 | **16** |
| Footer / meta | tagline "A" | 8 | 11.0 | **16** |
| Header wordmark | "LendLoop" L | 18 | 24.8 | **35** |
| Footer wordmark | "LendLoop" L | 13 | 17.9 | **25** |

Line heights measured from line pitch, not guessed:

| Role | Ref pitch | Build line-height |
| --- | --- | --- |
| H1 | 44 | 62 (1.03) |
| H2 large | 37 | 52 (1.00) |
| Lead | 23 | 32 (1.45) |
| Step body | 20 | 28 (1.40) |
| CTA copy | 19 | 28 (1.40) |
| Why rows | 26.5 (row pitch) | 37 row height |
| Card rows | 112 (row pitch) | 156 row height |

### 5.2 Build scale per breakpoint

One scale, four steps. `lg` and `xl` are the design; `sm`/`md` are the stacked translation.

| Token | < 640 | 640–1023 | 1024–1279 | ≥ 1280 |
| --- | --- | --- | --- | --- |
| `display-1` H1 | 38 / 40 | 46 / 48 | 54 / 56 | **60 / 62** |
| `display-2` why H | 32 / 34 | 38 / 40 | 46 / 48 | **52 / 52** |
| `display-3` section H | 30 / 34 | 34 / 38 | 40 / 44 | **44 / 50** |
| `title` card/step | 18 / 24 | 20 / 26 | 21 / 27 | **22 / 28** |
| `lead` | 17 / 26 | 18 / 28 | 20 / 30 | **22 / 32** |
| `body` | 16 / 24 | 17 / 26 | 18 / 28 | **20 / 28** |
| `ui` nav, buttons | 15 / 22 | 16 / 24 | 17 / 24 | **18 / 24** |
| `small` eyebrow, footer, chip | 13 / 18 | 14 / 20 | 15 / 20 | **16 / 20** |

Weight and tracking:

| Role | Weight | Tracking |
| --- | --- | --- |
| H1, display-2, display-3 | 700 Fraunces | -0.02em / -0.015em / -0.01em |
| Card + step titles | 600 | -0.01em |
| Lead + body | 400 | 0 |
| Nav + buttons | 500 | 0 |
| Eyebrow | 600 | +0.14em, uppercase |
| Footer | 400 | 0 |

Fonts: display = **Fraunces** (Google Fonts via `next/font`, weights 600 and 700, optical size
axis if available), body = the existing **Geist**. If Fraunces cannot be downloaded at build time,
record the substitute in the build result; do not silently fall back to a system serif. Fraunces'
`SOFT`/`WONK` axes are not needed; load the standard variable cut.

---

## 6. Palette

Sampled as medians over flat patches. Every value is used by at least one element in the build.

| Token | Hex | Sampled at | Used for |
| --- | --- | --- | --- |
| `canvas` | `#FAF6F0` | header 300,30; page 700,455 | page background, header, footer |
| `canvas-warm` | `#F7F2EA` | why band 900,1160 | why band |
| `surface` | `#FCFBF7` | card 600,720 | shelf card, search field |
| `panel` | `#EBEEDF` | CTA 300,1320 | CTA panel |
| `sage` | `#E6F1CE` | icon circle 85,930 | step icon circles, category tile |
| `forest` | `#0B3B25` | header CTA 900,28; hero pill 150,350; CTA button 150,1440 | all primary buttons |
| `forest-hover` | `#072D1C` | derived (forest −12 %) | hover state only |
| `ink` | `#08231B` | H1 ink median | display headings |
| `ink-soft` | `#272A26` | why rows | check-row text, note text |
| `body` | `#3A3C36` | step body median | body copy |
| `muted` | `#5A5C57` | footer tagline, card category | meta, secondary |
| `accent` | `#1B5625` | eyebrow median | eyebrows, small green labels |
| `squiggle` | `#4E9B38` | underline median | H1 underline only |
| `line` | `#DCD9D0` | card border 839,600 | card border, dividers, rules |
| `line-soft` | `#ECE9E0` | row divider | row separators |
| `chip-bg` | `#EFEDE4` | derived from sage desaturation | category chips |
| `cream-text` | `#F7F5F0` | hero pill label | text on forest |

Contrast checks the build must pass (WCAG AA, 4.5:1 for normal text; computed with the standard
relative-luminance formula):

- `ink` on `canvas`: 15.4:1 ✓
- `body` on `canvas`: 10.4:1 ✓
- `muted` on `canvas`: 6.3:1 ✓
- `cream-text` on `forest`: 11.6:1 ✓
- `accent` on `canvas`: 8.1:1 ✓
- `squiggle` on `canvas`: 3.2:1 — decorative only, never text.

No gradients except the hero's cream scrim and the photo itself. No pure black, no pure white.

---

## 7. Radii, borders, shadows

| Element | Radius (CSS) | Border | Shadow |
| --- | --- | --- | --- |
| Shelf card | 24 | 1 px `line` | `0 1px 2px rgb(11 35 25 / .05), 0 24px 48px -32px rgb(11 35 25 / .18)` |
| CTA panel | 16 | none | none |
| Search field | 12 | none | `0 1px 2px rgb(11 35 25 / .08)` |
| Filter button | 12 | 1 px `line` | none |
| Row thumbnail / category tile | 12 | none | none |
| Row action button | 10 | 1 px `line` | none |
| Category chip | 8 | none | none |
| Primary buttons | 999 (pill) | none | none |
| Icon circles | 999 | none | none |
| Photos | 0 (hero, why); clipped by panel (CTA) | none | none |

Reference measurements behind these: card corner arc spans ~20 ref horizontally and ~12
vertically (elliptical); panel arc ~10–13 ref; pill radius = half its 43 ref height.

---

## 8. Spacing rhythm

Base 4 px. The values below are rounded to whole pixels; only the optical gaps (4–6 px) sit off
the 8 px ladder.

| Space | CSS | Where measured |
| --- | --- | --- |
| Header height | 83 | 59 ref |
| Hero top padding (text) | 80 | header bottom → H1 line box |
| H1 → lead | 32 | 44 ref gap |
| Lead → buttons | 40 | 48 ref |
| Buttons → trust | 20 | 21 ref |
| Hero bottom padding | 32 | trust → band end |
| Shelf section top | 40 | hero → card (42 ref) |
| Card padding | 28 | 19 ref inset |
| Row height | 156 | 112 ref |
| Shelf section bottom | 44 | card → how (44 ref) |
| Eyebrow → H2 | 22 | 16 ref |
| H2 → icon row | 25 | 18 ref |
| Icon row → title | 50 | 37 ref |
| Title → body | 6 | 4 ref |
| How bottom | 46 | 33 ref |
| Why top | 32 | 23 ref |
| Why rows pitch | 37 | 26.5 ref |
| Why bottom | 39 | 28 ref |
| CTA band top | 30 | 21 ref |
| CTA panel padding | 24 top / 64 sides / 16 bottom | 18 / 46 / 17 ref |
| Footer height | 86 | 62 ref |
| Footer padding | 36 top / 28 bottom | 25 / 20 ref |

Container and gutters:

| Breakpoint | Page gutter | Content width |
| --- | --- | --- |
| < 640 | 20 | fluid |
| 640 | 32 | fluid |
| 1024 | 48 | 928 |
| ≥ 1280 | 70 | 1300 (max) |

The CTA panel is a second, wider container: page gutter 38 at ≥ 1280 (1364 wide), 24 at 768–1279,
16 below 768.

---

## 9. Section / content map

Every band of the image, what it becomes on the page, and what is kept versus replaced. Copy below
is the *intended* copy; K-552 may polish wording but not the meaning.

| # | Image band | Real page content | Keep | Replace |
| --- | --- | --- | --- | --- |
| 1 | Header: chain icon + "LendLoop", 3 nav links, dark "Get started" | Same wordmark; links "How it works", "Explore tools", "Why LendLoop" (anchors to `#how`, `#shelf`, `#why`); button → `/sign-up` | Layout, type, forest pill, 83 px height | Nothing; add real anchor hrefs. Static, not sticky. |
| 2 | Hero: serif H1, squiggle, 3-line lead, green pill + text link, shield line, right photo | H1 "Lend what you have. Borrow what you need."; lead from the app's real description; "Explore the shelf" (→ `#shelf`) + "List something to lend" (→ `/sign-in`); trust line "Only a tool's name and category are public." | Composition, photo slot, squiggle, both CTA styles | The image's H1 ("Borrow what you need. / Lend what you don't.") and its "nearby / community" wording; the photo's real names are not real users. |
| 3 | Shelf card: map + search, 3 tool rows (photo, name, category, distance, availability chip, heart, View tool), margin note | Card with a search field and a real category filter in place of the map; rows from the live Convex shelf (name + category), max 3 visible with a "See all tools" row or scroll; margin note "Only the tool's name and category are public." | Card shape, search field, filter button, row rhythm, margin note, thumbnail box | Map and pins, "0.8 km away", "Available this week", hearts, "View tool" → `/sign-in`, tool photographs (use category tiles), the lock icon becomes a shield |
| 4 | How it works: eyebrow, centred serif H2, 3 icon steps with arrows | "HOW IT WORKS" + "Lend and borrow in three simple steps."; steps "Find it on the shelf" → "Request the dates" → "Pick up and pass it back" | Band, grid, icon circles, arrows, type | "Find something nearby" wording; body copy to the real flow |
| 5 | Why band: left photo, serif heading, 3 check rows | "Good tools deserve more than one owner."; rows: "Save money on the things you only need occasionally." / "Clear the clutter and make better use of what you own." / "Share with the people in your circle." | Photo slot, two-line heading, check rows, warm band | "Help your neighbors and build a stronger community" (unverified claim); the photo is illustrative, not a customer |
| 6 | CTA: pale green panel, serif heading, 2-line copy, dark button, workbench photo | "Have something gathering dust?" + "That drill, ladder or pressure washer could be back at work. List it in a minute and lend it to someone in your circle." + "List your first tool" → `/sign-in` | Panel, inset photo, button | "useful to a neighbor nearby"; the image's button label |
| 7 | Footer: wordmark, tagline, 3 links, Privacy, Terms | Wordmark, "A shared shelf for your circle.", the three anchors + "Sign in"; Privacy and Terms link to the app's real pages if they exist, otherwise omit them | Layout, type, vertical rule | Anything that would need a page the app does not have. Do not ship a dead Privacy/Terms link. |

Content rules that come from the app, not the image:

- The shelf is public in exactly two fields: `name` and `category`. No owner, email, avatar or id
  may appear in the HTML (existing test covers the query, the build must not add fields).
- Search filters the real returned list client-side; the category filter is derived from the
  returned list (`Array.from(new Set(tools.map(t => t.category)))`), exactly like the dashboard's
  `ShelfBrowser`.
- A signed-in visitor is still redirected from `/` to `/dashboard` by `src/proxy.ts`.

---

## 10. Do-not-invent list

The image contains data the product does not have. None of it may appear, in copy, alt text,
aria-label, placeholder, seed data, screenshot or test fixture.

**Hard bans — the build fails if any string or element appears:**

1. Distances and geography: "km away", "0.8 km", "m away", "miles", "distance", "nearby",
   "nearest", "in your area", "around you", map pins, maps, coordinates, geolocation.
2. Availability: "Available this week", "Available now", "Available until", any availability date
   or date range ("Mar 15 – Mar 22"), any calendar badge that implies booked dates.
3. Social proof: testimonials, quotes attributed to people, star ratings, review counts,
   "trusted by", "join 1,000+", user counts, logos of partners, press mentions.
4. People as product data: owner names, initials, avatars, profile photos in shelf rows, "listed by".
5. Tool photographs presented as real listings. Row thumbnails are category icons. The only photos
   on the page are the three illustrative ones in §11.
6. Prices, fees, "free", deposits, insurance, guarantees, delivery, shipping.
7. Locations, addresses, neighbourhood names, city names, time zones in copy.
8. Invented categories. Use only the categories returned by the data — today: `Power tools`,
   `Ladders`, `Garden`, `Camping`, `Kitchen`, `Electronics`.
9. A fake app store badge, a fake browser chrome, a fake "as seen in" strip.
10. A fake sign-in count, waitlist, or "beta" label.

**Wording substitutions (image → product):**

| Image says | Page says |
| --- | --- |
| "nearby", "neighbors", "community" | "your circle" |
| "Borrow what you need. Lend what you don't." | "Lend what you have. Borrow what you need." |
| "A trusted, neighbor-to-neighbor tool sharing community." | "Only a tool's name and category are public." |
| "Exact pickup details are shared only after your request is approved." | same idea, no promise beyond the app: "Pickup details stay private until a request is approved." (verify against the flow before shipping) |
| "Find something nearby" | "Find it on the shelf" |
| "Available this week" | (removed) |
| "0.8 km away" | (removed) |

Anything not listed here but not true of the app is also banned. When in doubt, check the README
and `convex/` before writing the word.

---

## 11. Build contract

### 11.1 Design tokens

Ship as CSS custom properties in `src/app/globals.css` under `@theme inline`, then use them through
Tailwind arbitrary values or utility classes. Names are part of the contract.

```css
:root {
  --ll-canvas: #faf6f0;
  --ll-canvas-warm: #f7f2ea;
  --ll-surface: #fcfbf7;
  --ll-panel: #ebeedf;
  --ll-sage: #e6f1ce;
  --ll-forest: #0b3b25;
  --ll-forest-hover: #072d1c;
  --ll-ink: #08231b;
  --ll-ink-soft: #272a26;
  --ll-body: #3a3c36;
  --ll-muted: #5a5c57;
  --ll-accent: #1b5625;
  --ll-squiggle: #4e9b38;
  --ll-line: #dcd9d0;
  --ll-line-soft: #ece9e0;
  --ll-chip: #efede4;
  --ll-cream: #f7f5f0;

  /* Type — the xl values; the stacked breakpoints are in §5.2. */
  --ll-text-display-1: 60px;   --ll-leading-display-1: 62px;
  --ll-text-display-2: 52px;   --ll-leading-display-2: 52px;
  --ll-text-display-3: 44px;   --ll-leading-display-3: 50px;
  --ll-text-title: 22px;       --ll-leading-title: 28px;
  --ll-text-lead: 22px;        --ll-leading-lead: 32px;
  --ll-text-body: 20px;        --ll-leading-body: 28px;
  --ll-text-ui: 18px;          --ll-leading-ui: 24px;
  --ll-text-small: 16px;       --ll-leading-small: 20px;

  --ll-radius-card: 24px;
  --ll-radius-panel: 16px;
  --ll-radius-field: 12px;
  --ll-radius-thumb: 12px;
  --ll-radius-button: 10px;
  --ll-radius-chip: 8px;

  --ll-container: 1300px;
  --ll-gutter: 20px;
  --ll-gutter-lg: 70px;
  --ll-panel-inset: 38px;
}
```

### 11.2 Breakpoints

| Name | Min width | Layout |
| --- | --- | --- |
| base | 0 | Single column, 20 px gutter, nav links hidden (logo + CTA only), hero photo below the text, shelf left panel becomes a search + category bar above the rows, how steps stack, why photo above text, CTA panel 16 px inset |
| `sm` | 640 | 2-column how steps, shelf rows keep thumbnail + text, buttons may sit side by side |
| `md` | 768 | 2-column hero (text 55 / photo 45, photo bleeds right), how 3 columns, why 52/48 |
| `lg` | 1024 | Full desktop grid, 48 px gutter, nav links visible, map panel slot returns as the search/category panel |
| `xl` | 1280 | 1300 px container, 70 px gutter, full type scale, CTA panel 1364 |

No horizontal overflow at 390, 768 or 1440. Check `document.documentElement.scrollWidth <=
window.innerWidth`.

**390 layout, concrete values.** The image has no phone comp; this is the stacked translation of
the same tokens. These are the numbers the 390 check should be measured against.

| Element | Value at 390 |
| --- | --- |
| Page gutter | 20 (content 350) |
| Header | 64 tall; wordmark 20 px + icon 28; CTA 40 tall, 14 px label; nav links hidden |
| Hero | pad-top 40, pad-bottom 32; H1 38/40; lead 17/26; gap 24; buttons 52 tall, full width, stacked 12 apart; trust 14/22 |
| Hero photo | 390 wide × 267 (1.461:1), full-bleed, no radius, 24 below the trust line |
| Shelf card | radius 20; padding 20; search 48 tall; category chips 32 tall in a horizontal scroller; rows 112 tall, thumb 76×52, title 17, category 13, action 34 tall |
| How | icon 56, title 20, body 16/24, stacked with 40 between steps; arrows hidden |
| Why | photo 390×151 full-bleed; pad 32 top / 40 bottom; heading 32/34; rows 15/24, 32 between |
| CTA | panel inset 16 (358 wide), radius 16, padding 24; heading 30/34; copy 16/26; button 52 full width; photo 310×126 |
| Footer | pad 32/28; wordmark 20; tagline + links 14/22, stacked 12 apart |

### 11.3 Photographs

Owned by `docs/design/photo-brief.md`. Filenames are exact; the page imports them by name. Until
Brahim's files land, ship placeholders at these ratios (a flat `#EFEDE4` block with the ratio
label is enough — no stock photo, no generated substitute).

| Slot | File | Ratio | CSS at 1440 | 2× file | Position |
| --- | --- | --- | --- | --- | --- |
| Hero hand-over | `public/images/hero-handover.jpg` | 1.461:1 | 793×543 | 1586×1086 | absolute right, top 83, full-bleed to the right edge, left scrim |
| Why portrait | `public/images/why-circle.jpg` | 2.589:1 | 752×290 | 1508×582 | full-bleed left 52 % of the why band, `object-cover` |
| CTA workbench | `public/images/cta-workbench.jpg` | 2.451:1 | 557×228 | 1116×456 | right 41 % of the CTA panel, clipped by 16 px radius |

`object-cover object-center`, no stretching. Keep faces and key objects out of the outer 3 % of
each frame. Alt text describes the picture, never a customer: "A neighbour handing a drill over a
garden gate." etc.

### 11.4 Acceptance checks (fail the build if any is false)

1. Full-page height at 1440×900 is **2160 ± 40**; each band boundary in §3 is within ±8 px.
2. Container edges at 1440: main content **75 / 1375 ± 8**; CTA panel **39 / 1403 ± 8**.
3. Shelf card **75 → 1180**, margin note **1217 → 1375**, card height **467 ± 8**.
4. Computed colours match §6 exactly (browser-computed `rgb()` converted back to hex). At minimum:
   page background, card, CTA panel, both button fills, H1 colour, body colour.
5. Type sizes at 1440 match §5.2 `xl` column within ±1 px; line heights within ±2 px.
6. Radii match §7 within ±2 px.
7. The three image files exist at the exact names and ratios, and render at the §11.3 CSS sizes.
8. Zero occurrences in the rendered HTML and in the bundle of: `km away`, `nearby`, `Available this
   week`, `Available now`, `testimonial`, `trusted by`, `★`, `0.8`, `1.2 km`, `1.6 km`. (Case
   insensitive; check `curl` output, not just source.)
9. No `<img>` for a tool row; row thumbnails are inline SVG or a styled div.
10. No map embed: no `<map`, no `iframe` map, no `leaflet`, no `mapbox`, no
    `navigator.geolocation` anywhere in the landing route.
11. The public HTML contains no `owner`, `ownerId`, `email`, `displayName` or `avatar` field.
12. `/dashboard` still answers 307 to `/sign-in`; `/` still redirects a signed-in visitor.
13. `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.
14. No horizontal overflow at 390, 768, 1440.
15. Every link resolves: nav anchors, both hero CTAs, shelf rows, footer, sign-in.

### 11.5 Out of scope for the build

- `/dashboard`, `/sign-in`, `/sign-up` styling.
- Convex schema or functions.
- Auth, middleware, proxy.
- New pages (Privacy/Terms) — omit the links if no page exists.
- Any analytics, tracking, or third-party script.
- Any commit, push, deploy or Vercel action (K-553 owns the preview, K-554 the final local commit).

---

## 12. Risks and open points

1. **Type is large by design.** At 1440 the body is 20-22 px and the nav is 18 px. That is the
   image's proportion, not a bug. If Brahim prefers a tighter page, multiply the size tokens in
   §5.2 by 0.9 once, never per element.
2. **The image's how-it-works grid starts 27 ref px inside the container** (columns at 80, not 53).
   The spec normalises to the container. Do not reproduce the inset.
3. **The CTA panel's top padding is tight** (24 px). It reads as a deliberate sticker edge. If the
   heading wraps at 768-1023, raise it to 32 px there only.
4. **Privacy/Terms** exist in the image but not necessarily in the app. Check `src/app` before
   linking; a dead link fails check 15.
5. **Fraunces download**: the plan requires Fraunces via `next/font`. If the fetch fails in the
   build environment, the build must fail or record the substitute — a silent system serif is a
   regression, not a fallback.
6. **The shelf has 9 real tools**, 3 fit the card in the image. Decide the overflow treatment
   (scroll vs "See all") in K-552; the spec only fixes the row rhythm.

---

## Appendix A — raw measurements (ref px, 1024×1536)

Vertical:

```
header      0–58        hero photo 59–444        card 475–806
how         838–1084    why 1085–1290           cta panel 1312–1474
footer      1475–1536
H1 caps     128–159 / 172–203      squiggle 205–223
lead        235–307 (pitch 23)      buttons 328–370
trust       393–424
eyebrow     838–848    H2 864–894      icons 912–962
titles      999–1014   body 1018–1051
why H       1107–1170  rows 1197–1263 (pitch 26.5)
cta H       1330–1360  copy 1371–1403  button 1421–1457
footer      1500–1516
```

Horizontal:

```
container      53–978      cta panel 28–998     footer 37–987
card           53–839      map panel 55–393     rows 394–839
thumb          413–524     note 852–997
hero photo     460–1023    hero text 53–452
how columns    80 / 404 / 730, pitch 324, circles 51 px
why photo      0–535       why text 590–926
cta text       74–521       cta photo 600–996
```

Colours (median samples, flat patches):

```
header bg      #F9F5EF     page mid     #F9F8F3     why bg       #F7F2EA
card fill      #FCFBF7     CTA panel    #EBEEDF     icon circle  #E6F1CE
forest button  #093B25     header CTA   #0C4029     CTA button   #093A24
H1 ink         #062019     body ink     #333430     footer tag  #595957
eyebrow        #1B5625     squiggle     #539A3A     card border  #D8D7D2
```

## Appendix B — baseline capture log

```
npx next start -p 3111                      # existing build, .env.local, no source change
node .../screenshot/scripts/screenshot.js http://127.0.0.1:3111/ \
  docs/screenshots/baseline-1440.png --width 1440 --full-page --wait 3000
node .../screenshot/scripts/screenshot.js http://127.0.0.1:3111/ \
  docs/screenshots/baseline-390.png --mobile --full-page --wait 3000
```

- `baseline-1440.png`: 1440×1145, DPR 1.
- `baseline-390.png`: 1170×7107, DPR 3 (390 CSS px wide, 2369 CSS px tall).
- Both show 9 real tools and the plain zinc layout; both are signed out.
- The server was stopped after capture. No file under `src/`, `convex/`, `public/` or the root
  config was touched by this card.
