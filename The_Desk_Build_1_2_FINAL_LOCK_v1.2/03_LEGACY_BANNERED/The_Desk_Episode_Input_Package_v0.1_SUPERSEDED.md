# The Desk — Episode Input Package v0.1

> STATUS: SUPERSEDED  
> Superseded by: Evidence Package v0.2  
> Do not use for implementation.  
> Retained for historical decisions/examples only.


Sep 22, 2026 · @Someone

## What this is

The package is everything the writing model receives for one episode. The script spec says how to write; the character bible says who's speaking; this says what they have to work with.

One rule governs it: **if it isn't in the package, it can't be in the episode.** No recalled facts, no assumed history, no inferred culture. That's what makes the traceability gate enforceable rather than aspirational — every claim and every position points back to something here.

It's also the seam between the pipelines and the show. Each piece below is produced by a different job, and each can fail independently, so the package doubles as the contract those jobs are written against.

## The pieces

| Piece | Holds | Refreshed |
| --- | --- | --- |
| `entity` | Club, league, locale, cadence, pronunciation map, rallying cry | On spin-up, rarely after |
| `event` | The match: result, scorers, lineups, key stats, each with an ID | Per episode |
| `lore` | History, rivalries, verified vernacular, culture notes, season capsules | Once, then annually |
| `memo` | Recent form, open predictions in their exact words, motif ledger | Weekly |
| `log` | Last three episodes in detail, plus the season topics ledger | Per episode |
| `coverage`.press + coverage.fans | Two separate streams — evidence-led reporting and supporter voice — each with paraphrases, IDs, salience, and tenor | Per episode |
| `flags` | Ritual triggers, divergence, predictions due, sombre trigger | Per episode |
| `silent` | Odds-derived probabilities. Calibrate only, never voiced | Per episode |
| `settings` | Runtime band, locale, tag density, week size | Per episode |

### Rules that travel with the pieces

- **Everything carries an ID.** Facts point at ledger rows; paraphrases point at source records. Each coverage item also carries its outlet name and URL, so attributions can be spoken on air and the credits block builds itself. Outlets and bylined writers can be named; individual forum posters never are.
- **Coverage is paraphrase, never quotation.** The two streams are classified per item by stance rather than by outlet, so a fan blog's tactical breakdown files under press and a journalist's mood piece can file under fans. Gaz draws his positions from press, Simon from fans, and Tully across both. Source text is summarized on ingest, so the writer never sees copy it could accidentally reproduce.
- **Salience is a number, not a vibe.** It's what decides which beats get debated, and it's measured against the club's own baseline. Each stream is scored separately, so a beat that's loud among supporters and quiet in the press is itself the divergence signal.
- **`flags` can stop the show.** A sombre trigger suppresses the cold open, rituals, and ribbing. A failed ingest halts rather than shipping a thin episode.
- **Absence is explicit.** A missing piece arrives as an empty field with a reason, never as silence — a new club has no `log`, and the writer needs to know that rather than invent one.

## Worked example

Hand-built from the Nice–Lille episode, so the new shape can be compared against a script you already know. Content is illustrative and abbreviated; the structure is the point.

```
entity:
  club: OGC Nice | league: Ligue 1 | locale: en
  cadence: per-match | cry: "Issa Nissa" [verified: lore/vern/003]
  pronounce: { Nice: "Neese", Amoura: "a-MOO-ra" }

event:
  id: 2026-09-20/nice-lille | result: Nice 2-1 Lille
  facts:
    f01: first Ligue 1 win of the season
    f02: ends 326-day home league winless run
    f03: Amoura — forced own goal (22'), scored (67')
    f04: Diouf — 7 saves
    f05: possession 41% (previous match: 68%)
    f06: Clauss gave up the captaincy [src: s03, presser]

lore:
  identity: working-class Stade du Ray inheritance; Riviera club, not a Riviera crowd
  rivals: Marseille (hostile), Monaco (derby, contested significance)
  season_capsules: [2024-25: 11th ...]

memo:
  form: L-L-D-L-W | position: 16th → 14th
  open_predictions:
    p07: Gaz, last week — "they must shift to a compact 4-3-3 or be overrun"
  motifs: [m02: "the away kit" — 2 uses, last seen 12 days ago]

log:
  ep_prev: beats [Auxerre defeat, Diouf criticism]; tangent [pre-season kit]
  topics_ledger:
    t04: "is Pantaloni the problem" — 4 episodes, unresolved, cooling

coverage:
  c01 [press · Nice-Matin · salience .91]: tactical shift to a lower block created the space
  c02 [press · L'Équipe · salience .74]: Diouf's recovery after a month of criticism
  c03 [fans · supporters' forum · salience .68]: relief, but nobody trusts it yet
  c04 [fans · fan site · salience .55]: the captaincy change read as honest, not weak
  c05 [press · Nice-Matin · salience .31]: Seidu's debut

flags:
  week_size: standard (volume 1.2× baseline, 5 live beats)
  predictions_due: [p07 — wrong]
  ritual_candidates: [sport_court — t04 split in coverage]
  divergence: none | sombre: false

silent:
  next_fixture_probabilities: { nice .38, draw .29, strasbourg .33 }

settings:
  runtime: 10m (1,350 words) | tags: standard | locale: en
```

Read it as an episode and the shape does the work: c01 and c03 are the two debate beats, p07 is a Receipts due, c05 is a fact for the wrap, and t04 plus the coverage split triggers a Sport Court.

## Deliberately not in the package

- **Source text.** Only paraphrases with IDs. The writer can't reproduce what it never sees.
- **Raw stats dumps.** Only the facts the coverage actually engaged with. A full match feed invites the catalog problem — numbers for their own sake.
- **Earlier memos and summaries.** The memo and the topics ledger are rebuilt from the ledger and episode entries, never from previous summaries. That's what stops drift.
- **Anything about the characters' lives.** Tangents come from fan chatter; the rest of their texture lives in the bible.
- **Betting language.** Probabilities arrive under `silent` and never leave it.
- **Unverified culture.** No nickname, chant, or rivalry significance that isn't sourced. Absent beats wrong.
- **Suggested angles.** The package reports what the coverage says, not what the episode should argue. Choosing beats is the writer's job, ranked by the rules in the script spec.

## Who builds each piece

| Piece | Producer | Status |
| --- | --- | --- |
| `entity`, `lore` | Lore pipeline, once per club | Spec to write |
| `event` | Match data feed into the ledger | Spec to write |
| `coverage`, `flags` | Ingest and digest job, per episode | Spec to write |
| `memo`, `log` | Weekly rebuild from ledger and episode entries | Spec to write |
| `silent` | Odds adapter, normalized to probabilities | Small, defined |
| `settings` | Scheduler, from week size and locale | Small, defined |

Three foundation docs remain, in the order they unblock things:

1. **Ingest and digest.** Sources, paraphrasing, salience scoring against a club baseline, tenor, flags, and the halt conditions. It produces the two pieces that decide what an episode is about.
2. **Lore pipeline.** Multi-source research, claim tiers, cross-model audit, the confidence gate, and what a club needs before it can launch.
3. **Ledger and memo.** Event storage, the weekly rebuild, motif lifecycle, episode log, and season rollover.

Each one ends with a worked example for this same club, so the package above fills in from real pipelines instead of by hand.
