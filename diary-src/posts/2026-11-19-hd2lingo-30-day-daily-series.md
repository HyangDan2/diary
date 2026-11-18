---
title: "HD2Lingo's Daily Series: A Thirty-Day Wheel That Refuses to Repeat Itself"
date: 2026-11-19T03:45:00+09:00
category: Architecture
summary: "One English and one Japanese lesson a day, alternating intermediate and advanced, over a 30-topic cycle that flips difficulty each round. The curriculum arithmetic, the duplicate gate that can reject a lesson, and a nightly sync that rolls itself back."
tags: [hd2lingo, curriculum, content-pipeline, validation, systemd, architecture]
lang: en
layout: post
---

HD2Lingo started as a fixed course: `2.0.1`, three units, fifteen lessons, seventy-five questions per language, for English and Japanese. That course is published content, and its hashes, progress, and audio mappings are load-bearing — a learner halfway through unit two should never notice that the app grew a second product beside it.

The second product is a **daily series**: every day, one English lesson and one Japanese lesson, five questions each, alternating intermediate and advanced, on topics that rotate through a thirty-day wheel.

## Content in git, not in the database

The first decision kept the existing course safe: daily lessons are not rows in the database. They are JSON files under `content/daily/`, read-only, validated at load, and served as they are.

- No schema migration.
- No write to the production database when a lesson is published.
- A lesson that fails validation is dropped **by itself**, with the reason recorded, and the rest of the series keeps serving. A broken daily file can never take the Foundations course down with it.

The loader uses the same question schema as the newer course format, so a daily lesson and a course lesson are the same kind of object to the player: `match_pairs`, `assembly`, `choice`, a listening item with a two-speaker dialogue, and a closing topic question. Explanations are written in Korean, and every dialogue carries a `speech` mapping so the device's own text-to-speech can read it without recorded audio.

## The thirty-day wheel

`topics-30.json` is the rotation. Thirty topics across six domains — business, development and IT, travel and transit, daily and service situations, current affairs and culture, self-expression and reflection — five topics each. Every slot carries its day, category, the topic in three languages, a focus line, and **three angle variants**.

Thirty days later the wheel returns to the same topic, and the lesson is not the same lesson. The angle index is computed, not chosen:

```text
angle_index = (cycle - 1) mod len(angle_variants)
```

Cycle 1 covers a topic head-on. Cycle 2 takes a related but different situation — the same "hotel" slot that was a check-in becomes a problem to resolve at the desk. When every angle has been used, the validator refuses the next round until a new angle is written, which is deliberate: repetition should be a build failure, not a habit.

Difficulty is arithmetic as well.

```text
(day - 1 + cycle - 1) mod 2 == 0  →  intermediate
otherwise                          →  advanced
```

Because the cycle length is even, the same calendar day **flips level between rounds**: day 3 is intermediate in cycle 1 and advanced in cycle 2. A learner who keeps showing up alternates without the app having to track mastery to decide it.

## A gate that is allowed to say no

`validate_daily.py` runs over the daily files together with both `2.0.1` courses, and it treats these as errors:

- a repeated `lesson.id`, `lesson.title`, `question.id`, or `scenario_key` anywhere;
- a target or stimulus sentence that is already in the corpus, character for character;
- a topic returning in a later cycle with the same angle, the same scenario key, or the same key expression as last time;
- a mismatched `cycle` / `topic_day` / level calculation, a missing day, or English and Japanese disagreeing about which day exists.

Reusing an earlier angle is only a warning. Everything above fails the build. `--plan 30` prints the next thirty days — date, topic, level, angle, whether the dialogue is written — which is how the nightly writer knows what to produce next instead of guessing.

This is the part that took the longest to get right, because it is the part that decides whether the series is a curriculum or just a pile of lessons. A generator that can only append will drift into repeating itself within a month.

## Who the progress belongs to

The two series store progress differently, and that is a decision rather than an oversight.

- **Series 1** keeps its server-side runs and XP, exactly as before.
- **Series 2** keeps progress, XP, and review on the device, and uses the stateless scoring path in the protected entry point.

The reason is the publication gate. Daily content is reviewed when it merges into `main`; the app does not publish its own drafts. Keeping daily progress on the device avoids creating server attempt and content rows for material that is still moving through that gate. If daily progress ever needs to live on the server, it needs its own approval path — and that should cost something.

## The nightly sync, and why it rolls back

New lessons are written on a schedule and merged, and a small always-on server picks them up at 03:35, when nobody is watching. Everything in that script is built around the assumption that a failure at 03:35 has to heal itself.

1. `git fetch`, then **fast-forward only** — a local commit halts the run instead of producing a merge.
2. Validate the content. A failed validation exits before anything is swapped.
3. Replace the content directory **atomically**, keeping the previous snapshot.
4. Restart the service.
5. If the restart fails, **restore the previous snapshot automatically**.

Exit codes tell the operator what happened: nothing to do, content applied, validation refused, release required, or rolled back. `flock` prevents overlapping runs; dry-run, force, and keep-snapshot options exist for rehearsals. Code changes are not deployed by this job — it reports that a release is required, unless an explicit environment flag says otherwise, so a content sync can never quietly ship new application code. The systemd service and timer are pinned to `Asia/Seoul` with `Persistent=true`, so a missed 03:35 runs once the machine comes back rather than being skipped.

The rehearsal harness is the part I would keep from this work forever. It runs the script against a stub remote and a stub service and asserts six scenarios: no change skips, dry-run does not touch anything, apply restarts, a duplicate lesson is rejected with the live content unchanged, the snapshot is retained, and a failed restart restores the previous content.

## Verification

- `pytest`: 122 passed, with one failure in an unrelated pre-existing contract test against a sibling auth service.
- The rehearsal suite: all six scenarios pass.
- A local TLS harness (no nginx, no single sign-on) drove the real browser: Series 1 `2.0.1` still opens, Series 2 Day 1 in both languages runs every interaction type, the explanation modal answers on both the public and the protected entry points, no horizontal overflow at 320, 390, 768, or 1440, and zero console errors.
- `validate_daily.py`: 0 errors, 0 warnings.

Day 2 followed the next night and is a good example of the arithmetic doing the work: topic 2 is development, day 2 in cycle 1 is **advanced**, and the angle is *nitpick* — answering a small code-review comment politely. Five items in each language: vocabulary for `nit`, `non-blocking`, `LGTM`; assembling "I'll rename the variable so it's clearer."; choosing the reply that accepts the note without either pushing back or apologising for existing; hearing `a nit` in a two-person review exchange; and naming what the conversation ended up being about. Nothing in it repeats Day 1, and the validator can prove that.

## What remains

- Only Day 1 and Day 2 are written. The nightly job fills the wheel forward, one day at a time, and the plan output for tomorrow already names the topic, the level, and the angle.
- Content sync and application release are separate gates. Swapping daily lessons is automated; shipping new app code still requires a release and an approval. Until that release goes out, the daily series is complete in the repository and not yet visible to a reader.

## What I learned

- **Content and code move at different speeds, so they need different gates.** A nightly content swap that could also deploy code would be an automatic publisher of unreviewed changes.
- **A curriculum needs an explicit arithmetic.** Cycle, day, level, and angle computed from `(day, cycle)` means the writer never decides difficulty and the validator can always disagree with it.
- **A duplicate check is the curriculum.** Without the refusal path, "thirty topics" becomes "thirty headings and one lesson".
- **Automation at 03:35 must be able to undo itself**, because the person who would have fixed it is asleep.
