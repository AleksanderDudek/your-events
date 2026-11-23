# Fonts for the plan PDF

Read by `src/lib/planPdf.ts` when a visitor exports "Twój tydzień" as a PDF.
The site's own typefaces, so the PDF looks like the page:

| File | From | Instance |
| --- | --- | --- |
| `Figtree-Regular.ttf` | Figtree (google/fonts `ofl/figtree`) | wght 400 |
| `Figtree-Bold.ttf` | Figtree | wght 700 |
| `BricolageGrotesque-ExtraBold.ttf` | Bricolage Grotesque (google/fonts `ofl/bricolagegrotesque`) | wght 800, opsz 24, wdth 100 |

Static instances of the variable fonts, subset to Basic Latin, Latin-1,
Latin Extended-A (all Polish letters), general punctuation, € and arrows —
~25–50 KB each instead of 60–400 KB. Made with fontTools:

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
# instantiateVariableFont(TTFont(src), {'wght': 400}).save('tmp.ttf'), then
# subset with unicodes "U+0020-007E,U+00A0-00FF,U+0100-017F,U+2010-2027,
# U+2030-203A,U+20AC,U+2122,U+2190-2193,U+2212", layout_features ['kern'],
# hinting off.
```

Both are under the SIL Open Font License 1.1 (OFL-*.txt here), which allows
subsetting and redistribution; neither declares a Reserved Font Name.
