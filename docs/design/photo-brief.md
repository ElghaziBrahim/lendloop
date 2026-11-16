# Photo brief: LendLoop landing page

Three photos for the page rebuilt from `docs/design-reference.jpg`. Each prompt is self-contained: paste one block per image, generate at the stated size, save it to the stated path. Until the files arrive, the build ships placeholders at the same three ratios.

**The photos are illustrative.** They show a plausible lending circle, not a real one. Nobody in them is a LendLoop user, and no photo may be captioned, alt-texted or described as a real customer, listing or location.

## Measured slots

Slots were measured with PIL on the 1024×1536 reference. The hero photo starts under the header and runs to the right edge; the why photo is the full-bleed left half of its band; the CTA photo fills the right of the green panel. Ratios are scale-free. Sizes assume the reference scales to the 1440 build (×1.40625) at a 2× display, so the files stay sharp at the widest layout. Larger is safe, smaller is not. If the measured spec lands on a different build width, keep the ratios and scale the pixel sizes with it.

| Photo | Slot in the reference | Ratio | CSS at 1440 | File at 2× | Save as |
| --- | --- | --- | --- | --- | --- |
| Hero hand-over | x 460–1023, y 59–444: 564×386 | 1.461:1 | 793×543 | 1586×1086 | `public/images/hero-handover.jpg` |
| Why portrait | x 0–535, y 1084–1290: 536×207 | 2.589:1 | 754×291 | 1508×582 | `public/images/why-circle.jpg` |
| CTA workbench | x 600–996, y 1312–1474: 397×162 | 2.451:1 | 558×228 | 1116×456 | `public/images/cta-workbench.jpg` |

The hero's left edge and the CTA's left edge are soft fades, into the cream page and into the green panel, so those two widths carry about ±5 reference px. The layout covers both edges anyway.

## Shared direction

One world across all three: late-afternoon sun, muted olive and clay against cream and sage, 40–50mm natural perspective, Kodak Portra 400 colour with fine grain and a filmic highlight roll-off. Green stays deep and desaturated, never lime. No hard flash, no blue hour, no studio backdrop, no glow or HDR.

Anchors read off the reference: cream `#FAF5EF`, warm band `#F7F3EA`, sage panel `#E4EDDA`, forest action `#083923`, olive drab `#484634`, dry grass `#A18F5B`, clay `#BC9471`, terracotta `#B4784F`, oatmeal `#D9CFBE`.

## 1. Hero hand-over

`public/images/hero-handover.jpg` · 1.46:1 · 1586×1086 px. The man hands a drill over a garden gate; the woman receives it. Both faces readable.

```
Subject: two neighbours in their thirties at the gate of a small front garden, mid hand-over of a cordless drill. The man on the left holds the drill out by its handle; the woman on the right takes it with both hands. They look at each other, one smiling, one mid-sentence. He wears an olive canvas field jacket over a cream T-shirt. She wears a chunky oatmeal knit cardigan. Behind them: a clipped hedge, a pale stucco house wall, a black metal gate.

Framing: medium shot, mid-thigh up, camera at eye level. The pair fills the right two-thirds of the frame. The man sits left of the woman, her shoulder slightly cropped at the right edge. Keep the left 15% of the frame plain, hedge or wall only, because a cream gradient scrim covers it in the layout. Hands and drill at chest height, unobstructed, with headroom above.

Light: late afternoon, low warm sun from behind-left. Soft rim light on hair and shoulders, open shade across both faces, honey highlights in the foliage, gentle long shadows. No flash, no overhead light.

Palette: warm cream #FAF5EF, olive drab #484634, oatmeal #D9CFBE, clay #BC9471, deep foliage green #203B2D, forest green #083923. The drill's muted yellow is the only saturated accent.

Lens and quality: 50mm full-frame, f/2.8, 1/250s, ISO 400, natural light. The background falls to soft bokeh. Kodak Portra 400 colour, fine grain, filmic highlight roll-off, documentary realism, unretouched skin texture.

Negative: no text, letters, numbers, signs, logos, brand marks or watermarks. No extra limbs, extra hands, extra fingers, fused or deformed hands. No duplicated people. No plastic or airbrushed skin. No HDR, heavy vignette or lens flare. No cartoon, illustration, 3D render or stock-photo gloss. No border or frame.

Aspect ratio: 1.46:1 (564:386). Fill the frame; do not letterbox.

Target pixel size: 1586 x 1086.

Save as: public/images/hero-handover.jpg
```

## 2. Why portrait

`public/images/why-circle.jpg` · 2.59:1 · 1508×582 px. A wide letterbox portrait of the kind of person who lends. She looks out of frame, not at the camera.

```
Subject: a woman in her mid-thirties in a small back garden, kneeling behind a low herb bed, looking up and off-camera to the right with a quiet half-smile. She wears an olive canvas work jacket over a charcoal tee, hair loosely tied up with strands loose, small gold hoops. Behind her: white cosmos and marigolds, a weathered wooden fence, bright sunlit foliage.

Framing: environmental portrait in a wide letterbox. Her head sits in the upper third, her shoulders and chest fill the lower edge, and the crop cuts at mid-chest. She is centred and turned three-quarters toward camera-right, with the garden falling away on both sides. Camera at her eye level.

Light: dappled late-afternoon sun through leaves. Warm rim light on her hair and cheek, soft shade across the face, background in bright bokeh with visible sun spots.

Palette: olive #404526, dry grass #A18F5B, bark #896E49, straw #C9B683, deep green #35331D, cream #FAF5EF.

Lens and quality: 50mm full-frame, f/2, 1/500s, ISO 200, natural light. Shallow depth of field, fence and flowers soft. Kodak Portra 400 colour, fine grain, filmic highlight roll-off, unretouched skin and hair.

Negative: no text, letters, signs, logos, brand marks or watermarks. No extra limbs, extra hands, extra fingers or deformed hands; keep her hands out of frame. No duplicated people. No plastic or airbrushed skin. No HDR, heavy vignette or lens flare. No cartoon, illustration, 3D render or stock-photo gloss. No border or frame.

Aspect ratio: 2.59:1 (536:207). Fill the frame; do not letterbox.

Target pixel size: 1508 x 582.

Save as: public/images/why-circle.jpg
```

## 3. CTA workbench

`public/images/cta-workbench.jpg` · 2.45:1 · 1116×456 px. A bench of tools waiting to be borrowed, no people. It sits at the right of the pale green panel.

```
Subject: a tidy garden shed workbench, straight on. A terracotta pot with a trailing pothos sits at the left, a dark green steel toolbox with a brass latch in the centre, a steel rake leans against a pegboard at the right. A few hand tools, screwdrivers and a wooden mallet, rest on a lower shelf. Everything is used but cared for, with no dust layer.

Framing: straight-on still life. The bench top runs across the lower third, pegboard and wall behind, objects spread from left to right. The plant is half out of frame at the left edge, the rake half out of frame at the right edge. Camera just above bench height, parallel to the wall.

Light: warm afternoon sun from the upper left, as if through an unseen window. A soft rectangular shadow falls on the wall, with gentle falloff to the right. No flash.

Palette: pale sage #E4EDDA, terracotta #B4784F, deep green #203B2D, blonde wood #A27243, chalk #E6E2CE, forest green #083923.

Lens and quality: 35mm full-frame, f/4, 1/125s, ISO 400, natural light. Sharp centre, softly falling corners, subtle grain, Kodak Portra 400 colour, filmic highlight roll-off.

Negative: no text, labels, numbers, logos, brand names or watermarks on the toolbox or anywhere else. No people, hands, arms or extra limbs. No clutter. No HDR, heavy vignette or lens flare. No cartoon, illustration, 3D render or stock-photo gloss. No border or frame.

Aspect ratio: 2.45:1 (397:162). Fill the frame; do not letterbox.

Target pixel size: 1116 x 456.

Save as: public/images/cta-workbench.jpg
```

## When the files land

Save sRGB JPEG at quality 82, under 500 KB each, in a new `public/images/` directory. Keep the exact filenames above; the page imports them by name.

Match the target pixel size. If a generator only offers preset sizes, generate the tallest preset it allows and let the layout's `object-cover` trim the long edge. Never stretch an image to fit.

Keep faces and key objects out of the outer 3% of each frame. The hero's left edge is covered by a cream scrim, and the CTA photo's right corners are clipped by the panel radius.
