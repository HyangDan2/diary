---
title: "The Model Is the Engine, the Harness Is the Steering Wheel"
date: 2026-11-18T13:10:00+09:00
category: Notes
summary: "An LLM is an engine that predicts the next token; the harness is the layer wrapped around it that lets the engine do real work. Rules, Skills, Hooks and MCP — what each one is for, where Cline keeps them globally and per project, and what to check before you install somebody else's skill."
tags: [harness, cline, ai-agent, llm, rules, hooks, notes]
lang: en
translationKey: notes-harness-layer-concept-and-usage
layout: post
---

You use the same model, and some days the results differ. One day the agent runs the tests on its own and finishes cleanly; another day it repeats the same mistake three times. You didn't change the model. What makes that difference is this post's subject: the **harness layer**.

The first thing people look at with an AI coding tool is the model name. Claude, GPT, Qwen. That matters, of course. But in real work, what decides the outcome is the thin layer on top of it. What goes into the prompt, which tools are allowed, which commands are blocked, which procedures are already prepared. This is a note on what that layer is made of and where it gets used, organised around concept and purpose. It is about **why you need it**, not about install commands.

## Why the model alone isn't enough

An LLM does exactly one thing. It reads the context in front of it and computes the probability of the next token. Push that definition to its end and a few things the model does not have become visible.

- **No memory.** When the conversation ends, nothing remains. Unless you tell the model today what you decided yesterday, it does not know.
- **No permission to act.** A model cannot write a file. It emits the text "edit this file", and a program outside the model does the editing.
- **No verification of its own output.** Whether the code compiles, whether the tests pass, is something you find out by running them. A model's confidence and its accuracy are separate things.
- **No consistency.** The same request gets slightly different answers depending on sampling. Keeping to a team convention the same way every time needs a device outside the model.

There is a common misunderstanding here: that writing a better prompt solves this. A prompt is a **request**. The model usually complies, but not necessarily. A harness is a **device**. A script runs just before a tool call, and if the exit code is not zero the call is cancelled. The difference between a request and a device is what makes results reproducible.

[![The layer diagram from user through harness to model and codebase](/diary/assets/images/en/2026-11-18-harness-layer-architecture.png)](/diary/assets/images/en/2026-11-18-harness-layer-architecture.png)

*User → harness → model, with the model reaching the codebase only through the harness's tools, rules and checks.*

So let me define the harness this way: **everything outside the model weights that controls what goes into the model and what the model does.** The rules carried in the prompt, the procedures it can load, the checks before and after execution, the connected tools, and the loop that brings results back into context. Think of a car: the model is the engine, and the harness is the steering wheel, the brakes and the dashboard. A powerful engine does not by itself get you to the destination safely.

## The four axes of a harness

A harness is not a large product. Usually these four things are the whole of it, plus the loop that manages context. Each axis differs in **when the model sees it**.

### Rules — the conventions that are always on

Rules are short instructions carried with every request. They record the things you want the model to know without being asked each time. Naming conventions, folder structure, how errors are handled, and red lines such as "never touch this path".

Cline reads rules from several places. In a project, a `.clinerules/` or `.cline/rules/` folder; globally, `~/Documents/Cline/Rules` (macOS and Linux) or `~/.cline/rules`. It also recognises `AGENTS.md`, which other tools share. Rule files are usually split one per concern.

```markdown
<!-- .clinerules/coding.md -->
# Code rules
- Do not turn off TypeScript strict mode.
- External API calls always go through src/lib/http.ts.
- The legacy/ folder is read-only.
- Commit messages use the feat:, fix:, docs: prefixes.
```

The strength of rules is simplicity, and the weakness is the same simplicity. Because they ride in every context, longer rules cost more, and short rules cannot cover exceptions. Cline softens this with **conditional rules**. Put a path pattern in frontmatter at the top of a rule file and the rule only turns on when a file under that path is in play.

```markdown
---
paths:
  - "src/components/**"
---

# Component rules
- Components are function components; no default exports.
- Styling uses Tailwind classes only.
```

The point is that documentation-style rules stop occupying context until you touch application code. Since the rules panel lets you switch each file on and off, you can put a strict testing rule aside while you experiment.

### Skills — procedure documents you take out only when needed

If rules answer "what do we keep to", skills answer "in what order". Work with several steps that changes often — deploying, migrating, writing release notes — is too long to put in rules. A skill keeps that procedure in a single `SKILL.md`, loaded **only when a related request arrives**.

```markdown
---
name: release-check
description: Use when preparing a release. Walks through bumping the version,
  writing the changelog, running tests and creating the tag.
---

# Release check

1. Bump the version in `package.json` and commit it.
2. In `CHANGELOG.md`, split this release into "changed / fixed / removed".
3. Run `npm ci && npm test`. If it fails, stop here.
4. `git tag v<version>` and push, then attach the test results to the release notes.
```

The mechanics are interesting. At startup Cline reads only the `name` and `description` of every skill — around 100 tokens each. If a request matches a description, the body of that `SKILL.md` is read then, and the body is recommended to stay under 5,000 tokens. So installing ten skills does not mean ten bodies sit in context. On the other hand, a poor description means the wrong skill gets pulled in, or none. Write `description` around **when to use it** rather than what it does.

You can also invoke a skill directly by typing `/` in the chat. Use that when you want to force a particular procedure instead of waiting for automatic matching.

### Hooks — automatic devices that step in before and after execution

Hooks do not go through the model's judgement. A program runs at a fixed point, first. That is what makes them fundamentally different from rules. A rule is read and, you hope, followed; a hook intercepts execution regardless of what the model decided.

[![Where hooks sit: prompt submission, tool execution, post-hoc verification](/diary/assets/images/en/2026-11-18-harness-hooks-lifecycle.png)](/diary/assets/images/en/2026-11-18-harness-hooks-lifecycle.png)

*A hook can fire at prompt submit, before a tool runs, after it runs, and at session end.*

The most widely used names are **PreToolUse** and **PostToolUse** — just before and just after a tool runs. Claude Code exposes hook events under those names, and a hook script receives JSON such as `tool_name` and `tool_input` on standard input. Exiting with code 2 cancels that tool call, and whatever you wrote to standard error is passed back to the model as feedback. The configuration looks like this.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "./scripts/guard-env.sh" }
        ]
      }
    ]
  }
}
```

`guard-env.sh` does something simple. It pulls the file path out of the input, and if it hits `.env` or `secrets/` it prints a reason and exits with code 2. The model receives the feedback "environment files cannot be edited directly" and looks for another way. No human has to say stop each time.

In Cline, intervention before and after tool calls comes from the SDK and CLI plugin lifecycle hooks (`beforeTool`, `afterTool`). It also reads the `~/.cline/hooks/` and project `.cline/hooks/` directories. Different agents use different formats, but the point itself — check just before running, verify just after — is nearly the same everywhere.

One thing to remember about hooks: a hook blocks **that tool call**. A command that reaches the same file another way can pass. So don't stop at one hook; overlap it with permission settings (`permissions.deny`) or a sandbox. A harness becomes useful when it has several layers, not one.

### MCP / Tools — the model's hands and feet

Tools are the only way a model affects the world. There are the basic ones — read a file, write a file, run a terminal command, search — and MCP (Model Context Protocol) is the standard channel for attaching outside services to them. Issue trackers, documentation stores, internal APIs and database queries become callable inside the same conversation.

In the Cline CLI, MCP servers are registered in `~/.cline/data/settings/cline_mcp_settings.json`, added through the `cline mcp` wizard or `cline mcp add`. Local servers connect through `command` and `args`; remote ones through `url`.

The important point is that a tool is a **channel**, not a capability. Opening channels is convenient, and every channel you open widens the surface where things can go wrong. So the harness decides which tools run automatically and which wait for a human. Read automatically, write and delete with approval, deploy not at all.

### And the context loop

The four axes turn one wheel. A request arrives, the rules and relevant skills ride along, the model picks a tool, a hook checks it, and the result comes back into context. The model nudges its own output as the loop turns.

The problem is that context is finite. As a conversation grows, the early part is summarised or truncated — and what disappears first is usually the rules you put in at the start. Forgetting rules in a long session is not a model diligence problem; it is the absence of a device that re-inserts them every turn. That is why people write a hook that re-injects the core rules right after compaction (the compact point of `SessionStart`).

The four axes in one table.

| Axis | When it enters context | What it holds | Without it |
| --- | --- | --- | --- |
| Rules | Always | What to keep to, red lines | Re-explaining every time |
| Skills | When a related request arrives | Multi-step procedures | Long procedures improvised on the spot |
| Hooks | Before and after tool calls | Checks, blocks, re-verification | A human finds the mistake afterwards |
| MCP · Tools | When the model calls them | Channels to the outside world | A narrow range of things it can read and fix |

## Where it actually gets used

The concept is enough by now. In practice you will reach for these four situations most often.

[![Four use cases mapped onto the four axes](/diary/assets/images/en/2026-11-18-harness-usecases-matrix.png)](/diary/assets/images/en/2026-11-18-harness-usecases-matrix.png)

*Team style, blocking dangerous work, self-verification, and outside tools — each leaning on a different combination of rules, skills, hooks and MCP.*

**1. Keeping a team's code style.** Making a new hire and an agent work to the same rules. Naming, folder structure, error handling and commit message format go into rules and get committed to the repository. Conditional rules per file type stop documentation rules from interrupting code work. The effect is quiet: fewer review comments saying "this isn't our convention".

**2. Blocking dangerous work.** Editing `.env`, connecting to the production database, `rm -rf`, force pushing. Things one accident can make permanent. Writing "don't" in a rule and blocking just before execution are different: the first is a request, the second is a device. Overlap tool permissions on top and you get three layers — a rule, a hook, and no permission to begin with.

**3. Self-verification of build and tests.** Run the tests right after an edit and hand the failure log back to the model. Nobody has to say "run the tests"; the model fixes its own work. There is one condition: the tests have to be fast. Running a ten-minute suite after every edit is not a loop, it is a halt. That is why teams keep a skill that runs only the relevant tests.

**4. Connecting outside tools.** Reading tickets from a tracker, consulting documentation, calling an internal API. With an MCP server attached, this happens without leaving the conversation. You do have to keep track of which server was given which permission. Tokens go in the MCP configuration's environment variables, not into the prompt.

## The harness inside Cline

Folder names differ between tools, but the structure is similar. In Cline, the harness is split in two places.

[![Cline's global and per-project harness layout](/diary/assets/images/en/2026-11-18-cline-harness-scope.png)](/diary/assets/images/en/2026-11-18-cline-harness-scope.png)

*Global `~/.cline/` for personal defaults, project `.cline/` for what the team shares.*

- **Global `~/.cline/`** — applies to every project. It holds `rules/`, `skills/`, `hooks/`, `workflows/`, `agents/` and `plugins/`, while API keys and MCP settings live under `~/.cline/data/settings/`. Personal taste and personal safety nets go here.
- **Project `.cline/`** — applies only to that repository. Same subfolders, plus `AGENTS.md` at the repository root and any existing `.clinerules/`. What the team keeps together lives here, **committed to the repository**.

When they conflict, workspace rules win. The global layer is the default; the repository is that project's answer. So the rule of thumb is simple. **Personal taste goes global; anything the team must do the same way goes in the repository.** Commit message format might be either, but the deploy procedure and the paths nobody may touch always belong in the repository.

One warning. Commit only what is safe to share — rules, skills. `~/.cline/data/settings/providers.json` holds API keys and must never reach a repository. Keep secrets in environment variables and leave only their names in the configuration.

## Before you install: what to decide first

By now the natural question is, "so where do I get good skills?" The command to add community skills already exists.

```bash
npx skills add https://github.com/cline/skills
```

The `cline/skills` repository publishes the skills Cline uses. Things like `review-team`, which splits code review across several sub-agents, `cline-sdk` for building agents with the Cline SDK, and `linear-sdk-scripting` for driving Linear from a terminal. `npx skills` fetches skills that follow the Agent Skills standard into each agent's skills folder, so the same command works for Claude Code and Cursor as well as Cline.

The command is one line, but there are things to think about before you type it. Installing is cheap; **the upkeep is paid in context and trust**.

- **Which rules and danger-blocking hooks does my project actually need?** One hook that blocks `.env` and three lines of commit rules come before ten skills. A harness is not a thing you improve by having more of it. It should fit the place that hurts now.
- **Where is the boundary between global and committed to the repository?** Without that boundary, teammates work with different harnesses and the difference shows up in review. Ask "is this my taste or the team's agreement" and the answer usually appears.
- **As skills accumulate, do their descriptions overlap?** Two skills with similar descriptions means the wrong one gets pulled in. Each time you add a skill, check once: which skill should this kind of request hit?
- **What can the harness not block?** A hook blocks a tool call, not another route to the same act. Know where permissions and the sandbox stop being responsible.
- **Did you review someone else's skill?** A skill body is a set of instructions your agent will follow. Read it before installing, the way you would read code. The same goes for files fetched with `npx`.

Once you have answers, the install order decides itself. Next time I'll write up the hands-on part: adding a real skill with `npx`, setting the global and repository boundary, and hanging one hook that blocks dangerous work.

## To finish

A harness is not a device for making the model smarter. It is a device for making the model's mistakes cheap. Accept that and design gets easier: leave what the model is good at to the model, and move what must hold onto a device.

One thing to do today is enough. Create a single rules file in the repository you are working in, and write down in three lines one mistake that hurt this week. Those three lines are the first layer of your harness.
