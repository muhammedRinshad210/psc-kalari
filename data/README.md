# Question bank

`data/questions.json` is the single source of truth. `tools/build.mjs` splits it
into `data/q/<subject>.json` (one file per subject, loaded on demand) and writes
`data/index.json`, the small manifest the app reads at boot. Never edit the
generated files by hand.

```bash
npm run validate      # structure check, exits 1 on errors
npm run build         # regenerate data/q/*.json and data/index.json
npm run check         # validate + storage tests
```

## Question schema

```jsonc
{
  "id": "consti-001",              // "<subject>-000", unique, zero-padded
  "subject": "consti",             // key from data/subjects.json
  "topic": "Preamble and basics",  // must match a topic of that subject
  "difficulty": 1,                 // 1 easy, 2 medium, 3 hard
  "q": {
    "en": "On what date did the Constituent Assembly adopt the Constitution?",
    "ml": "ഭരണഘടനാ നിർമ്മാണസഭ ഭരണഘടന അംഗീകരിച്ചത് ഏത് തീയതിയിൽ?"
  },
  "options": {
    "en": ["26 November 1949", "15 August 1947", "26 January 1950", "9 December 1946"],
    "ml": ["1949 നവംബർ 26", "1947 ഓഗസ്റ്റ് 15", "1950 ജനുവരി 26", "1946 ഡിസംബർ 9"]
  },
  "answerIndex": 0,                // index into options.en / options.ml
  "explanation": {
    "en": "It came into force on 26 January 1950, celebrated as Republic Day.",
    "ml": "1950 ജനുവരി 26-ന് നിലവിൽ വന്നു; അന്ന് റിപ്പബ്ലിക് ദിനമായി ആചരിക്കുന്നു."
  },
  "source": "Constitution of India, Article 394 (indiacode.nic.in)",
  "verified": true,                // fact checked against the source
  "needsReview": false             // Malayalam wording needs a native review
}
```

Rules the validator enforces:

- four options, unique within each language, exactly one correct `answerIndex` (0–3)
- `q`, `options` and `explanation` present in English **and** Malayalam
- Malayalam text contains Malayalam characters (pure arithmetic is exempt)
- `topic` belongs to the subject's topic list in `data/subjects.json`
- no duplicate ids and no duplicate English question text
- `source` names a real reference; `verified` and `needsReview` are booleans

The correct option is written first in the data for easy authoring; the app
shuffles the four options every time a question is shown.

## Writing new questions

1. Pick the subject key and one of its topics from `data/subjects.json`.
2. Write an **original** question. Do not copy PSC question papers, guidebooks or
   coaching material verbatim — link to the official PSC website
   (<https://www.keralapsc.gov.in>) for real papers instead.
3. State the reference in `source` (a book, a statute, an official portal). If you
   cannot name a reference, the question is not ready.
4. Write the Malayalam version yourself, not machine-translated prose. If a
   technical term feels uncertain, set `"needsReview": true` and list it in the PR.
5. Keep difficulty honest: 1 = recall, 2 = applied/near-transfer, 3 = tricky or
   two-step.
6. Run `npm run validate && npm run build` before committing.

## Current affairs

`data/q/cur.json` exists with an empty question list. Monthly updates should:

1. Add the month to `topics` for the `cur` subject in `data/subjects.json`
   (for example `"Current Affairs — November 2026"`).
2. Append questions with `"subject": "cur"`, the new topic and a `source` pointing
   at the official release, gazette or news report used.
3. Run `npm run validate && npm run build`.

Keep older months; the practice screen filters by topic, so a growing archive
stays usable.
