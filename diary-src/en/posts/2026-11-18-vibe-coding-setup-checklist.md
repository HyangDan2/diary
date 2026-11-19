---
title: "Getting a Grip on the Wheel: Keeping Vibe Coding From Coming Apart"
date: 2026-11-18T14:05:00+09:00
category: Notes
summary: "Vibe coding is harder to sustain than to start. Context rot, silently broken features and secret leaks don't happen because the model is weak; they happen because verification, rules and permissions aren't layered underneath. Six setup steps — from a Git safety net to model and cost routing — plus a routine for each way things go wrong."
tags: [vibe-coding, ai-agent, cline, git, testing, guardrails, notes]
lang: en
translationKey: notes-vibe-coding-setup-checklist
layout: post
---

The first post said the model is the engine and the harness is the steering wheel; the second opened the engine to look at tokens, MoE and the thinking knobs. This one is about **getting both into your hands**. Even when you know what to build the harness from and where to put the model, if the setup isn't in place each morning the results drift again. It follows on naturally from [The Model Is the Engine, the Harness Is the Steering Wheel](/diary/en/posts/2026-11-18-harness-layer-concept-and-usage/) and [Under the Hood](/diary/en/posts/2026-11-18-llm-and-qwen-models/), though it reads as a checklist on its own.

Vibe coding usually starts well. A prompt into an empty folder and a screen appears in minutes. It falls apart afterwards: when there are thirty files, the conversation is past two hundred turns, and five features have been bolted on. That is when "it worked and now it doesn't" starts, when fixing one thing breaks another, and when you re-explain yesterday's rule today.

These are notes on getting past that point. Not a grand tool list, but six layers of safety that cost ten minutes on day one and save three days later.

## Why vibe coding comes apart in the middle

### Why the start goes well, and why it stops

The start goes well for a reason: the context is short, you can see the result with your own eyes, and there is nothing to undo. A wrong build means deleting the folder and starting over. While those three hold, the model's mistakes are almost free.

The stretch that comes apart is the exact opposite. The context is long, you cannot check the result by eye, and undoing needs a history. When all three fail at once, one small mistake eats three days. So reading the problem as "the model got dumber" doesn't help. You have to rebuild the three things that fell: **context, verification, permission**.

### Context rot — when the conversation stops being memory and becomes a junk drawer

A session looks like it gets more accurate as it grows, but there is a stretch where the opposite is true. Decisions made early and decisions changed later sit side by side, and failed attempts stay in the record.

For example:

1. "Let's use session cookies for login." → session cookie code goes in.
2. Three days later: "Actually, let's switch to JWT." → new code uses JWT.
3. But the middleware and tests that used session cookies stay as they were.
4. A week later the agent reads that middleware and starts reverting things "for consistency with the session approach".

The model didn't make a bad judgement. Two eras were living in one context with nothing marking which was current. In a long conversation the early part gets summarised or truncated, and what disappears first is usually **the rules you put in at the start**. Exactly as the first post said: forgetting rules isn't a diligence problem, it is the absence of a device that reinserts them every turn.

The signs that context has hit its ceiling are surprisingly clear.

- It confidently mentions a file or function that doesn't exist.
- It tries to fix code that was already deleted.
- It proposes an approach that just failed, with a small variation.
- It repeats the same mistake a second time.

See those signs and the session is already losing money. Resetting is cheaper than pushing on.

### Silently broken existing features

The second is the quiet regression. Adding a feature changes a function signature and updates three of five call sites. With no type checking, or `any` covering it, the build passes. The screen mostly works. What broke is the one path nobody clicked.

The problem is when you find out. Usually a user finds out, and the commit that caused it is twenty back. Even if you know `git bisect`, when one commit is 1,200 lines you can identify the cause and still not fix it — and you cannot revert it either, because other features have been stacked on top since.

So "it worked and now it doesn't" is not information about a cause; it is information about a result. Automated verification exists to reduce how often you hear it.

### Secrets and environment accidents

The third is the kind that happens once. The agent reads `.env` and hardcodes the values, a token ends up in an error log, and a migration runs against the production database because it looked local. The agent wasn't being malicious. The shortest path to following the instruction was that.

What characterises these accidents is that they are **irreversible**. Deleting the key from the commit history still leaves it in forks and caches. Revoking and reissuing comes before cleaning up. For this item only, pre-emptive blocking is the only answer; post-hoc response isn't.

### And diff creep

The last is quiet and the most common. "While I'm in here" attaches itself and the diff grows. Renames, folder moves and reformatting get mixed into a feature fix in one commit. Review becomes impossible, and a diff that can't be reviewed eventually merges as it is. Then, when something breaks, nobody can say what caused it.

All four reduce to one line: **the model does not know what it just broke.** To know, it has to run something; to run something it needs commands; and for a human not to type those commands every time, there has to be a loop. Setup is the work of laying that loop down in advance.

[![Unplanned vibe coding's failure loop versus the safe loop of plan, small change, automatic verification, review](/diary/assets/images/en/2026-11-18-vibe-coding-failure-vs-safe-loop.png)](/diary/assets/images/en/2026-11-18-vibe-coding-failure-vs-safe-loop.png)

*Left: guess, patch, break something else. Right: plan, small change, automatic verification, review.*

## The six-step setup checklist

The six steps have an order. ① to ③ reduce the **number** of accidents; ④ to ⑥ reduce their **cost**. Change the order and it gets less efficient: start with the verification loop and you are running tests without Git; start with model routing and you are paying for the expensive model without verification.

| Step | What | Minimum setup | Pass condition |
| --- | --- | --- | --- |
| ① Git safety net | Make failure free | Branch rules, small commits, deploy tags | `main` is always deployable |
| ② Context management | Move memory into files | `AGENTS.md`, `.cline/rules/`, reset signals | Back in context within 30s of a new session |
| ③ Plan, then act | Agree the scope before writing | A five-line plan, implement after approval | Zero files changed outside the plan |
| ④ Automatic verification | A machine checks instead of a person | One `verify` command, a real-screen check | A passing log exists |
| ⑤ Secrets and permissions | Block the irreversible | `.env` blocked, hooks, permission settings | The dangerous command stops before it runs |
| ⑥ Model and cost routing | More for the same money | Three task classes mapped to models | No big model on simple work |

### ① A Git safety net — make failure free

In vibe coding, Git is not a backup; it is **a permit to experiment**. When you are certain you can go back, you can try boldly and throw away quickly. When you feel you cannot go back, a person gets careful and the agent produces one large diff at a time.

Three minimum settings.

- **A branch per feature.** One purpose, one pull request. Name it so the scope is visible: `feat/login-jwt`. Two jobs on one branch and reverting becomes hard immediately.
- **Small diffs.** A commit must be reviewable in size. As a rule of thumb, past 300–400 lines people stop reading, and a review nobody reads is no review. Tell the agent in the rules: "if a change exceeds this size, split the work and report."
- **A revert baseline.** Tag the point where a deploy succeeded. When something goes wrong, `git revert` keeps history while undoing it. Experiments get thrown away with the branch. With those three, "try it and drop it if it doesn't work" actually becomes possible.

Tell the agent which Git commands not to use as well. `git reset --hard`, `git push --force` and `git checkout .` erase work silently. If a force push is truly needed, allow only `--force-with-lease` — and better still, write "fetch and rebase before pushing" into the rules. Avoiding a conflict is cheaper than covering one up.

Checking is simple. Is `git status` clean? Do the commits in `git log --oneline main..HEAD` each explain themselves in one sentence? If not, the branch is already too wide.

### ② Context management and pinned rules

The second is moving memory out of the conversation and into files. Conversations are finite; files remain.

**Rules live in files.** `AGENTS.md` at the repository root is the canonical one, and Cline also reads `.clinerules/` or `.cline/rules/`. As the first post laid out: what the team must do the same way goes into the repository, personal taste goes global.

Five things are enough for `AGENTS.md`.

```markdown
# AGENTS.md

## Stack
Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · pnpm

## Commands
- Dev: pnpm dev
- Verify: pnpm verify   # lint → typecheck → unit → build
- Deploy: GitHub Pages on merge to main

## Map
- app/ routes, components/ UI, lib/ domain logic
- Never call fetch directly outside lib/api.ts

## Red lines
- Never read or write .env*, production DB connection strings, or dist/ output
- legacy/ is read-only
- Migrations are added, never edited

## Commits and PRs
- feat: / fix: / docs: prefixes; one purpose per commit
- PR body carries "Verify: <command> → <result>"
```

Keeping it under 40–80 lines is better. Rules ride in every request, so length is cost, and the tail gets truncated as the conversation grows. Areas full of exceptions move into conditional rules: put a path pattern at the top of the file and the rule only switches on when you touch that path.

**Reset the session when the work changes.** A reset is not a loss; it is compression. Open a fresh session without hesitation when you see these signs.

1. The unit of work changes — login is done, next is payments.
2. You repeat the same mistake a second time. There will not be a third.
3. It mentions a file or function that doesn't exist — context has already drifted from the real code.
4. The diff grew past the size anyone can review — the conversation probably grew with it.

Opening a new session should not be scary, which means there should be nothing to lose. So decisions go into documents, not conversations: why this structure in `docs/adr/` or an issue, what's next in a TODO, why this change in the pull request body. Knowledge that lives only in the session is knowledge that is already gone.

[![Rules thinning and judgement drifting as a conversation grows, four reset signals, the pinned AGENTS.md structure](/diary/assets/images/en/2026-11-18-context-hygiene-and-session-reset.png)](/diary/assets/images/en/2026-11-18-context-hygiene-and-session-reset.png)

*Top: context grows, rules thin out. Middle: the four reset signals. Bottom: the fixed `AGENTS.md` structure.*

### ③ Separate planning from acting (Plan → Act)

The third is agreeing the scope before anything is written. Cline splits Plan and Act modes: in Plan it reads, investigates and designs; in Act it edits files. Other tools do the same thing by another name. The principle is the same: **put a human's confirmation between reading and writing.**

A plan doesn't need to be long. In fact, long plans go unread. Five lines is enough.

- Which files change, and why
- What will not change (the boundary)
- The effect on data, schema or API
- How it will be verified (command and expected result)
- How to undo it if something goes wrong

With those five lines, approval takes a minute. Without them it becomes "it'll figure it out", which is the same as giving up on verification.

There is a paradox here. Approve every tool call and people start ignoring them: a confirmation window that appears a hundred times a day gets clicked without being read. So put gates **only where things cannot be undone**. Let reads, test runs and local builds through; gate deploys, deletes, payments, outbound mail and production database access. The value of an approval lies in its position, not its frequency.

In rule form:

```markdown
- Before implementing, report the plan and the list of files to change, then wait for approval.
- If a file outside the plan turns out to be necessary, stop and report first.
- Never add a dependency without approval.
```

Some work can skip the plan: typos, colour values, copy changes — anything whose blast radius is obvious. The criterion is one question: **do I already know the blast radius?** If not, ask for the plan; if yes, let it be fixed.

### ④ The automatic verification loop

The fourth is letting a machine check instead of a person. Up to here the devices reduced accidents; from here they find them sooner.

Verification has an order. Run the cheap things first.

1. **Lint** — seconds. Style and obvious mistakes.
2. **Type check** — tens of seconds. Where missing call sites from a signature change get caught.
3. **Unit tests** — minutes. Regressions in domain logic.
4. **Build** — does it actually bundle? It works locally and fails to build more often than you would think.
5. **E2E** — three or four critical paths. Login, payment, save.
6. **A real-screen check** — after deploy: HTTP 200, images loaded, zero console errors, zero horizontal overflow.

The last item is the kind tests don't catch. I run the same list when publishing a post on this blog: response code, whether the four diagrams actually loaded, console errors, and no horizontal scroll at 1440px and 390px. It is no slower than looking, and it doesn't forget.

Ask the agent for **"it passed"**, not "I ran it". The difference is the exit code and the log. `pnpm verify` exited 0, and if something failed, the log is pasted as it is. Confidence is not evidence; an exit code is.

The command has to be in the documentation. An agent does not remember the script it wrote yesterday. Without the line "Verify: `pnpm verify`" in `AGENTS.md`, you re-explain how to run tests every session.

If the repository has no tests at all, don't build everything — start with a smoke test. Hitting five frequently used paths from one script catches half of all "it worked and now it doesn't" before deploy.

And when you meet a failure, reproduce it before fixing it. A reproduction script lets you confirm the fix; without one, all you have is the feeling of having fixed it.

### ⑤ Secrets and permission guardrails

The fifth is blocking what cannot be undone. Risk has three levels.

| Risk | Example | Response |
| --- | --- | --- |
| Read | Reading files, searching, checking logs | Let it through |
| Reversible write | Editing local files, pushing a branch | Let it through after automatic verification |
| Irreversible | Deploying, deleting, paying, sending mail or messages, production DB | Human approval + hook |

The strongest block is not a hook but **absence**. If production credentials are not in the environment the agent runs in, no prompt can use them. Rules are requests, hooks are devices, and the absence of a credential is a physical fact. Use the strongest of the three first.

Make `.env` unreadable and unwritable, and keep `.env.example` in the repository instead: only the names of the keys, with the values in environment variables. Mask anything that reaches a log. An agent opening `.env` "to check the configuration" is usually a convenience, and that convenience is where accidents start.

On top of that, overlap a hook. Check the command pattern just before the tool call, and stop it with exit code 2 if it is dangerous, handing back the reason.

```bash
#!/usr/bin/env bash
# PreToolUse: block irreversible commands before they run.
# stdin carries JSON such as {"tool_name": "...", "tool_input": {...}}
cmd=$(jq -r '.tool_input.command // empty')

case "$cmd" in
  *"rm -rf /"*|*"git push --force"*|*"git reset --hard"*)
    echo "Blocked: irreversible Git or delete command. Experiment on a branch and report." >&2
    exit 2 ;;
  *".env"*)
    echo "Blocked: .env is not read. Use .env.example and environment variables." >&2
    exit 2 ;;
  *"psql"*"prod"*|*"supabase db push"*)
    echo "Blocked: production DB work needs human approval." >&2
    exit 2 ;;
esac
```

Layer permission settings on top: Claude Code's `permissions.deny`, Cline's auto-approve scope, and the like. A hook blocks that one tool call; a command that does the same thing another way can pass. One layer is not enough — rules, hooks, permissions and a sandbox become useful together.

If an accident happens, keep the order. Revoke the key, reissue it, and only then look for where it was left behind. Assume that cleaning up history does not make you safe.

### ⑥ Model and cost routing

The sixth is getting more out of the same money. This is where the model characteristics from the second post multiply with the harness gates.

Work usually falls into four kinds.

- **Fixed-format repetition** — format conversion, matching test names, boilerplate. One correct answer.
- **Exploration and investigation** — reading thirty files to understand a structure. Read a lot, think a little.
- **Design and debugging** — finding a cause and comparing options. Read a little, think deeply.
- **Bulk classification and extraction** — hundreds of cases against the same criteria. Consistency and unit price matter more than peak accuracy.

Applying the second post's conclusions gives this. `Qwen3.8-27B` on a desk fits in one 24GB card at 4-bit, so it is the default for fixed-format repetition and local data work. `Qwen3.5-397B-A17B` on a server keeps 397B in memory and computes 17B per token, so cost per unit of throughput falls on long contexts, complex design and mixed multimodal work. Thinking is not a performance knob but **a risk knob**: where the answer is uniquely determined, low effort wins; where you are hunting a cause or choosing a design, high effort lowers total cost.

| Work | Model | Thinking | Harness gate |
| --- | --- | --- | --- |
| Formatting, renames, boilerplate | 27B (non-thinking) | Low | Automatic after verification |
| File exploration, structure | 27B or a small model | Low | Read-only, summarised report |
| Feature work (blast radius clear) | 27B (thinking medium) | Medium | Plan approval, then verify |
| Design choices, bugs with no known cause | 397B-A17B | High | Plan approval + human review |
| Bulk classification and extraction | 27B or small | Low | Sample review |
| Deploy, delete, pay, outbound send | Any | — | **Human approval required** |

Cost intuition is simple: tokens are the bill, and output costs more than input. Having a big model read thirty whole files during exploration is usually waste. Narrow the candidates with retrieval, then hand only the narrowed set to the big model.

One caution: split routing too finely and the management cost exceeds the benefit. Two or three tiers is enough — "light, proper, with a human" — with one model and one gate attached to each.

[![Routing matrix of models (small, high-performance, thinking) and harness gates by task difficulty and risk](/diary/assets/images/en/2026-11-18-vibe-coding-model-harness-routing.png)](/diary/assets/images/en/2026-11-18-vibe-coding-model-harness-routing.png)

*Task difficulty and risk mapped to model size and gate strength.*

The six steps on one page — laid out so it can be printed and used as a checklist.

[![The six-step setup checklist: Git, context, plan/act, verification, guardrails, model routing](/diary/assets/images/en/2026-11-18-vibe-coding-6step-checklist.png)](/diary/assets/images/en/2026-11-18-vibe-coding-6step-checklist.png)

*Six steps, minimum setup and pass condition for each.*

## Quick routines for when things go wrong

The six steps are what you keep in place. In practice they become urgently needed in three situations.

### Starting a new project — 10 minutes

In an empty folder, order matters: setup before code.

1. `git init`; put `.env*`, `node_modules/`, `dist/` in `.gitignore` (2 min)
2. The five sections of `AGENTS.md`, as much as you know now (3 min)
3. One verify command — a script that chains lint, types, tests and build (2 min)
4. Separate `.env.example` from the real `.env` (1 min)
5. Branch rules and commit prefixes (1 min)
6. First commit, and make the first request "propose a structure" (1 min)

The point is that first request. Before asking for a feature, ask once: "plan how you would proceed with this folder structure and verify command". The answer becomes the draft of `AGENTS.md`.

### Joining an existing repository — 20 minutes

An existing repository has different traps. Some of it was already broken before you arrived.

- **Check whether the build works right now.** If it doesn't, report that first and keep it separate from your work.
- **See whether there are tests, and how long they take.** Nobody runs a 30-minute suite.
- **Decide the paths you must not touch.** Build output (`dist/`, `build/`), `vendor/`, `legacy/`, migration history.
- **Find the deploy trigger.** In many repositories, a merge to `main` is the deploy.
- **Find where the secrets are,** and check whether the agent's environment can reach them.
- The first task is not code but **reading and summarising**. Take a structure summary and compare it with your understanding; where they disagree is the real danger zone.

### When something starts coming apart — 5 minutes

The most important routine. The order is the whole point.

1. **Roll back.** Go to the last commit where the tests were green. Don't try to fix it; get back to green first.
2. **Reset the session.** Fixing on top of polluted context makes the pollution worse.
3. **Split it.** If the diff is over 400 lines, divide it by purpose. Splitting alone often reveals the cause.
4. **Move it into a device.** If you made the same mistake twice, move it into one rule line or one hook. The third time is not carelessness; it is a missing piece of setup.
5. **Make a list.** Write down what is broken now from the user's point of view — "logging out when you refresh after login" — as symptoms. Causes come after.

| Situation | Time | First move | Don't |
| --- | --- | --- | --- |
| New project | 10 min | `AGENTS.md` and a verify command | Make the first request a big feature |
| Existing repository | 20 min | Check build and test state | Start editing code |
| Coming apart | 5 min | Roll back to the last green commit | Keep fixing with the same context |

## To think about: the one thing a person should hold

By now the natural question is, "so what should a human do themselves?" The more automation there is, the more this question matters. Rather than an answer, here is the material.

### Candidate 1 — scope, meaning what gets built

What to build is a product decision, not a matter of taste. A model follows requests well, but it is not good at not building what you didn't ask for. The moment "while we're at it" attaches itself the diff grows, and nobody reviews that diff. Hold the scope and the rest usually follows. Drop it and both verification and review lose their meaning.

### Candidate 2 — approval of irreversible acts

Deploying, deleting, paying, sending mail, changing production data. Those five land in someone else's hands. They cannot be undone, and once out they do not come back. What a person holds here is not judgement but **responsibility**. Some acts need a record of who pressed the button.

### Candidate 3 — what stays, meaning design decisions

Variable names can be delegated; boundaries cannot. What goes into one module, where dependencies sit, what gets thrown away. Those decisions are expensive to reverse and are closer to responsibility than taste. You don't have to hold all of them from day one — hold the ones that are hard to undo.

### One criterion

A criterion runs through all three: **is it irreversible, and is it responsibility rather than taste?** If both, a person holds it; if either is no, delegate it. With that one criterion you don't have to agonise each time.

### The trilogy compressed into a ten-minute first-day routine

| Time | What | What it produces |
| --- | --- | --- |
| 0–3 min | Draw the engine/harness boundary | The five sections of `AGENTS.md` |
| 3–6 min | Make failure free | Branch rules, one `verify` line |
| 6–8 min | Block the irreversible | `.env` blocked, one hook |
| 8–10 min | Choose the engine | Three task classes with default model and effort |

Those ten minutes change the next three days. They come before buying more tools.

### Five questions to answer yourself

1. **Can you state your repository's `verify` command right now?** If not, neither can the agent.
2. **Do you know when the last green commit was?** If not, going back is impossible.
3. **Did you make the same mistake twice this week?** If so, it is time to move it into a rule or a hook.
4. **Are you reading approval dialogs, or just clicking them?** If you just click, the gates are in the wrong places.
5. **Are you using the most expensive model on simple work?** One routing table fixes that.

## To finish

Summed up:

- Vibe coding comes apart not from the model's intelligence but from context, verification and permission collapsing.
- Git is a permit to experiment, not a backup. Being able to go back is what makes you bold.
- Memory belongs in files, not conversations. Knowledge that lives only in the session disappears soon.
- Get a five-line plan before anything is written. Put approvals where they matter, not everywhere.
- Run verification automatically from the cheapest step up, and ask for "it passed", not "I ran it".
- The strongest security is a credential that isn't there. Layer hooks and permissions on top.
- Choose the model by the difficulty and risk of the work. Thinking is a risk knob.

That closes the trilogy: what the harness is, how the engine works, and how to set both up every day. Next time I'll come back with a record of attaching real tools and turning the loop once on top of this setup.

One thing to do today is enough. Open `AGENTS.md` in the repository you are working in and write one verify command. That line is where the six steps in this post begin.
