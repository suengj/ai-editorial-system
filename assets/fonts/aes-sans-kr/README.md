# AES Sans KR (bundled font)

Subset of Pretendard 1.3.9 (https://github.com/orioncactus/pretendard), SIL OFL 1.1 (see LICENSE-OFL.txt).
Pretendard declares a Reserved Font Name, so the modified (subset) fonts are renamed "AES Sans KR".
Weights: 400, 600, 800, 900. Coverage: ASCII, KS X 1001 Hangul (2350 syllables), Jamo, common punctuation/symbols.
Characters outside the subset raise FONT_FALLBACK (never silently substituted). Rebuild from the upstream release with fontTools.subset.
# R4 Noto Serif KR headline face

The R4 prediction-market carousel uses **Noto Serif KR for headlines** and the
AES Sans KR bundle for body copy. The licensed Noto Serif KR subset is bundled
at `../noto-serif-kr-pmc/NotoSerifKR-PMC.ttf` (1,524,056 bytes). It is below the
repository's 2 MiB binary limit; the 512 KiB limit applies to image assets.

The production resolver registers the bundled face and verifies its manifest,
font digest, license digest, and required glyph coverage. No external font path
is needed. A missing headline glyph raises `FONT_FALLBACK`; it is never
silently substituted. The adjacent `LICENSE` file is SIL OFL 1.1.
