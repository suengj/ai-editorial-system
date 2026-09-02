# benchmarks/

Our own findings on external editorial systems, Skill designs, multimedia
generators, provider adapters, and publication workflows.

| Benchmark | Issue |
|---|---|
| [`EDITORIAL-SYSTEMS-BENCHMARK.md`](EDITORIAL-SYSTEMS-BENCHMARK.md) | AES-P1.1 (SUE-438) |
| [`MULTIMEDIA-GENERATORS-BENCHMARK.md`](MULTIMEDIA-GENERATORS-BENCHMARK.md) | AES-P1.2 (SUE-439) |
| [`AUDIO-TTS-PROVIDERS.md`](AUDIO-TTS-PROVIDERS.md) | Audio provider/model adapter snapshot — observed capability, certification lanes, and recertification triggers |

The provider-specific audio benchmark is deliberately separate from
`../editorial/AUDIO-SCRIPT.md`. Editorial semantics are intended to remain
stable; TTS models, endpoints, control grammars, and launch stages are not.
Provider/model observations therefore live here and may be superseded without
changing the canonical spoken-script contract.

Every reference cited here must resolve to an entry in
[`../references/catalog.json`](../references/catalog.json), and every catalog
entry must be cited by some benchmark or policy document. `npm run
validate:rights` checks both directions — a catalog nobody cites is an
unreviewed import list, and a citation resolving to nothing is an
unattributed claim.

Recommendations are marked **[R]** when traceable to a reference and
**[Owner]** when they are Suengj's editorial choice.

Admits: our analysis, attributed quotations within fair use, citations.
Rejects: copied third-party documents or datasets. See `../NOTICE`.
