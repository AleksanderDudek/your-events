# Events near a point — design

Date: 2026-10-21
Status: designed while the owner was away ("plan it out and then finish on your
own — pick recommended"); implemented under the assumptions recorded here, to be
reviewed on return.

## Problem

The list can be narrowed by what, when and how much — never by *where*. A
visitor standing on Rynek who wants "something within walking distance tonight"
has to read venue names and guess.

The request: show only events within a chosen distance — **at least 500 m, at
most 5 km** — of a point. The point comes either from an **address the visitor
enters / drops on a map**, or from **the device's current location**.

## What the data allows

Measured against the dev schema on 2026-10-21:

| | Szczecin | Wrocław |
| --- | --- | --- |
| Events | 879 | 1165 |
| …with coordinates | 850 | 1139 |
| …inside a 5 km box around the centre | 712 | 988 |

`lat`/`lng` are plain `double precision` columns on `events`. Neither PostGIS
nor `earthdistance` is installed, there is no spatial index, and the schema is
owned by the scraper repository (its numbered migrations 010–019 are what both
projects and both schemas run).

## Decisions

### Where the distance is computed: the browser, behind a box the database cuts

**Recommended and chosen: a bounding box in PostgREST, the exact circle in the
browser.** The box is four plain column comparisons
(`lat=gte…&lat=lte…&lng=gte…&lng=lte…`), so it works today, against both
schemas of both projects, with no migration. The circle is the haversine
distance from the point; a box is 4/π ≈ 1.27× the circle's area, so the
browser discards roughly a fifth of what the box lets through.

Rejected for now: a `nearby_events(lat, lng, radius)` RPC on PostGIS
(`ST_DWithin` on `geography`, GiST index). It is the textbook answer and the
right one at a larger scale, but here it means installing an extension and
creating a function in 2 projects × 2 schemas, in a schema another repository
migrates, on production, with the owner away. At ~1000 rows per city the
database gains nothing measurable from it. If cities grow by an order of
magnitude, that RPC belongs in the scraper's migrations; the client side of
this design then swaps its box query for an `rpc()` call and keeps everything
else.

### How the list pages: scan the ids, then fetch the page

A filter that runs in the browser cannot use the database's `range` or
`count` — the database does not know which rows the circle keeps. The existing
`freeOnly` filter already faces this, and answers it by fetching every matching
row in full and slicing in the browser.

That answer does not survive a radius. Wrocław's 5 km box today:

| What is fetched | Raw | Gzipped | Time |
| --- | --- | --- | --- |
| every row in the box, `select=*` | 2.02 MB | 505 KB | 0.84 s |
| `id,lat,lng,is_free,price,price_label` | 94 KB | 7.3 KB | 0.22 s |

It is also 12 rows short of PostgREST's 1000-row cap, which silently truncates.

So a client-filtered list query becomes two steps:

1. **Scan** — the same query the list always builds (search, categories, dates,
   weekdays, hours, ordering) plus the box, selecting only the six columns the
   client filters read, paged through in 1000-row chunks so the cap can never
   truncate it. The browser keeps the rows inside the circle (and, when
   `freeOnly` is on, the free ones). The survivors' count is `total`; their
   order is the list's order.
2. **Hydrate** — `select=*&id=in.(…)` for the ids of the requested page only,
   re-ordered to the scan's order.

`freeOnly` goes through the same two steps. It is the same problem, and two
different answers to it in one function would be one too many; as a side
effect `freeOnly` stops downloading every full row and stops being silently cut
at 1000.

The map does not page. It keeps its single query (`select=*`, coordinates not
null, `limit 1000`), gains the box, and filters the circle in the browser — the
box is never larger than the whole-city query the map already makes.

### Sorting by distance

With a point set, the sort control offers **Odległość / Distance**. It is not
the default — the list's default stays date order, because "soonest" is still
the first question for events — but it is one click away. Ties (one venue,
many events) fall back to date order, ascending, whatever the direction.
Distance ordering happens in the scan step, so paging stays correct. A
`sort=distance` URL without a point reads as the default sort.

### Where the point comes from

Three ways, all in a new **W pobliżu / Nearby** section of the filter panel:

- **Use my location** — the Geolocation API, only ever on that button press
  (never on page load). High accuracy, 12 s timeout, a fix up to a minute old
  is fine. Denied, unavailable, timed out and unsupported each get their own
  message, and each message names the other two ways in.
- **Address search** — an autocomplete over [Photon](https://photon.komoot.io)
  (komoot's OpenStreetMap geocoder, built for search-as-you-type; Nominatim's
  usage policy forbids client-side autocomplete). Debounced 400 ms, three
  characters minimum, five suggestions, restricted to a 25 km box around the
  current city and biased to its centre, cached by React Query, cancelled when
  superseded. Interface language maps to Photon's `lang` (`default` for Polish
  — Photon has no `pl` — `en` for English).
- **Pick on the map** — a dialog with a map: a tap drops the pin, the pin drags,
  the radius circle follows, Apply commits. Full screen on phones. This is the
  way in that needs no third party and no permission, so it is the fallback the
  error messages point to.

Every way in ends at the same place: a point plus a radius in the URL.

### The radius

A slider from **500 m to 5 km in 500 m steps**, default 1 km. It writes the URL
when released, not on every pixel of a drag. It can be set before a point
exists — the chosen radius waits and is used when the point arrives.

### URL contract

State lives in the query string, as every other filter's does.

| Param | Value | Notes |
| --- | --- | --- |
| `near` | `lat,lng` | decimal degrees, written with at most 4 decimals (~11 m) |
| `radius` | metres | clamped to 500–5000; defaults to 1000; written whenever `near` is |
| `nearLabel` | text | optional, ≤ 100 characters — what the point is called |

`near` that is malformed or out of range means no proximity filter at all, and
`radius`/`nearLabel` are then ignored — the same way the hour range is ignored
without a date.

### Naming the point

- An address carries its own label (`Świdnicka 12, Wrocław`).
- A location fix carries none. The tab remembers its last fix
  (`sessionStorage`), and a point equal to it is shown as **Twoja lokalizacja /
  Your location**; any other unlabelled point — a map pick, or someone else's
  location arriving by a shared link — is **Wybrany punkt / Selected point**.
  A shared link therefore never tells its recipient that the sender's position
  is theirs.

### What the visitor sees

- The panel section: the current point and how it is named, Change and Remove,
  the radius slider, and a note when the point lies more than 25 km from the
  city centre ("far from the selected city — there may be no results").
- An active-filter chip — `W promieniu 1 km: Świdnicka 12` — removable like the
  others, and counted in the filter badge.
- Each card and row shows its distance from the point beside the venue
  (`850 m`, `1,2 km`), formatted for the interface language.
- The map draws the circle and a marker at the point, and frames the circle.

### Presets

A saved filter keeps its point, radius and label: "near the office, 1 km" is
exactly what a preset is for. It is stored as a fixed point. (A preset that
re-resolves "where I am now" on every open would be the location twin of the
relative date windows — deliberately left out until someone asks for it.) The
tile summary names it. Moving a preset to another city in the editor drops the
point, which would mean nothing there.

## Privacy

- Location is requested only on the button press.
- A fix is **rounded to 3 decimals (~100 m) before it goes anywhere** — the URL,
  the query, the preset. Filtering to a 500 m minimum loses nothing at that
  precision, and a shared link or a recorded session URL (Clarity records page
  addresses when consented) does not pinpoint a home.
- The database receives the search box, as any query parameter; nothing new is
  stored.
- Typed addresses go to Photon (Komoot GmbH). The privacy page gains a
  *Lokalizacja / Location* section saying all of the above, and Komoot joins
  the list of processors.

## Error handling

| Failure | Behaviour |
| --- | --- |
| Permission denied / unavailable / timeout / unsupported | Inline message under the button, naming the alternatives |
| Photon down or slow | "Address search is unavailable right now" in the dropdown; the other two ways still work |
| Scan or hydrate query fails | The list's existing error state and retry |
| A row deleted between scan and hydrate | That page shows one fewer card until the next refetch |

## Testing

- Unit: geometry (distance, box, clamping, formatting); URL parse/serialise
  round-trips and rejections; query keys (label is not part of the key);
  `eventsApi` (box clauses, scan chunking, circle and free filtering, distance
  order, hydrate order, map); geocoder request and mapping; presets round-trip
  and repair; the panel section's three ways in and its error messages; the
  chip; the sort option; the privacy section.
- End to end (Playwright, Wrocław): location via a granted, emulated position;
  address search against a stubbed Photon; a deep link with `near` and
  `radius`; the circle on the map.

## Out of scope

- A server-side RPC (see above) and a spatial index.
- Reverse-geocoding a map pick or a fix into an address label.
- Switching city when the point lies in another one.
- A "near me, wherever I am" preset.
