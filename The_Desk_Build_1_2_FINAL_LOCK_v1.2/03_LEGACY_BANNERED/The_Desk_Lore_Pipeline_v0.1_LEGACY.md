> **STATUS: LEGACY — ACTIVE ONLY WHERE NOT SUPERSEDED**
> Do not implement from this document: cached mutable pronunciation maps or immediate in-place pronunciation correction, fixed press/fan source counts, or any behavior superseded by Coverage Commissioning, Claims Policy, Evidence Package, or Performance & Render. Architecture v1.0 and active successor specs govern.

# The Desk — Lore Pipeline v0.1

Sep 22, 2026 · @Someone

## What lore is

Lore is the club's permanent identity layer: the things a long-time supporter knows without thinking, and the things an outsider gets wrong within a sentence. It's built once, when a club is requested, and changes slowly after that.

| Lore holds | Lore does not hold |
| --- | --- |
| History, honours, defining eras and moments | This season's form, injuries, or manager status (that's the memo) |
| Rivalries, and how much each actually matters | Anything a character did or remembers |
| Culture and ethos — what the club believes it is | Unverified nicknames, chants, or traditions |
| Verified vernacular and the rallying cry | Opinions about the club, unless a source holds them |
| Pronunciation map for names | Current transfer rumors |
| The sensitivity list | Source text of any kind |

One rule governs every line: **culture is sourced or absent.** Nothing is inferred from the club's league, country, or size, and nothing is borrowed from a similar club. A wrong nickname costs more than a missing one, so when the evidence is thin, the field stays empty.

## The research pass

One pass per club, run on request, reading widely and in the club's own language as well as English. Most of the club's local discourse may not be in English, and English-only research would quietly import an outsider's view.

### Route by source class

Different sources are trusted for different things. Blending them destroys both signals, so each claim takes its **truth** from the top of this table and its **weight** from the bottom.

| Source class | Trusted for | Not trusted for |
| --- | --- | --- |
| Reference and structured data | Dates, honours, records, stadium facts | What anything means to anyone |
| Club and league official | Official history, identity as the club tells it | Honest self-assessment |
| Press archives | Events, eras, managerial history | How much it still matters |
| Fan blogs and fanzines | Emotional weight, grievances, in-jokes | Facts |
| Fan audio and video, as text | Vernacular, chants, how supporters actually talk | Facts |

The last row is the one most research skips. Titles, descriptions, captions, and comments on fan channels and podcasts are where the vernacular lives — read as text, never as audio.

### What else this pass produces

The same crawl builds two things the ingest job needs, so they come for free:

- **The source registry,** vetted against the coverage floor and filled toward the target: roughly four to six press sources and five to eight fan sources, where the club has them. Within that target, prestige leads: the outlets the club's own community respects most, press and fan alike, are found first and trimmed last.
- **Seeded baselines,** from each source's most recent season — publishing rate, volume, beat count, tenor range — so the club launches calibrated.

The two reads differ on purpose. Lore research goes deep in time — years or decades — but targeted, searching for evidence behind specific claims rather than reading everything. The baseline read is shallow in time but thorough, because publishing habits change: an outlet's output from five years ago would distort what counts as a normal week today.

## Claims

Lore is stored as atomic claims, never as prose. A paragraph can't be audited line by line; a list of claims can.

```
claim:
  id: lore/nice/rivalry/002
  type: RIVALRY            # HISTORY | RIVALRY | CULTURE | VERNACULAR | RITUAL | MOMENT | CHANT
  text: Marseille is the rivalry supporters care about most
  sources: [s07 press, s12 fans, s15 fans]
  truth_from: press archive
  weight_from: fan blogs — named in 9 of 14 fan sources
  confidence: 3
  contested: false
  verified: 2026-09-22
```

### Confidence gates on-air use

| Level | Evidence | On air |
| --- | --- | --- |
| 3 | Two or more independent sources, right class | Stated plainly |
| 2 | One authoritative source of the right class | Stated plainly |
| 1 | One weaker source, or right source, wrong class | Only hedged — "supporters will tell you…" |
| 0 | No supporting source | Never enters the file |

**Vernacular has a higher bar:** it needs level 2 or above from a fan-native source, or it stays out. That's the category a fan hears first and forgives last.

### Contested is a feature

When sources genuinely disagree — was a manager pushed or did he jump, does the Monaco derby matter — the claim is kept, marked contested, with both positions attached. That's ammunition for a desk built on disagreement, and it's the claim most likely to become a good segment.

## Verification

The failure to design against is an auditor that shares the author's blind spots, so the same model confidently confirms its own mistakes. Three passes, each asking a different question.

**1. Retrieval audit — is it supported?** Not "is this true," which a model can't know, but "return the source and the passage that supports this." A claim that can't produce one drops to level 0. This turns verification into retrieval, which models do far better than judgment.

**2. Adversarial pass — what's most likely wrong?** A different model than the one that drafted, so the errors don't overlap. It gets a fixed quota: "identify the five claims most likely to be wrong, and why." Asking whether there are errors gets "looks good"; asking for exactly five gets five real challenges. Each challenged claim is re-audited or dropped.

**3. Wince pass — does it read like an outsider wrote it?** A model plays a supporter who's followed the club for decades and flags whatever would make them wince: the nominal derby treated as the real one, a nickname opposition fans use, a legend described in the wrong terms. This catches errors of weight and tone that are factually defensible and culturally wrong.

Whatever survives all three is the lore file. Everything dropped is logged with its reason, so a rejected claim doesn't quietly reappear in next year's re-audit.

## Special items

**Rallying cry.** The short cry the sign-off hands to listeners. Level 3 only, fan-native sources, a cry or motto rather than song lyrics, kept in the club's own language. If none clears the bar, the sign-off ends without one.

**Chants.** Stored as CHANT claims: the words for short cries, the name only for songs, the tune where sources name it, and the sources themselves. Same fan-native bar as vernacular. The script may mention a chant by name or quote a short cry, and never reproduces song lyrics. The parked audio chant process reads from these same records, so the evidence is gathered once whether or not the ident idea ships.

**Pronunciation map.** Every current squad name, the manager, the stadium, and the club itself, run through an IPA pass and converted to a TTS-friendly respelling. Cached per club so a name sounds identical every week, and hand-correctable — the one place a supporter correction is applied immediately. A debutant whose name first appears on match day gets a same-morning pass.

**Rivalry weight.** Rivalries are ranked by how much the fan sources actually talk about them, not by geography. That's what stops the desk treating a nominal local derby as the fixture that matters while missing the real grudge.

**Sensitivity list.** Topics the desk handles with care or not at all, sourced like everything else:

- **Anniversaries** of disasters, deaths, and tragedies connected to the club. On those dates the episode leans sombre regardless of the result, and never jokes near the subject.
- **Ownership and political topics** that land differently in different markets, per locale.
- **Chants and nicknames to avoid:** abusive, discriminatory, or tragedy-referencing material that circulates in the fanbase but must never be repeated.
- **Settled grievances** the fanbase considers closed, so the desk doesn't reopen them for a cheap segment.

The anniversary entries feed the sombre flag directly, so the calendar can trigger care even on a week when the coverage doesn't.

The sensitivity list is built **recall-first**, because the costs are lopsided: handling a topic carefully when it didn't need it costs almost nothing, while missing one is the kind of mistake people screenshot. It gets its own dedicated search in the club's language, and its audit flips direction — instead of "which entries are wrong," the second model is asked "what sensitive topic is missing?" A long-established club with an empty list triggers a second pass rather than being accepted. Supporter corrections can add entries like any other claim.

## Launch readiness

A requested club goes live only when every line below is true. Until then it sits on the waitlist, which is also a precise map of where the product doesn't yet reach.

- [ ] The source registry clears the floor: three live sources, at least one press and one fan.
- [ ] Baselines are seeded from the archive back-fill.
- [ ] Core identity claims are verified at level 2 or above: founding, stadium, defining eras, the main rivalry.
- [ ] The pronunciation map covers the current squad, manager, stadium, and club name.
- [ ] The sensitivity list exists, even if short — an empty list means "checked," never "skipped."
- [ ] All three verification passes have run, with drops logged.
- [ ] The rallying cry is verified, or explicitly marked as none.

Notice what's **not** required: vernacular, chants, rituals, or a rich culture section. Those make episodes better, but a club can launch with a lean, accurate file and grow it. It can't launch with a rich, wrong one.

## Maintenance

**Annual re-audit.** Once a year, usually in the off-season, every claim is re-run through the retrieval audit and the rivalry weights are recomputed. Identity is stable but not frozen: a promotion, a new stadium, or a new owner changes what a club thinks it is.

**Season capsules.** At season's end the ledger distills the season into one short, dated capsule appended to the lore — finishing position, the defining storyline, the moment people will still mention. Built from ledger events, never from the season's memos, so it can't inherit drift. Ten seasons of capsules is still a small file.

**Squad turnover.** The pronunciation map refreshes whenever the squad list changes, which catches January signings and loan returns without waiting for the annual pass.

**Supporter corrections.** A "spotted something wrong?" link in the show notes feeds a correction queue. A correction is itself a claim: it needs a source or corroboration before it replaces anything, except pronunciation, which is applied immediately because the cost of being wrong is small and the cost of staying wrong is high. Rejected corrections are logged with a reason, like any other dropped claim.

Every correction triggers its own **mini research call** — the same Gemini research and Claude retrieval audit as the original lore, just scoped to one claim. It costs pennies and holds corrections to the same trust standard as everything else. Three rules shape the outcome:

- **Doubt demotes; only evidence promotes.** A credible dispute is enough to drop an existing claim to hedged or contested, even when there isn't enough evidence to replace it. Replacing a claim needs the full verification bar.
- **Independent agreement counts.** On thin clubs where research comes back empty, the same correction arriving from several unrelated supporters can stand in for a second source.
- **Corrections can be hostile.** Rival fans will try to slip in a nickname or chant. The research call is the defense, submissions are rate-limited per person, and vernacular and chants need the highest bar.

Corrections are also the lore pipeline's best growth path. Supporters of under-covered clubs are the people most likely to know, most likely to care, and most likely to tell you.

## Open questions

- [x] Which model drafts and which audits? The adversarial pass only works if they're genuinely different. Decided: Gemini drafts, using search grounding for breadth across languages; Claude runs the retrieval audit, adversarial, and wince passes. Validate with a swap test on two clubs.
- [x] How much archive does the back-fill read — a season, or just enough to seed baselines?
- [x] Should the sensitivity list get a one-time human glance before launch, given the cost of getting it wrong? Decided: no — a reviewer without the club's history is a rubber stamp. Robustness comes from recall-first research and an omission audit instead.
- [x] How is a supporter correction corroborated for a club with only one or two fan sources? Decided: every correction gets a mini research call; doubt can demote, only evidence promotes; independent agreement from several supporters can stand in for a missing source.
- [x] The parked chant process will eventually read from this file; does chant evidence belong here or in its own store?
