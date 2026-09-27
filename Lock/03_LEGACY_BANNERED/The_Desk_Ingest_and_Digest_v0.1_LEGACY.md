> **STATUS: LEGACY — ACTIVE ONLY WHERE NOT SUPERSEDED**
> Do not implement from this document: paraphrase-only retention, source-text discard, ritual/prediction/sombre ingest flags, any sombre override or “ship anyway” path back to normal mode, fixed press/fan source counts, or other behavior superseded by Architecture v1.0, ADR-001, Claims Policy v0.1, Evidence Package v0.2, or active successor specs. Confirmed sombre policy cannot be bypassed by an operator mode change.

# The Desk — Ingest & Digest v0.1

Sep 22, 2026 · @Someone

## What this job does

It turns a morning's reporting into two pieces of the episode package: `coverage`, the paraphrased press and fan streams, and `flags`, the signals that decide what kind of episode this is.

Four principles govern it.

- **Reporting leads.** The job never decides what matters. It measures what the coverage spends its attention on and hands that over with scores attached.
- **Halt rather than thin.** A missing or unverified morning produces no episode and an alert. A thin episode is worse than a skipped one, because it teaches listeners the feed isn't worth opening.
- **Paraphrase on arrival.** Source text is summarized at ingest and then discarded. Nothing downstream can reproduce copy it never received.
- **Relative to itself.** Every measurement — volume, tenor, salience — is scored against the club's own baseline, never against other clubs.

## Source registry

Each club carries its own source list, built once at spin-up and maintained after. A club can't launch without one that clears the coverage floor.

| Field | Purpose |
| --- | --- |
| `outlet`, `url`, `feed` | Display name for on-air attribution, plus the RSS feed where one exists |
| `default_stance` | press or fans — a starting guess only; items are classified individually |
| `language` | Source language, often not the listener's |
| `access` | open, paywalled, or blocked — decides whether it's fetchable at all |
| `weight` | Prestige and reliability within the club's community — how much it counts toward salience, which sources survive when the list is trimmed to target, and whose name is preferred when citing on air |
| `health` | Last successful fetch, recent failure rate, typical publishing lag |

### Building the list

Candidates come from the same research pass that builds the lore: club and league sites, regional papers, national outlets that cover the league, dedicated fan blogs, supporters' trust and podcast sites. Prefer RSS over scraping wherever it exists.

**Vetting is deliberately strict**, because a bad source poisons everything downstream: it must publish regularly on this club, carry a named outlet identity, and allow access. Aggregators that republish other people's copy are excluded — they inflate salience by duplicating a single story.

### The coverage floor

A club needs at least three independent live sources, including **at least one fan source and at least one press source**, before it can launch. Below that, the desk can't do what it exists to do: Gaz has nothing to reason from, or Simon has no fanbase to mirror. A club under the floor stays on the waitlist, which is honest and also tells you exactly where the product doesn't reach yet.

### The target

Above the floor, aim for roughly four to six press sources and five to eight fan sources. Press saturates quickly: outlets converge on the same beats, so extra sources mostly add duplicates. Fan voices vary far more, and a mood reading needs many of them to mean anything, so the fan target runs higher. Past the target, sources are swapped by weight rather than added.

Breadth still shows up for the aggregator pitch without bloating the credits. The show notes can say how much was read — "distilled from 14 articles across 9 outlets" — while crediting only the handful the episode actually used.

## Fetching and retention

The job runs a few hours after the final whistle, before the generation window, so late-filed match reports are included.

- **Be a polite client.** Respect robots directives, identify the crawler honestly, rate-limit per domain, cache conditionally with ETags, and back off on errors. These sources are the product's raw material and several of them are one person with a blog.
- **Never fetch what isn't allowed.** Paywalled bodies, sites that disallow crawling, and anything behind a login stay out. Where only a headline and summary are available, that's what gets used, and the item's weight drops accordingly. A paywalled outlet is credited only for what was actually read: saying the desk read a full report it only saw the headline of is a false claim. Premium outlets are a partnership conversation, not a scraping one.
- **Text only.** No video or audio. YouTube and podcast episodes contribute titles and descriptions at most.
- **Fallback, then halt.** If the fetch pass comes up short, one grounded search pass runs against the same verification rules. If that also fails, the episode halts.

### Retention

Once an item is paraphrased, the source text is discarded. What persists is the paraphrase, the extracted claims, the outlet, the URL, a content hash, and the timestamp.

The hash does real work: it catches the same story republished across outlets, so a single wire report doesn't masquerade as five sources agreeing. Keeping only paraphrases also means an accidental verbatim reproduction is impossible further down the pipeline, which is a cleaner guarantee than asking a model not to quote.

## The verification gate

The worst failure this system can produce isn't an empty morning. It's a confident, well-made episode about the wrong match — last week's game, the reserves, or a fixture that was postponed. Nobody downstream can catch that, so it's caught here.

Before anything is digested, the coverage has to prove it's about this event:

1. **The event is final.** Confirmed from the match data feed, not from the coverage.
2. **The scoreline matches.** Items whose stated result contradicts the ledger are dropped, not reconciled.
3. **The opponent and date match**, within a sensible window of the kickoff.
4. **At least two named players from the confirmed teamsheet appear** across the surviving items.
5. **Two independent sources clear all of the above.** One source agreeing with itself isn't verification.

An item that fails is dropped with a reason. If the surviving set can't clear the floor, the grounded-search fallback runs under the same rules, and then the episode halts.

Note what this replaces: a word-count threshold. Three hundred words of search-engine filler passes a length check and fails every test above.

## The digest

Four passes turn verified items into the coverage streams.

**1. Paraphrase.** Each item is summarized to a short, plain restatement — typically under eighty words — in the listener's language, whatever the source language. Quotes are stripped rather than translated, except where a manager or player is quoted in an official setting, which is kept as an attributed paraphrase.

**2. Classify by stance.** Each item lands in `press` or `fans` by how it argues, not by who published it. Evidence-led analysis is press, even from a fan blog. Supporter reaction is fans, even from a national paper's fan column. Items that do both are split into two records.

**3. Extract claims.** Every factual assertion becomes a claim record: the statement, its source ID, and a type — result, statistic, official statement, transfer or injury report, or sentiment. Injury and transfer claims carry their status, since a club announcement and a rumor are not the same object and only one is assertable.

**4. Cluster into beats.** Items about the same thing merge into one beat, with its constituent items attached. Beats are the unit everything downstream works in: they're what gets scored, debated, mentioned, or dropped. Each beat also carries a type: \*\*match\*\* (what happened on the field and why), \*\*context\*\* (a longer-term storyline — form, selection, the manager's position), or \*\*off-field\*\* (board, ownership, stadium, transfers). Clustering is also the second defense against republished wire copy, which collapses into one beat instead of five.

Each beat emerges with an ID, a label, its items from both streams, and the claims underneath it.

## Scoring

### Salience

Each beat is scored **within each stream separately**, from four inputs: how many independent outlets covered it, how much space they gave it, how prominently they placed it, and whether it persisted across more than one day. Outlet weight applies; near-duplicate copy doesn't count twice.

Scores are then normalized against the club's own rolling baseline for volume and beat count, so a quiet club's big week reads as a big week. Baselines are seeded at spin-up: the research pass back-fills each source's recent archive and computes per-source and per-club norms — publishing rate, volume, beat count, tenor range — so a new club launches calibrated. After that the baseline rolls forward season-to-date, never shorter than six weeks. Only the metrics are kept; back-filled text is discarded like any other.

**Type outranks score.** On a match episode the match is the show, so beats are ranked within type before they're ranked by salience. Segment 1 is always a match beat. A context beat earns Segment 2 only when it bears on the match narrative — the substitution that reopened the manager question, not the manager question in the abstract. Off-field beats reach the show only when they dominate the coverage, which is exactly A Small Request's trigger; otherwise they're a line in the wrap or a note in the show notes. Weekly roundup episodes, off-season weeks, and sombre weeks invert this, since there is no match to lead with.

### Tenor

Each stream gets a mood reading: direction, intensity, and how far both sit from that club's normal. Fan tenor is what Simon mirrors, so intensity relative to baseline matters more than absolute sentiment — a fanbase that is always slightly miserable isn't having a crisis.

Tenor carries confidence too. Thin fan coverage produces a low-confidence reading, and a low-confidence mood is reported as such rather than asserted.

### Divergence

Three comparisons, each of which tends to be the most interesting thing in the week when it fires:

- **Results versus fan tenor.** Winning and furious, or losing and calm.
- **Press versus fans.** A beat that's loud in one stream and absent from the other. And, more usefully, the same beat with different verdicts — the press calling it a transitional wobble while the fans start talking about sacking the manager. For every beat present in both streams, compare three things: the conclusion each reaches, how serious each considers it, and what each blames. Any gap is emitted with both sides attached. Agreement reached by different routes is flagged too, since that's the earned agreement the desk exists to find.
- **This week versus the running argument.** A topic in the log that the coverage has suddenly stopped or started caring about.

Each divergence is emitted as a flagged beat with both sides attached, ready to become a segment question.

## Flags

| Flag | Raised when | Effect |
| --- | --- | --- |
| `week_size` | Volume and beat count against baseline | Sets the runtime band |
| `ritual_candidates` | A beat matches a ritual's trigger | Offers the writer a ritual; never forces one |
| `predictions_due` | An open prediction is settled by the result | Receipts available |
| `divergence` | Any of the three comparisons fires | Strong segment question |
| `sombre` | Event-type detection, below | Suppresses the show's lighter machinery |
| `cold_start` | No episode log yet (baselines are seeded at spin-up) | No callbacks, no Receipts |
| `low_confidence_mood` | Thin or contradictory fan coverage | Simon hedges instead of asserting |

### Sombre mode

This one triggers on **event type, not sentiment**, because sentiment scoring is least reliable exactly when it matters most. It fires on a death, an on-field medical emergency, crowd disaster or serious violence, racist or discriminatory abuse, or a serious criminal charge — and on the corroborating test of whether the match has become secondary in the coverage.

When it fires: no cold open, no ritual, no Receipts, no ribbing, no rallying cry. Tully leads, the runtime shortens, and medical or legal status comes only from official statements. The bar for firing is deliberately low, since a wrongly sombre episode is merely flat, while a wrongly jaunty one is the kind of mistake people screenshot.

### Off-season

Between seasons and during international breaks the same job runs on a weekly cadence, led by whatever the beat writers and fan sites are still producing. Transfer coverage dominates and is the least reliable material the pipeline ever sees, so rumors are always attributed to their outlet, never asserted, and never written into the ledger as fact.

## Halts, degraded modes, and open questions

### Halts

No episode, and an alert:

- The event isn't confirmed final — postponed, abandoned, or still disputed.
- The verification gate fails even after the grounded-search fallback.
- The coverage floor isn't met after verification: no surviving press item, or no surviving fan item. The desk can't function with one leg missing.
- The digest itself errors out partway. A half-classified coverage set is worse than none.

**Overrides.** Every halt alert shows its reason and offers a one-tap "ship anyway" for false positives. An override bypasses only the halt that fired — every downstream gate still runs — and it's logged with the reason, so repeated overrides show where a rule is miscalibrated. A sombre trigger can be overridden the same way, back to a normal episode. A match that isn't actually final can't be.

### Degraded modes

The episode ships, but adjusts:

- **Thin fan stream.** Mood is marked low-confidence, Simon hedges rather than asserts, and A Small Request can't trigger.
- **Thin press stream.** Gaz works from ledger facts only, and Geek of the Week needs an anomaly in the data itself.
- **Late coverage.** A late kickoff whose reports haven't landed waits within the generation window rather than halting; the publish gate holds.
- **A failing source.** Registry health tracks it; repeated failures raise a replace-this-source alert and recheck the floor.
- **Low-confidence translation.** Items from a source language the paraphrase pass handles poorly lose weight rather than being trusted at face value.

Alerts reach you only for halts and chronically failing sources. Everything else is logged, not paged.

### Open questions

- [x] Is three live sources, with at least one of each stream, the right floor, or should it be stricter?
- [x] How long a window defines a club's baseline — four weeks, eight, a full season? (The running average of past coverage used to size weeks and read mood intensity — pipeline math, not the memo the writer sees.)
- [x] Do you want a manual "ship anyway" override on halts?
- [ ] Early on, should every sombre trigger be logged for you to spot-check, until the threshold is trusted? PARKED: firm up the sombre criteria against historical precedent — a set of real cases and hypotheticals you classify, turned into the category rules.
