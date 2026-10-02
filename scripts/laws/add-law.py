#!/usr/bin/env python3
"""Add an approved legal update or rule to the Property Laws page.

    python3 scripts/laws/add-law.py <draft.json> [--check]

--check only validates the draft (used by the weekly monitor before it saves a draft).
Without it, the item is added to src/data/laws.ts (approved: true) and its texts to
`lawsData` in the five dictionaries, without reformatting them.

Draft shape (one file per item):
{
  "kind": "update" | "rule",
  "id": "kebab-case-id",
  "topic": "citizenship" | "residence" | "ownership" | "taxes" | "rent",
  "decided": "YYYY-MM-DD",            # updates only
  "effective": "YYYY-MM-DD",          # optional, updates only
  "reference": "7566 sayili Kanun ...",  # updates only, Turkish official reference
  "stage": "proposal",                # optional: a bill not yet law
  "sources": [{"key": "resmiGazete|mevzuat|tkgm|gib|goc|ticaret|tbmm|nvi", "url": "https://....gov.tr/..."}],
  "checked": "YYYY-MM-DD",
  "verify": "Arabic note for the owner: what to check on the official page",
  "text": {
    "en": {"title", "summary", "before"?, "after", "affects", "help"}   # update
          {"title", "text"}                                             # rule
    "ar": {...}, "fa": {...}, "fr": {...}, "ru": {...}
  }
}
"""
import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
LAWS_TS = ROOT / "src/data/laws.ts"
LOCALES = ["en", "ar", "fa", "fr", "ru"]
TOPICS = {"citizenship", "residence", "ownership", "taxes", "rent"}
SOURCES = {"resmiGazete", "mevzuat", "tkgm", "gib", "goc", "ticaret", "tbmm", "nvi"}
UPDATE_KEYS = {"title", "summary", "after", "affects", "help"}
RULE_KEYS = {"title", "text"}


def fail(msg: str) -> None:
    print(f"ERROR: {msg}")
    sys.exit(1)


def is_date(value) -> bool:
    try:
        date.fromisoformat(value)
        return True
    except (TypeError, ValueError):
        return False


def official(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme == "https" and (parsed.hostname or "").endswith(".gov.tr")


def validate(d: dict) -> None:
    kind = d.get("kind")
    if kind not in ("update", "rule"):
        fail("kind must be 'update' or 'rule'")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", d.get("id", "")):
        fail("id must be kebab-case")
    if f'id: "{d["id"]}"' in LAWS_TS.read_text():
        fail(f"id {d['id']} already exists in src/data/laws.ts")
    if d.get("topic") not in TOPICS:
        fail(f"topic must be one of {sorted(TOPICS)}")
    if not d.get("sources"):
        fail("at least one official source is required")
    for s in d["sources"]:
        if s.get("key") not in SOURCES:
            fail(f"source key must be one of {sorted(SOURCES)}")
        if not official(s.get("url", "")):
            fail(f"not an official https .gov.tr link: {s.get('url')}")
    if not is_date(d.get("checked")):
        fail("checked must be YYYY-MM-DD")
    if kind == "update":
        if not is_date(d.get("decided")):
            fail("decided must be YYYY-MM-DD")
        if "effective" in d and not is_date(d["effective"]):
            fail("effective must be YYYY-MM-DD")
        if not d.get("reference"):
            fail("reference (official Turkish reference) is required")
        if d.get("stage") not in (None, "proposal"):
            fail("stage can only be 'proposal'")
    required = UPDATE_KEYS if kind == "update" else RULE_KEYS
    allowed = required | ({"before"} if kind == "update" else set())
    shape = None
    for loc in LOCALES:
        t = d.get("text", {}).get(loc)
        if not isinstance(t, dict):
            fail(f"text.{loc} is missing")
        keys = set(t)
        if not required <= keys or not keys <= allowed:
            fail(f"text.{loc} keys must be {sorted(required)} (+ optional before for updates)")
        for k, v in t.items():
            if not isinstance(v, str) or not v.strip():
                fail(f"text.{loc}.{k} is empty")
            if "<" in v or ">" in v or "http" in v:
                fail(f"text.{loc}.{k}: no HTML or links inside the text")
        if shape is None:
            shape = keys
        elif keys != shape:
            fail(f"text.{loc} has different keys from text.en")


def ts_entry(d: dict) -> str:
    lines = ["  {", f'    id: "{d["id"]}",', f'    topic: "{d["topic"]}",']
    if d["kind"] == "update":
        lines.append(f'    decided: "{d["decided"]}",')
        if d.get("effective"):
            lines.append(f'    effective: "{d["effective"]}",')
        lines.append(f"    reference: {json.dumps(d['reference'], ensure_ascii=False)},")
        if d.get("stage"):
            lines.append('    stage: "proposal",')
    sources = ",\n".join(f'      {{ key: "{s["key"]}", url: {json.dumps(s["url"])} }}' for s in d["sources"])
    lines += ["    sources: [", sources, "    ],", f'    checked: "{d["checked"]}",', "    approved: true", "  }"]
    return "\n".join(lines)


def add_to_ts(d: dict) -> None:
    src = LAWS_TS.read_text()
    if d["kind"] == "update":
        marker = "export const lawUpdates: LawUpdate[] = [\n"
        i = src.index(marker) + len(marker)
        src = src[:i] + ts_entry(d) + ",\n" + src[i:]
    else:
        start = src.index("export const lawRules: LawRule[] = [\n")
        end = src.index("\n];", start)
        src = src[:end] + ",\n" + ts_entry(d) + src[end:]
    LAWS_TS.write_text(src)


def add_to_dictionary(loc: str, d: dict) -> None:
    path = ROOT / f"src/i18n/{loc}.json"
    src = path.read_text()
    section = "updates" if d["kind"] == "update" else "rules"
    start = src.index('\n  "lawsData": {\n')
    marker = f'\n    "{section}": {{\n'
    i = src.index(marker, start) + len(marker)
    body = json.dumps(d["text"][loc], ensure_ascii=False, indent=2).replace("\n", "\n      ")
    src = src[:i] + f'      {json.dumps(d["id"])}: {body},\n' + src[i:]
    json.loads(src)  # still valid JSON
    path.write_text(src)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        fail(__doc__)
    d = json.loads(Path(args[0]).read_text())
    validate(d)
    if "--check" in sys.argv:
        print(f"check ok: {d['id']}")
        return
    add_to_ts(d)
    for loc in LOCALES:
        add_to_dictionary(loc, d)
    print(f"added {d['kind']} {d['id']} (approved). Remember LAWS_PAGE_LIVE in src/data/laws.ts.")


if __name__ == "__main__":
    main()
