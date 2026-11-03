# Sharing — recommend the app, share an event — design

Date: 2026-11-03
Status: designed while the owner was away ("analyze, use best practices, pick
recommended, plan it out and finish on your own"); implemented under the
assumptions recorded here, to be reviewed on return.

## The request

> I want to have social media / etc. share button and banner that would allow
> to instantly provide information on how to reach idznamiasto.pl:
>
> - for posts it will contain a social media text with hashtags (best to match
>   130 characters limit) with clear benefit information for the viewer and
>   link to website idznamiasto.pl also with the short video
> - for shorts / stories accordingly :)
>
> use this video as reference to be shared:
> `~/Projects/idznamiasto-promo/out/idznamiasto-promo.mp4`
>
> if something is wrong use fallback image

Added while the work was under way:

> additionally I want to add share button PER event but make it a SHARE EVENT
> explicitly. so this is an extra button that can be used to share it.

## Decisions

### 1. Two features, two names

- **"Poleć znajomym"** recommends the app: a dialog with a post and a story
  format, each with its video, caption and link.
- **"Udostępnij wydarzenie"** shares one event by its permalink. It lives on
  the event page only, under "Dodaj do kalendarza" and styled as its twin.
  Not on the cards: a card is one big link, and a button inside a link is
  invalid HTML and a mis-tap waiting to happen.

### 2. The media

The source is 1080×1920, 39.5 s, 24.6 MB, and its last scene names
`idznamiasto.pl/szczecin`. Shipped in `public/promo/`:

| File | What | Size |
| --- | --- | --- |
| `idznamiasto-story.mp4` | the film, re-encoded (H.264 CRF 27, AAC 128k, faststart) | 6.0 MB |
| `idznamiasto-post.mp4` | the same on a 4:5 canvas (1080×1350), blurred film filling the sides | 4.0 MB |
| `idznamiasto-story.jpg`, `idznamiasto-post.jpg` | fallback stills | ~0.1 MB |
| `og.jpg` | 1200×630 link preview | 40 kB |
| `poster-*.jpg` | the film's hook frame, shown before playback | ~50 kB |

4:5 for posts because a 9:16 video in a feed is cropped to 4:5 by Instagram
and Facebook anyway — better that we choose what goes, and the blur pad keeps
the whole frame. 9:16 is native for stories, Reels, TikTok and Shorts.

The stills are **not** frames of the film: they are rendered by
`scripts/render-promo-images.mjs` in the film's outro style but with the bare
domain, because the og:image is used for every page in every city and the
fallback is what someone sees with no video at all — "idznamiasto.pl/szczecin"
would be wrong for Wrocław. The video itself stays Szczecin-branded; it is the
owner's cut.

### 3. Captions: benefit, link, hashtags, ≤ 130

| | Polish | English |
| --- | --- | --- |
| Post | Co dziś robimy? Wszystkie wydarzenia z miasta w jednym miejscu, bez konta 👉 idznamiasto.pl #idznamiasto #Szczecin #wydarzenia (125) | Nothing to do tonight? Every event in town in one place, no sign-up 👉 idznamiasto.pl … #events |
| Story / Short | Coś się dzieje, a Ty nie wiesz? Sprawdź idznamiasto.pl 🎉 #idznamiasto #Szczecin #wydarzenia (91) | Something's on and you don't know? Check idznamiasto.pl 🎉 … |

- Counted in code points (an emoji is one character).
- The city tag comes from the current city (`#ZielonaGóra`, diacritics kept —
  `#Wrocław` and `#Wroclaw` are different tags). When a long name would push
  past 130, tags are dropped from the end; `#idznamiasto` goes last. A unit
  test checks every configured city × format × locale.
- The domain is written bare: every platform links it, and it reads as an
  address people can remember, which is the point of "how to reach".
- Stories have no caption under them, so the story tab says to add a "Link"
  sticker; the caption is still useful for Reels/TikTok/Shorts descriptions.

### 4. How sharing works

One big button: the native share sheet (`navigator.share`), because on a phone
that is where Instagram, TikTok, Messenger and WhatsApp are — the web has no
other way to put a video into those apps.

- **The file is fetched when the dialog opens**, not on the tap: Safari opens
  the sheet only while the tap's user activation is fresh, and a multi-MB
  download in between uses it up. The button shows "Przygotowuję film… 45%"
  until the File is in hand. Results are cached per format for the page's life.
- **Fallback chain** (the owner's "if something is wrong use fallback image"):
  video → still image when the video stalls (10 s without bytes — a slow but
  steady connection still gets it), fails, or `canShare` refuses it → caption
  as text when neither file can be had. The image fallback is announced
  ("Filmu nie udało się przygotować…") and the button says "z grafiką".
- **Data Saver** on: straight to the image, no notice.
- **Browsers that cannot share files** (most desktops) never download the
  video. They get "Kopiuj opis" as the main button, both downloads, and web
  links: WhatsApp, Facebook, X, LinkedIn, e-mail.
- **The caption is copied to the clipboard along with a file share**, and a
  toast says so: Instagram and TikTok drop text that arrives with a file.
- Web links that take only a URL (Facebook, LinkedIn) get
  `utm_source=<platform>&utm_medium=social&utm_campaign=polec`; the visible
  caption never carries UTM noise.
- The link is always `https://idznamiasto.pl/`, also from the dev site: a
  recommendation should send people to the real app.

**Share event**: with a sheet, one tap shares `{title, text, url}` where text
is "Name · date, time · venue" and url is the page's own address (minus query
and hash — correct on dev, production and the client-fallback route without
base-path arithmetic). Without a sheet, or if it fails, the same button opens
a menu: Kopiuj link, WhatsApp, Facebook, X, E-mail.

### 5. Where the entry points are

- **Header**: a share icon, on every screen size. On a phone it sits beside
  the burger — the earlier rule "nothing but the wordmark and the menu button"
  existed because four controls did not fit a 390 px row; two icons do (checked
  at 360 px), and on a phone this is the button that opens the share sheet.
- **Home banner** between the tiles and the map: thumbnail, "Ktoś znowu pyta
  „co dziś robimy?”", one CTA, ×. In the page flow rather than floating — the
  cookie banner and the welcome sheet already take turns over the first
  screen. Dismissal is remembered (`go-to-city.share-banner`), and the banner
  renders only after hydration so a returning visitor's static HTML never
  carries it.
- **Footer**: "Poleć znajomym" in the community column.
- **Rozwijaj z nami**: a third card next to Discord and the form — sending the
  app to a friend is the cheapest way to help it grow.

### 6. Link previews (og:image) — found on the way

No page had an og:image, so every shared link — including the ones this
feature produces — previewed as a bare URL. Now every page carries
`/promo/og.jpg` (absolute, from `SITE_URL`) plus `twitter:card =
summary_large_image`. Event pages keep their poster, but only when it is a real
`http(s)` address: some events carry a generated `data:image/svg+xml`
placeholder, which no crawler can fetch. Pages that set their own `openGraph`
repeat the image, because Next replaces a parent's `openGraph` rather than
merging it.

### 7. Analytics

Clarity custom events (`window.clarity('event', …)`, typed as a second
overload): `share_open_<entry>`, `share_native_<format>_<video|image|text>`,
`share_copy_<format>`, `share_download_<format>_<kind>`, `share_link_<target>`,
`share_banner_dismiss`, `share_event_native|copy|link_<target>`. Bounded names,
no free text. Clarity's own consent handling applies.

## After review

An independent review found no blocker; these were fixed:

- **The video could download twice.** On the first render after opening, the
  prefetch had not yet reported, and the preview mounted a `<video>` on the
  file's URL. The poster now shows until the prefetch settles.
- **Without a Content-Length the stall timer was a total timer.** The download
  is now read chunk by chunk either way, each chunk re-arming it.
- **A download cancelled at the last moment left an object URL behind**, and
  the image fetch was not cancelled at all. The URL is made only for a kept
  result; the image has its own controller, aborted on close.
- **A toast cut short by closing came back on the next open**, and one failed
  video load pinned the image preview for the session. Both reset on close.

Considered and left: retrying a failed file share as text (the first
`share()` call uses up the tap's user activation, so a retry would be
refused), and copying the caption only after a successful share (Instagram
needs it on the clipboard before the sheet opens).

## Not done

- **Attaching the event poster to an event share.** Posters are on other
  origins without CORS, so they cannot be fetched into a File; the og:image
  carries the picture in the link preview instead.
- **Per-city videos.** The film is Szczecin's. A Wrocław cut would need the
  promo project to record Wrocław; `PROMO_MEDIA` could then be keyed by city.
- **A shorter (≈15 s) story cut.** 39.5 s fits every story format today (IG
  splits at 60 s). Worth trying if completion rates are poor.
- **Instagram/TikTok deep links.** Neither offers a web intent for posting a
  video; the native sheet is the only route, which is why it is the main button.

## Testing

- Unit: caption length for every city × format × locale, hashtag building,
  tag dropping, link building; the Web Share / clipboard wrappers; the media
  hook's whole fallback chain (video, failed video, refused video, Data Saver,
  nothing, caching); the dialog (both formats, copy, native share with the
  file and the clipboard copy, image fallback notice, failed sheet, axe); the
  banner (open, dismiss persists, axe); the event button (sheet payload, menu
  fallback, cancel, axe).
- e2e (`e2e/share.spec.ts`, with a recording stand-in for `navigator.share`):
  the banner opens the dialog with both captions; the real video file reaches
  the sheet; a blocked video falls back to the image; dismissal survives a
  reload; og:image is present; an event share carries the page's own address;
  the no-sheet menu.
- Checked by eye at 1280 px and 360 px (screenshots), light theme.
