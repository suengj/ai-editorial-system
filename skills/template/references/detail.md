# template — reference material

Progressive disclosure demonstration. This file is **not** loaded at session
start; the agent loads it only when the `load_when` condition in the SKILL.md
front matter holds.

Detail that would push the entry point past its line budget belongs here:
worked examples, edge-case handling, long tables, decision trees.

The rule that makes this work: every reference declares *when* to load it. A
`references/` file with no stated condition is either always-needed — in which
case it belongs in `SKILL.md` — or never-read.
