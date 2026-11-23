# Sharing a week plan: link, chats, copy, PDF

## What was there

"Twój tydzień" had one "Udostępnij plan" button: the native share sheet where
there is one, otherwise the link copied. The link (`?plan=12.345.678`) opened
the plan read-only with "Ułóż własny tydzień", which started from scratch.

## What a plan's owner can do now

"Udostępnij plan" opens a dialog (`PlanShareDialog.tsx`):

1. **Send the link** — WhatsApp, Telegram, e-mail; on a phone also Messenger
   (`fb-messenger://share`) and SMS; and "Więcej" (the system sheet: Signal,
   Instagram, whatever is installed). The message is the plan written out, so
   it reads in the chat without opening anything:

   ```
   Mój tydzień w Szczecinie — zobacz, gdzie idę:

   Pt 28 lis
   • 19:00 Koncert jazzowy (Filharmonia)
   • Wernisaż (BWA)

   Cały plan — możesz go skopiować i zmienić po swojemu:
   https://idznamiasto.pl/szczecin/moj-tydzien/?plan=…
   ```

   Messenger and SMS are phone-only: Messenger has no web intent without a
   registered Facebook app id, and `sms:` does nothing on most desktops. On a
   desktop the link box and "Kopiuj link" cover them.
2. **Copy the link** — a read-only field (selectable by hand when the
   clipboard is refused) and a button.
3. **The plan as a PDF** — A4, the site's fonts (Figtree, Bricolage
   Grotesque), every event title a link to its page, the plan's own link at
   the end, page numbers. Real text, Polish letters intact.

## What a recipient can do now

The shared view leads with **"Skopiuj do mojego planu"**: the events still
ahead become the recipient's own "Twój tydzień" — one decided slot per event,
at its time of day (`planFromEvents`) — and the planner opens with "Plan
skopiowany". A recipient who already has choices is asked before they are
replaced. Also: "Dodaj do kalendarza" (all events, one .ics) and "Wyślij
dalej" (the same dialog).

A copied plan can hold events the planner would not have proposed (a gym
class while "Aktywnie" is off, a concert since sold out). The planner reads
chosen events missing from its candidate list by id, so a choice is never
dropped because the draw would not offer it.

## Decisions

- **PDF in the browser, with pdf-lib + fontkit.** The site is static; there is
  no server to render on. The 14 standard PDF fonts are WinAnsi and have no
  ą ć ę ł ń ś ź ż, so a real font must be embedded, which in pdf-lib means
  fontkit. The fonts are static instances of the site's variable fonts,
  subset to Latin + Latin Extended-A (25–50 KB each, `public/fonts/pdf/`).
- **Made on demand, not on open.** pdf-lib + fontkit is ~1.1 MB, ~500 KB
  gzipped (fontkit's Unicode tables compress poorly). It is a separate chunk
  loaded only when someone asks for a PDF. On a desktop, "Pobierz PDF" makes
  and saves it in one click. Where the share sheet takes files (phones), it is
  "Przygotuj PDF" then "Wyślij PDF": iOS attaches a file to `navigator.share`
  only inside the tap itself, and making the PDF outlasts it.
- **Print stylesheet instead?** Rejected: "Save as PDF" from the print dialog
  is four steps on a phone, and the person asked for a file to send.
- **The link format is unchanged** (`?plan=` with event ids), so every link
  already sent keeps working. Copying rebuilds days and times of day from the
  events themselves.

## Not done

- A link preview specific to the plan: the page is static, so WhatsApp and
  Messenger show the generic "Twój tydzień" card.
- A QR code in the PDF for printed copies.
