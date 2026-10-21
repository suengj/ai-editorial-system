# AES Sans KR (bundled font)

Subset of Pretendard 1.3.9 (https://github.com/orioncactus/pretendard), SIL OFL 1.1 (see LICENSE-OFL.txt).
Pretendard declares a Reserved Font Name, so the modified (subset) fonts are renamed "AES Sans KR".
Weights: 400, 600, 800, 900. Coverage: ASCII, KS X 1001 Hangul (2350 syllables), Jamo, common punctuation/symbols.
Characters outside the subset raise FONT_FALLBACK (never silently substituted). Rebuild from the upstream release with fontTools.subset.
# R4 Noto Serif KR headline face

The R4 prediction-market carousel uses **Noto Serif KR for headlines** and the
AES Sans KR bundle for body copy. Noto Serif KR is an external OFL asset larger
than the repository's 512 KB binary limit, so do not add its TTF here or commit
it. Set `AES_NOTO_SERIF_KR_FONT` to the absolute path of the licensed
`NotoSerifKR.ttf` before rendering. The isolated fontconfig environment then
registers that file's directory alongside the AES Sans KR files, and the font
digest includes the external bytes for render-reuse checks. Without the
variable, the normal test environment remains deterministic and Noto Serif KR
falls back to the bundled AES Sans KR face; tests can run without the external
font file.
