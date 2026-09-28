The Desk: Product Thesis and Demand-Activated Beta Model

Status: Working product thesis, not a locked implementation spec
Date: 2026-09-28
Context: Written after Build 1 Foundation merge and the subsequent product/red-team discussion. This document is intended to preserve the current product direction, the reasoning behind it, and the boundaries that should constrain near-term engineering.

1. Executive thesis

The Desk is stronger as a multi-team sports-audio service than as a network of standalone AI team podcasts.

The core consumer promise is:

Follow more teams. Spend less time catching up. Enjoy doing it.

The Desk should help a fan maintain meaningful attention across more of the sports world than their available time would normally allow, while still delivering the personality, chemistry, analysis, argument and entertainment that make sports talk worth listening to.

The product is not simply an AI voice reading a summary of the news.

Internally:

AI briefing products turn information into audio. The Desk turns information into programming.

The product should be useful even to someone who already watched the entire game or match.

A top-level editorial quality test is therefore:

Would I still choose to listen if I watched the whole game?

If the answer is no, the product has fallen back into recap/summary territory.

2. What changed from the original product concept

The original product concept was effectively:

Build excellent team-specific post-match podcasts and distribute them through normal podcast channels.

That remains a valid output, but it is no longer the strongest definition of the product.

A fixed team podcast enters the market looking like another team podcast. At discovery, the consumer has little reason to understand why The Desk is structurally different from established human shows.

The stronger product is:

A fan chooses the teams they care about, decides how closely they want to follow each one, chooses the kind of sports show they enjoy, and receives those shows automatically after games.

This exposes the value of the underlying infrastructure directly to the consumer.

The unit being sold is no longer primarily a show.

It is increasingly the listener's sports world.

3. The consumer problem

Sports media generally prices attention in large fixed blocks.

A fan may happily spend 30–60 minutes on a human podcast about their main team, but that model breaks down once they also want to stay connected to:

a local team;

another club in a different league;

a team where a favorite player moved;

a team they used to follow more closely;

multiple teams across different sports;

a foreign club whose best coverage is not in the listener's language.

The result is that secondary interests often collapse into scores, highlights and social-media fragments.

The Desk's job is to preserve more of those interests at a much lower time cost.

For a main team, The Desk may be a supplement to human podcasts.

For a secondary or tertiary team, The Desk may be the thing that makes following the team meaningfully possible at all.

4. The three-part product promise

The current proposition has three equally important legs.

4.1 Breadth

The listener can follow more teams.

4.2 Fit

The listener can decide how much attention each team deserves.

4.3 Entertainment

The result is still a sports show, not a spoken summary.

The Desk should have hosts with recognizable personalities, chemistry, rhythm, perspective and conversational behavior.

They should:

explain;

react;

push back;

find things funny;

disagree when genuine disagreement exists;

connect evidence to meaning;

move the conversation forward;

sound like programmed sports talk rather than narrated notes.

Entertainment is therefore not a decorative layer added after factual accuracy.

It is part of product correctness.

5. Current consumer-facing pitch territory

The strongest current line is:

Follow more teams. Spend less time catching up. Enjoy doing it.

Other useful supporting language:

Pick your teams. Choose how closely you want to follow each. Choose your show. Your post-game shows appear automatically after they play.

And:

Follow five teams in the time most podcasts give you one.

The last line should not imply that the listener is trading entertainment for efficiency. The Desk must preserve the experience of listening to an actual sports show.

“The first listen, not the only listen” remains a useful internal positioning principle, particularly for a listener's main team, but it should not necessarily be the public headline.

6. Coverage depth: consumer language vs internal runtime

Exact runtime should remain an internal production concept even if approximate duration is shown to the user.

The consumer may be better served by choosing an amount of attention rather than a precise number of minutes.

Illustrative labels only:

Keep me connected

I've got a few minutes

Give me the major insights

Get into the details

These would map internally to a small number of bounded runtime/programming profiles.

The exact number of profiles and their target durations are not settled.

Possible durations such as 3, 6, 12 and 30 minutes remain hypotheses, not requirements.

The key principles are:

Each depth is a genuinely programmed edition, not the same script compressed or padded.

Short versions cut lesser material rather than stripping caveats from important claims.

Long versions expand the programming budget and use more worthwhile evidence, context and discussion.

The user may be shown approximate duration for expectation-setting without being forced to think like a producer.

Because the user chooses depth per team, separate episodes remain natural. The Desk is not promising to optimize one continuous 25-minute audio block unless a future product explicitly does so.

7. Show choice: the consumer should choose a show, not an AI setting

“Discuss” and “Debate” are useful internal format labels, but they may not be the final consumer-facing names.

The final experience should probably feel like choosing between actual branded sports shows.

Conceptually:

Discuss

The cast is primarily trying to understand what happened together.

Disagreement is natural but explanation, exploration and synthesis dominate.

Debate

The program gives more room to genuine contestable questions and competing interpretations.

It may be sharper, more argumentative and more energetic.

However:

facts do not become debatable;

confidence is never upgraded for entertainment;

conflict must originate in legitimate evidence or interpretation;

the format cannot manufacture disagreement because it needs a segment.

A future third archetype may exist:

Hang

A more companionable, personality-led sports format where the pleasure is partly spending time with the hosts.

This is a serious future hypothesis because much of modern sports media has moved toward “bro hang” or friend-group formats.

It should not be treated as a launch requirement. It is probably harder for synthetic talent because chemistry, spontaneity, running jokes, timing and parasocial attachment are central to the format.

8. Separate casts are currently preferred

Discuss and Debate should not initially be treated as intensity settings applied to the same personalities.

Turning a dry, process-oriented character into an incensed debate personality by adjusting a prompt or performance dial would violate the character rather than localize it.

The current preference is therefore:

Different format archetypes may use separate ensembles built from shared role architecture.

The Anchor may prove portable across formats, but that should be tested rather than assumed.

A Debate anchor may need to be more of a participant, provocateur or high-presence personality than a Discuss anchor.

No current real broadcaster should be imitated. Real figures may be studied only to identify durable broadcast archetypes.

9. Character architecture should be layered and reusable

The scalable abstraction is not “new characters for every sport.”

A character should be assembled from reusable layers.

Layer 1: Editorial role

The deepest, most reusable layer.

Anchor: frames, controls, synthesizes.

IQ: explains mechanism, process, tactics, statistics and structural causes.

EQ: interprets emotional consequence, supporter meaning and cultural stakes.

These roles are sport-agnostic.

Layer 2: Personality architecture

How the character thinks, jokes, reacts, handles uncertainty, disagrees and changes gears.

This should also be largely sport-agnostic.

Layer 3: Show grammar

Discuss, Debate, and potentially later Hang.

This controls what kind of conversation the program is designed to produce.

Layer 4: Market/cultural realization

Initially likely to distinguish at least UK and U.S. realizations.

This includes:

voice/accent;

idiom;

cultural assumptions;

conversational conventions;

appropriate sports-media register.

Layer 5: Sport competence

The sport-specific knowledge needed for intelligent conversation.

For example:

football tactics and possession structures;

NBA spacing and lineup questions;

NFL scheme and situational football;

baseball pitching, lineup and statistical concepts.

Sport competence should change what the character understands and notices, not necessarily who the character is.

Layer 6: Writing

The Writer creates the actual spoken language for the event.

This includes sport-specific vernacular, idiom, jokes, arguments and conversational rhythm.

Layer 7: Performance

Performance Direction controls pace, intensity, emphasis, pauses, overlap, nonverbals and other delivery behavior.

Provider-specific representation remains downstream.

Layer 8: Voice

The actual synthesized voice realizing the character.

This layered model should allow substantial reuse.

For example, a U.S. IQ personality could plausibly analyze NBA basketball one night and NFL football another while remaining recognizably the same person, provided sport competence and writing are correct.

10. Initial localization hypothesis

A plausible early creative system might eventually be:

UK Discuss ensemble

UK Debate ensemble

U.S. Discuss ensemble

U.S. Debate ensemble

This is not a locked requirement.

The important point is that sport should not automatically create a new cast.

The NBA and NFL should not get completely separate personality systems unless testing demonstrates that they need them.

Likewise, the existing Tully/Gaz/Simon personality architecture was intentionally written to be Premier-League-agnostic. A U.S. realization could use different names, voices, idiom and sports culture while preserving the underlying role/personality structure.

11. Personal feed, shared media

One of the strongest architectural/product principles is:

The feed can be personal while the media is shared.

The listener's feed is individualized.

The underlying audio usually is not.

If 2,000 people choose the same team, depth and show, they should all receive the same media object.

A user-specific feed simply points at the appropriate shared editions.

This is bounded variation, not one-generation-per-user personalization.

That distinction is essential to the economics.

12. Demand controls cost twice

The system should avoid eagerly materializing unused inventory.

Demand controls cost at two separate levels.

Level 1: Team activation

Does this team need to be operationally prepared at all?

If nobody selects Augsburg, do not spend team-specific production effort on Augsburg.

Level 2: Edition generation

Once a team is active, which edition combinations actually have listeners?

If Knicks listeners currently occupy only:

Major Insights / Discuss

A Few Minutes / Discuss

Get Into the Details / Debate

then those are the editions worth producing.

Unused cells in the possible matrix do not need to exist.

This means the perceived product catalog can be much larger than the actually materialized backend inventory.

That is not deception.

It is demand-driven production.

13. The “substantial sports service” effect

From the consumer's perspective, The Desk should look and feel like a substantial sports service.

A user may see hundreds of selectable teams across supported competitions.

They do not need to know:

whether their team had another subscriber yesterday;

whether their selection triggered first-time team activation;

how many unused show/depth combinations exist;

whether a shared edition was generated for one listener or 5,000.

Those are implementation details.

The product promise is that any option shown to the user has been proven capable of activation and fulfillment.

Nothing should appear in the selectable catalog unless that capability has been validated.

14. Zero speculative production teams at beta launch

A serious beta operating hypothesis is:

At beta launch, zero production teams need to be pre-activated speculatively.

This does not mean the system is unproven.

The infrastructure, sport capability, league/source assumptions, show formats, voices, activation workflow and canonical walking skeleton must already be proven.

It means we do not spend production provisioning money preparing individual teams merely because we guess someone may want them.

The first beta cohort commissions the initial team map.

Example:

A beta user chooses their teams.

Their private feed is created immediately.

A short generic welcome item can appear immediately.

Any team not already operational enters the activation workflow.

Already-active teams require no additional team setup.

Once ready, normal post-event production begins.

Later users who select the same team inherit the already-completed team preparation.

Internally, teams may have activation states.

The user does not need to see them.

From the user's perspective:

I follow this team.

15. Immediate “Episode Zero”

An empty private feed is a poor first experience.

A tightly controlled generic welcome item could be generated immediately when the feed is created.

Illustrative behavior:

30–45 seconds;

identifies The Desk;

names the selected team;

identifies the chosen show/depth if useful;

explains that post-game shows will appear automatically;

may identify the first upcoming event only if reliable schedule data is already available.

This item should require little or no deep team knowledge.

Its primary jobs are:

prove the feed works;

make the product feel alive immediately;

teach the subscriber what happens next;

prevent team activation latency from appearing as product failure.

16. Team readiness vs sport/competition readiness

Demand-driven team activation does not eliminate all preparation.

The expensive work moves up one level.

Before a sport or competition can appear in the consumer catalog, The Desk must prove that an unseen team within that supported domain can be activated reliably.

That may require:

stable fixture/result access;

sport ontology;

data-provider coverage;

source-discovery strategy;

local-language handling;

rights/usage assumptions;

competition rules;

statistical conventions;

naming/entity resolution;

source quality expectations;

sport-appropriate Showrunner knowledge;

sport-specific audit/golden examples.

The real launch gate is therefore not:

“How many teams have we prebuilt?”

It is:

“Can we reliably take any selectable team from zero to production-ready within an acceptable cost and time window?”

This activation lead time and source-readiness certification may become one of the most important post-walking-skeleton tests.

17. U.S.-market orientation

The original European-football focus was shaped partly by the original distribution strategy and the founder's personal use case.

The stronger product thesis suggests a course correction.

The Desk is being built and initially marketed in the United States.

The launch catalog should therefore be evaluated as a U.S.-market sports product, not primarily as a European-football product for Americans.

This does not mean “U.S. sports only.”

The Premier League remains an obvious candidate because it preserves the original football use case and is relevant to the intended U.S. audience.

The initial catalog should be determined through research rather than habit.

Potential domains to investigate include:

NFL

NBA

MLB

NHL

MLS

Premier League

college football

Liga MX

other leagues where demand justifies the preparation cost

Supporting a sport is much more expensive than supporting another team within an already-supported sport.

Therefore, the first launch should not simply try to cover every sport.

A good strategy may be:

expose a broader candidate catalog in demand research/waitlist;

observe which sports and leagues prospective U.S. users actually choose;

build the smallest set of sport/competition capability packs that makes the multi-team proposition feel real;

allow demand to determine which teams inside those domains are activated.

18. Cross-language synthesis

Cross-language synthesis remains strategically important, but it should not automatically define the whole launch.

It may be an especially strong wedge for clubs where:

the listener is interested;

high-quality English coverage is thin;

the most useful local reporting and supporter discussion occurs in another language.

The Desk may have a genuine advantage where normal English-language sports media is sparse.

However:

cross-language sourcing increases rights and source-policy complexity;

output locale and source language must remain separate concepts;

the initial U.S. beta should not be distorted around the founder's personal European-club portfolio.

Cross-language capability should be preserved and tested, while actual launch emphasis follows demand.

19. Scaling economics

The earliest beta may scale approximately with user growth because new users may introduce many previously unseen teams and new edition combinations.

That relationship should improve as the catalog fills in.

Customer #1 selecting a new team may cause:

team activation cost;

first-time edition generation.

Customer #500 selecting an already-active team and already-generated edition creates little incremental editorial/generation cost.

Therefore, the meaningful scaling variables are:

new unique teams;

new occupied edition cells;

recurring event production for occupied cells;

distribution.

Not simply raw subscriber count.

Useful beta metrics will include:

unique teams per new user;

new team activations per new cohort;

listeners per generated edition;

concentration of demand across edition combinations;

cost per newly activated team;

cost per delivered edition;

human QA time per edition;

activation lead time;

event-end to READY time.

The dangerous case is a highly fragmented audience in which nearly every customer selects several obscure teams and rare edition combinations.

The beta should measure that rather than speculate about it.

20. Distribution

The current attractive model remains:

private/personal feed, shared media.

The user chooses their sports world once and episodes appear automatically in a podcast app.

A public canonical feed may still be useful for:

credibility;

sampling;

acquisition;

demonstrating quality;

providing one canonical edition that can be discussed/reviewed.

However, a public feed does not necessarily need to exist for every supported team.

A team can be supported inside the personalized product without being separately marketed as a public podcast.

Private RSS compatibility, authentication, token security, client behavior, analytics, revocation, payment integration and platform constraints require current research before being treated as solved.

21. Advertising and subscription

The current product shape may support a modest subscription because the customer is paying for:

automatic delivery;

breadth across several teams;

configurable depth;

useful analysis;

entertainment;

coverage that may not otherwise exist in convenient form.

The product should not assume that personalization automatically makes people more tolerant of ads.

A feed that feels personal may actually raise expectations around relevance.

Monetization remains downstream of editorial design.

Do not allow ad technology to define show pacing or editorial structure.

Exact free/paid boundaries remain open.

One plausible shape is:

public canonical content as a free/ad-supported demonstration;

personalized multi-team feed as paid;

paid feed potentially ad-free or lightly monetized.

This is not yet a locked model.

22. Editorial integrity across variants

Every edition must preserve the same upstream truth constraints.

Variants may:

select;

omit;

order;

compress;

expand;

phrase;

emphasize.

They may not:

invent claims;

create conflict unsupported by evidence;

strengthen a claim's confidence;

strip a necessary hedge merely to save time;

invent first-person experience or supporter identity.

A Debate show can be more argumentative.

It cannot be less factual.

A short edition can be more selective.

It cannot become more certain.

A long edition can go deeper.

It cannot pad itself by wandering outside the evidence universe.

23. Evidence maturity and speed

Speed remains useful, but the strongest product promise is not simply “fastest podcast.”

For a main team, same-night availability may support the “first listen” use case.

For secondary teams, an evidence-mature edition waiting the next morning may be more valuable than a rushed version.

The system should ultimately measure event-end to READY, but publication should depend on evidence maturity rather than an arbitrary stopwatch alone.

The product advantage is also unbundling:

even when human content exists quickly, the fan may not want to subscribe to a whole ecosystem of transfer shows, weekly banter and unrelated episodes merely to get one post-game analysis product.

The Desk gives them exactly that object.

24. Architecture alignment with the merged Foundation

The current Build 1 Foundation remains broadly compatible with this product direction.

Important existing properties:

immutable/versioned artifacts;

canonical hashes/fingerprints;

stable run-level show-config binding;

run/attempt separation;

Evidence Package persistence;

provider-call identity and concurrency controls;

append-only review/repair history;

privilege separation.

Current merged schema already allows one Evidence Package to be referenced by multiple program-run attempts, so one frozen evidence universe can support multiple logical editions.

Current Episode identity is tied to program_run_id, so distinct editions represented as distinct program runs do not inherently collide.

The likely conceptual model is:

same event
same frozen Evidence Package

→ program run A / config A → Episode A
→ program run B / config B → Episode B
→ program run C / config C → Episode C

Attempts remain retries/repairs of one stable run/configuration.

A different edition is not merely another attempt.

25. Configuration should remain flexible

Product dimensions such as:

runtime/depth profile;

ensemble/show profile;

output locale;

should be treated as configuration dimensions.

They should not automatically become new database columns merely because the product discussion has identified them.

show_config_versions already has a versioned, hashed canonical payload.

The preferred near-term approach is to keep these concepts explicit and typed inside configuration unless independent lifecycle, identity, querying or relational constraints later justify separate persistence.

The product model is still evolving.

Do not prematurely freeze today's UX hypothesis into schema.

26. Editorial and consumer domains must remain separate

A governing boundary should be:

Editorial artifacts never reference users, feeds, subscriptions or personal preferences.

Consumer configuration may point toward appropriate editions.

Editorial artifacts should never point back toward the consumer.

This preserves:

privacy;

reuse;

cacheability;

editorial integrity;

distribution portability;

the ability to change subscription/feed systems later.

Conceptually:

SPORTS KNOWLEDGE
→ PROGRAMMING
→ WRITING
→ PERFORMANCE
→ EDITION

CONSUMER PREFERENCES
→ DELIVERY SELECTION
→ PERSONAL FEED

The second system selects from the first.

It does not contaminate it.

27. Immediate engineering consequence

This product rethink should not derail the current implementation plan.

Build 1 Completion A

Continue:

fixture persistence;

minimal durable/re-entrant command runner;

idempotent retry;

concurrency protection.

Useful regression consideration:

explicitly prove that one Evidence Package can serve multiple distinct program runs with different show configs.

Do not build:

feeds;

subscriptions;

demand scheduling;

multi-show generation;

user preference tables;

bundles;

payment;

ads.

Build 1 Completion B

Continue:

isolated staging;

hosted error-tracking proof.

No product-pivot expansion.

Build 2

Still prove one canonical walking skeleton:

frozen Evidence Package → planning → writing → audit → performance → render → audio → READY

Use one canonical show/cast.

The purpose is still to prove that The Desk can make one genuinely good program.

28. What changes after the walking skeleton

The later roadmap should now treat several questions as first-class experiments.

Editorial feasibility

Can one frozen event understanding support:

different depth profiles;

genuinely different show grammars;

consistent factual integrity;

enjoyable output across those variants?

Character portability

Can the same role/personality architecture be realized across:

UK and U.S. markets;

multiple sports;

without requiring entirely new personalities for every sport?

Team activation

Can a previously unseen team within a supported domain move from:

zero → validated production-ready

quickly, cheaply and with minimal human intervention?

Demand activation

Can customer choices reliably commission:

team activation;

only the edition combinations actually needed?

29. Beta operating hypothesis

A possible beta sequence:

Pre-beta

prove infrastructure;

prove canonical show quality;

prove at least one end-to-end team activation workflow;

prove candidate sport/competition capability packs;

develop and test the initial show archetypes;

validate voice/cultural realizations;

research demand across candidate U.S.-market sports/leagues.

Beta opening

no speculative production teams need to be pre-activated;

invite a small first cohort, perhaps on the order of 100 users;

let users choose teams from the proven selectable universe;

let users choose coverage depth per team;

let users choose a show;

create the private feed immediately;

publish a generic welcome item;

activate any newly demanded teams;

generate only demanded edition combinations after events.

Beta measurement

Measure:

teams selected per user;

unique-team demand;

league/sport distribution;

depth chosen by team;

show preference;

how often the same edition serves many users;

listen-through;

repeat listening;

team/depth changes;

willingness to pay;

activation cost;

activation lead time;

QA burden;

correction rate.

The beta itself should act as the commissioning system for the early coverage map.

30. Product-research questions still open

The following are hypotheses, not decisions:

What are the final coverage-depth labels?

How many depth profiles should exist?

What target runtimes sit behind them?

What should the consumer-facing Discuss and Debate shows actually be called?

Are Discuss and Debate separate casts in practice?

Can any Anchor span both formats?

Does a Hang/companion show deserve to exist later?

How many market/cultural realizations are needed at launch?

Which sports and leagues belong in the first U.S. selectable catalog?

Does cross-language demand materially improve acquisition/retention?

How quickly can an unseen team be activated?

What team-activation cost is sustainable?

What percentage of potential edition combinations are actually occupied?

Does private RSS work well enough as the paid launch surface?

What public canonical feeds, if any, should exist?

What pricing model actually fits the value?

How much human QA is required before the system earns enough trust to scale?

31. Important operational and business blind spots

Before public beta or revenue, explicitly address:

employment/outside-activity and IP-assignment terms;

sports-data licensing;

source terms and scraping rights;

cross-language/cross-jurisdiction rights;

defamation/media-liability policy;

TTS commercial-redistribution and voice rights;

platform rules around AI-generated or mass-produced podcast content;

club/team trademark usage;

private-feed security and token sharing;

podcast-client polling behavior;

corrections after an enclosure has already been downloaded;

payment/tax/VAT obligations;

privacy and retention of team/listening preferences;

gambling-adjacency policy;

peak-event provider concurrency;

model/provider outages;

support ownership when a user reports an error;

accessibility and transcript publication.

32. Current product principles to preserve

The Desk is sports programming, not original reporting.

Do not imply firsthand attendance, access, sourcing or supporter identity that does not exist.

Programming is not summarization.

Entertainment is part of product correctness.

The user controls attention; The Desk earns that time.

Personal feed, shared media.

Demand activates cost.

Nothing appears selectable unless the capability to fulfill it has been proven.

Internal activation state is not a consumer concern.

Do not materialize teams or edition permutations without demand.

Sport knowledge and character personality should remain separable.

Writing owns spoken vernacular; Performance owns delivery behavior.

Personality may change how evidence is discussed, never what may legitimately be asserted.

Editorial artifacts remain independent of user/subscription data.

Do not hard-code today's product hypothesis into Foundation prematurely.

Finish the walking skeleton before building the consumer personalization machinery.

33. Current one-sentence thesis

The Desk helps sports fans follow more teams without adding more hours, while preserving the personality, conversation and entertainment that make sports talk worth listening to.

Consumer shorthand:

Follow more teams. Spend less time catching up. Enjoy doing it.
