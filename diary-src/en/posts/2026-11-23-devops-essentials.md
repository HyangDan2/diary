---
title: "DevOps Essentials — When You Need It, and What It's Made Of"
date: 2026-11-23T13:40:00+09:00
category: Notes
summary: "If you keep reciting build commands from memory, keep hearing 'it works on my machine', and keep learning about outages from your users, the signals are already there. Four signs it's time to start, six parts of a pipeline, four that actually run at HD2Lab, plus the DORA metrics and the official docs."
tags: [devops, ci, cd, github-actions, deployment, monitoring, notes]
lang: en
translationKey: notes-devops-essentials
layout: post
---

The most confusing thing about learning DevOps is the list of tools. Docker, Kubernetes, Terraform, Jenkins, Argo CD, Prometheus — more than twenty names before you understand any of them. The question that actually matters is not "what should I install" but **"what should I take out of human hands"**.

This note answers that in order. First the signals that say DevOps is worth starting; then the six parts of a pipeline, one at a time; then four pipelines that actually run at HD2Lab, written out as they are. The DORA metrics and the official documentation links are at the end. Choosing tools comes last.

## 1. DevOps is a sequence, not a toolchain

In one sentence: **DevOps hands the build, the checks, the deploy and the watching over to code and procedure instead of to somebody's memory.** Tools are how that sequence gets implemented.

The sequence has five steps. Leave a record, check the work, build it the same way every time, ship it, watch it.

| Step | What people used to do | What the pipeline does | What is still a judgement call |
| --- | --- | --- | --- |
| Record | Copy the folder and hope | Commit, branch, pull request | What belongs in one commit |
| Check | Open it and look | Type check, tests, lint | Fix it now or revert |
| Build | Everyone builds on their own machine | One build in a fixed environment | Version number, release notes |
| Deploy | FTP, copy, manual upload | The same steps, every time | When to ship |
| Watch | Wait for a user to tell you | Health checks, logs, alerts | What to do when the alert fires |

Look at the right-hand column. Automation takes the **memory** and the **repetition**; the judgement stays. Adopting DevOps does not remove decisions — it makes room for them. The minutes spent remembering which command came third turn into minutes spent deciding whether today is a good day to ship.

## 2. When to start — four signals

DevOps does not become necessary when a team gets big. It becomes necessary **the second time the same job is done by hand**. In practice the first signals look like this.

| Signal | What it looks like | What happens if you ignore it |
| --- | --- | --- |
| Manual build and deploy, over and over | Five commands in a deploy note; skip one and start over; every deploy comes out slightly different | Deploying becomes frightening, then rare, then a batch of changes at once |
| Environment mismatch | "It works on my machine", Node 18 on one laptop and 22 on another, no lockfile, paths that differ by OS | You spend time suspecting the environment instead of fixing the bug, and cannot reproduce it anyway |
| Users find the outages first | A message thirty minutes after a deploy, no logs left behind, the server is up but not answering | Trust erodes. Recovery time becomes reputation |
| Secrets mixed into the code | A committed `.env`, a token in the source, a deploy key with every permission | One leak stays in the history, and eventually everything gets rotated |

There are quieter signals too.

- There is an unspoken rule that nobody deploys on a Friday.
- Exactly one person can deploy. When they are away, nobody can.
- Rolling back means building the previous commit by hand.
- Every release needs a new checklist document, and one item is always missed.

The test is two questions. **Am I doing this job by hand for the second time? If it fails, would anyone know?** If either answer is yes, that is where to start.

[![Deploying by hand versus a pipeline: the same five steps, held together by memory on one side and by a file on the other](/diary/assets/images/en/2026-11-23-devops-manual-vs-pipeline.png)](/diary/assets/images/en/2026-11-23-devops-manual-vs-pipeline.png)

The other direction deserves saying too. A project that has never been deployed does not need a pipeline; the pipeline would be pure cost. Start when there is something to ship, when shipping repeats, and when the repetition starts to feel risky. That is not late.

## 3. The six parts

A pipeline is six parts. They have an order, and when an earlier part is missing the later ones lose their meaning. Automated deploys without tests are fast accidents; tests without a record are a passing grade nobody can reproduce.

[![The six parts: record, check, build and deploy in a line, with secrets and observability holding it up from above and below](/diary/assets/images/en/2026-11-23-devops-six-parts.png)](/diary/assets/images/en/2026-11-23-devops-six-parts.png)

### 1. Version control and branch discipline

Version control covers more than code. Workflow files, deploy configuration, documentation and small scripts all belong in the same history. That is how you can later retrace what changed and why things ended up this way.

Three rules are enough.

1. **`main` is always shippable.** Work happens on short branches and merges through a pull request.
2. **A commit is a unit you can undo.** Refactoring, a feature and reformatting in one commit cannot be reverted with a single `revert`.
3. **The message is for you in six months.** `fix(nav): stop the header from covering the first section` says what changed and why in one line.

```bash
git switch -c fix/header-overlap
# fix it, check it
git commit -m "fix(nav): stop the header from covering the first section"
git push -u origin fix/header-overlap
gh pr create --fill
```

A solo project still benefits from pull requests, not for review but **for the record**. The description is a note to your future self, and the PR is the unit you revert when something goes wrong.

The check is simple. Does `main` build right now? Can last week's change be undone with one `revert`?

### 2. CI — the checks run for you

CI means "when I push, someone else checks it". When there is no someone else, the machine does. The checks differ by project; the order does not. **Cheapest first.**

| Order | Check | Time | What a failure tells you |
| --- | --- | --- | --- |
| 1 | Type check, lint | seconds | Syntax, types, imports |
| 2 | Unit tests | tens of seconds | Regressions in calculation and state |
| 3 | Integration tests | minutes | Disagreement at the boundaries |
| 4 | End-to-end tests | several minutes | Behaviour in a real browser |

That first step has to finish within a minute, for psychological reasons. A failure you hear about quickly gets fixed; one you hear about an hour later arrives after you have started something else.

The minimum is one workflow.

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci          # install exactly what the lockfile says
      - run: npx tsc --noEmit
      - run: npm test
```

Use `npm ci`, not `npm install`. It installs from the lockfile without rewriting it. A lockfile that quietly updates inside CI is how you get a build that behaves differently there than anywhere else.

There are three common failures. A test that only fails in CI (timezone, network, execution order). A flaky test that gets retried until **the whole CI signal is ignored**. A push made without ever running the suite locally. The third one survives even after you adopt CI, and one rule prevents it: **never merge on a red build.** If it is urgent, fix the test, or file the failure and record the exception on purpose.

### 3. CD — automated deploy and rollback

The point of CD is not "automatic". It is **"the same way, every time"**. The artifact is built once and that artifact is what ships. The moment you rebuild locally and upload by hand, what you tested and what you shipped are two different things.

The method depends on what you are shipping.

| Target | How it deploys | How it stays up |
| --- | --- | --- |
| Static site | Upload the build output to Pages or a CDN | Files swap atomically; effectively no downtime |
| Container service | Build an image, push it, replace the running one | Rolling, blue-green, canary |
| Serverless | Deploy functions and configuration | Switch versions through an alias |

Rollback is half of CD. A deploy that is automatic while the undo is manual is only half done. The most dependable rollback is **a commit that reverts the previous one**, pushed through the same pipeline. Which makes "how long does a rollback take" the easiest question for measuring how mature a CD setup really is.

The deploy job should receive only a finished artifact. In GitHub Actions that boundary is `needs` plus an explicit permission block.

```yaml
  deploy:
    needs: build                 # a failed build never reaches this job
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
```

### 4. Environment isolation and declarative infrastructure

"It works on my machine" is an environment problem, not a code problem. Describe the environment in a file instead of in prose, and the file becomes a reproducible environment. The steps go like this.

1. **Pin versions** — `.nvmrc`, `engines` in `package.json`, `packageManager`.
2. **Commit the lockfile** — freeze what the install produced.
3. **`.env.example`** — list the configuration keys, without the values.
4. **A container** — a `Dockerfile` and `compose.yaml` pin the OS and runtime too.
5. **Declared infrastructure** — servers, DNS and storage written as code.

A static site does not need Kubernetes. GitHub Pages plus a pinned Node version is enough. A pipeline that has to compile native packages, on the other hand, is a case where a container is close to the only answer. Match the size of the tool to the size of the project.

"Declarative" means you do not log into the server and type commands. Work done by hand is not recorded, and the next person has no way to know it happened. Write it in a file and apply the file, and you never have to explain it twice.

Of the [Twelve-Factor App](https://www.12factor.net/) principles, three are usable today: configuration in the environment rather than in code, development and production as similar as possible, logs as a stream rather than a file.

The check: clone the repository onto a new laptop and build it within thirty minutes. Run the container and get the same result as local.

### 5. Secrets and least privilege

Secrets do not go in the code. They go in the repository's or the platform's secret store. `.env` is never committed; `.env.example` shares the key names only.

Workflow permissions are forgotten even more often. A GitHub Actions `GITHUB_TOKEN` has exactly the power listed under `permissions` in the workflow file. Say nothing, and it inherits the repository default — which is often wider than the job needs. Spelling out the minimum is the safer habit.

```yaml
permissions:
  contents: read    # read only
  pages: write      # only for the deploy job
  id-token: write   # OIDC to authenticate to Pages
```

A deploy token belongs to one repository, carries an expiry, and gets rotated on a schedule. A token that was already committed does not become safe when you delete it from the history: it is still readable wherever the history was copied, in forks and in caches. **Rotation is the only fix**, and rewriting history is the riskier move in a shared repository.

The fastest audit is one question. **Could this repository be public without a problem?** If the answer is no, what makes it no is your to-do list.

### 6. Observability and monitoring

Deploying is the start, not the end. You should be able to answer "is the service healthy right now" within thirty seconds, and a health check is what answers it.

A health check does not ask whether the process is alive. It asks whether the process **can do its job**: can it reach the database, are the required dependencies answering, is the queue backing up. An endpoint that only returns `200 OK` tells you nothing beyond "something is running".

Send an alert **only when the state changes**. The same alert ten times a day is the same as no alert at all — after ten of them, people stop reading and start deleting. The value of an alert is accuracy, not frequency.

Keep logs, but keep them readable. Request ID, status code, duration, and the dependency that failed. Those four on one line narrow down most incidents without anything else.

One last question. If something breaks at three in the morning, who finds out, and from what? If the answer is "nobody", the sixth part is missing.

### The six parts at a glance

| Part | Without it | Minimum | Comfortable |
| --- | --- | --- | --- |
| Record | Nothing can be undone | `main` plus short branches | Pull requests, tags, release notes |
| CI | Users find the regressions | Types and unit tests | Plus E2E, lint, bundle size |
| CD | Hand deploys, each one different | Build to Pages | Zero downtime, one-step rollback |
| Environment | Not reproducible | Pinned versions and a lockfile | Containers and declared infrastructure |
| Secrets | Leak risk | Secret store plus `permissions` | Rotation and automated scanning |
| Observability | Users report the outages | A health check and an alert | Metrics, logs, dashboards |

## 4. Pipelines that actually run at HD2Lab

I never built all six parts at once. They arrived one at a time, in the order they became necessary. Four of them run today; here they are as they are, rather than as a textbook would have them.

[![HD2Lab's pipeline map: push to Pages, plus a server check every ten minutes](/diary/assets/images/en/2026-11-23-devops-hd2lab-pipeline.png)](/diary/assets/images/en/2026-11-23-devops-hd2lab-pipeline.png)

### 4-1. Web-HQ snapshot — automation that does not wake itself up

This workflow rebuilds the "latest updates" list on the Web-HQ home page once a day, collecting twenty-eight days of public commit activity and the newest commits per repository into a single JSON file. Push alone is not enough: the code can stay the same while commits land in other repositories, so the list goes stale. That is why it also runs on a schedule.

```yaml
name: Refresh latest updates

on:
  push:
    branches: [main]
    paths-ignore:
      - "data/latest-updates.json"   # its own output must not retrigger it
  schedule:
    - cron: "20 15 * * *"            # 00:20 Asia/Seoul (cron is UTC)
  workflow_dispatch:

permissions:
  contents: write                    # it has to commit the snapshot

concurrency:
  group: latest-updates
  cancel-in-progress: false          # cancelling leaves a half-written file

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: node tools/build-latest-updates.mjs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Commit when the snapshot changed
        run: |
          if git diff --quiet -- data/latest-updates.json; then
            echo "Snapshot already current."
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data/latest-updates.json
          git commit -m "chore(data): refresh the latest updates snapshot"
          git push
```

Three safeguards are doing the work.

- **`paths-ignore`** — a push that only changes the snapshot file does not retrigger the workflow. A push made with `GITHUB_TOKEN` does not start a new run anyway, but the rule stops holding if the token changes or another automation touches the same file. Writing the intent into the file is safer than remembering it.
- **`concurrency`** — runs in the same group never overlap. `cancel-in-progress: false` because a cancelled run can leave a half-written snapshot behind. Queue them, do not cut them short.
- **The diff check** — nothing changed, nothing gets committed. An empty commit only lengthens the history and becomes the cause of the next trigger.

`cron` is read in UTC. `20 15 * * *` is 00:20 in Seoul. Without a comment, whoever reads this in six months will have to do the arithmetic at least once.

The rule I took from it: **if you do not design the exit condition, automation will call automation.** Any structure where a job reads a file it wrote needs a "only when it changed" condition.

### 4-2. PKPilot and ADOP0001 — types, units, E2E, Pages

The static web apps deploy to GitHub Pages. With no server, CD is simple, but the gate is clearer for it: an artifact that fails its tests has no route to Pages.

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true      # a newer deploy retires the older one

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit   # 1. types
      - run: npm test           # 2. units (Vitest)
      - run: npm run build      # 3. artifact
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

The gate runs `tsc` → Vitest → Playwright → Pages. Playwright is the **local pre-merge gate**, not a CI step. Installing browsers and driving a real screen costs minutes, so `npm run test:e2e` runs before the merge and CI guards against regressions through types and units.

That choice has a condition attached. As a team grows or releases become frequent, E2E belongs in CI too. When it moves, it needs sharding, screenshots and traces on failure, and a retry policy. Moving E2E into CI without those just adds a slow job that fails every so often.

Scripts differ a little between repositories, so it is worth checking where the gate actually lives.

| Repository | `build` script | Type check in CI |
| --- | --- | --- |
| PKPilot0013 (CodePlayground) | `tsc --noEmit && vite build` | Included in build; `npm test` still runs separately |
| ADOP0001 (青松館) | `tsc --noEmit && vite build` | The workflow also runs `npx tsc --noEmit` explicitly |
| PKPilot0018 (Sigrún) | `vite build` | Not in build, so a separate `typecheck` script |

When `build` includes the type check, CI cannot forget it. When `build` is only `vite build`, the type check can quietly go missing. "The tests passed but the deployed code has a type error" usually comes from that hole.

`concurrency` with `cancel-in-progress: true` is deliberate as well. On a site, the last commit should win. Letting an older deploy finish can put an older artifact live after a newer one.

### 4-3. Sigrún (PKPilot0018) — comparing against a reference written in another language

Sigrún does statistical calculation, and that brings a risk ordinary unit tests handle badly: **when you write the expected value by hand, the expected value can be wrong.** The suite passes and the answer is still incorrect.

So the check has two layers. The same request goes into two engines and the results are compared.

| Role | Implementation | How it is pinned |
| --- | --- | --- |
| Reference engine | Python (numpy, scipy, statsmodels, pandas) | Versions pinned in `requirements.txt` |
| Subject | The TypeScript engine that actually ships in the app | Built from the app source |
| Comparison | A per-case PASS / FAIL / ERROR report | The run fails on any FAIL or ERROR |

The reference is in another language on purpose. Build a verification tool in the same language and with the same library as the thing it checks, and the two **share the same mistakes**. If both produce the same wrong number, the comparison passes. Different stacks make that kind of collusion much harder.

CI runs it on every pull request and on every push to `main`. If regenerating the golden datasets produces a diff against the committed files, that fails too — which checks that the calculation is deterministic. The report is kept as an HTML and JSON artifact for thirty days, so a failure leaves behind which case was off and by how much.

This workflow **deploys nothing**. In the same repository, `deploy.yml` publishes to Pages and `qa-stats.yml` only checks. Their permissions differ for the same reason: the QA job has no `pages: write`, and that is intentional.

### 4-4. The personal server — every ten minutes, and only when the state changes

The last one watches a server. Its status page exposes its current state as JSON at `/api/status`.

```json
{
  "mode": "normal",
  "title": "자기야, 서버는 정상 운영 중이야 💜",
  "body": "연결 신호가 잘 들어오고 있어. 안심하고 이용해 줘!",
  "last_signal": "2026-11-23T03:13:24+00:00",
  "updated_at": "2026-11-23T03:13:40+00:00"
}
```

The wording comes from the API in Korean; the fields are the real payload. A watchdog calls that address every ten minutes, in five steps.

1. Request it and check for a 200 and a `mode` value.
2. On failure, wait two seconds and check once more.
3. Compare with the previous state.
4. If the state changed, record it and send an alert.
5. If it did not change, say nothing.

| Event | Condition | Alert |
| --- | --- | --- |
| `down` | Connection failed, not a 200, or broken JSON — twice in a row | No response from the server, with the time of the last signal |
| `outage` | `mode` is `outage` | The outage, with the title and body the API supplied |
| `maintenance` | `mode` is `maintenance` | Maintenance started |
| `recovered` | Back to `normal` from anything else | Recovered, and how long it lasted |
| No change | None of the above | No alert |

The second check exists to avoid false alarms. Waking someone at three in the morning over a single network blip costs that alert its credibility for good. Two more seconds is the better trade.

Storing the state **on the watchdog side** rather than on the server is deliberate too. Without knowing whether the last check was healthy, there is no way to detect a transition — and without transitions you either alert every time or never. Having the API supply the message text follows the same logic: fix the wording in one place and the watchdog repeats it.

## 5. What to look into next

### DORA metrics — the numbers that tell you whether delivery is healthy

DORA is a research program that measures software delivery performance, long known for four metrics. Today the model has five.

| Metric | What it measures | Which way is better | How to measure it solo |
| --- | --- | --- | --- |
| Deployment frequency | Deploys in a period | More often | Days you deployed this month |
| Change lead time | Commit to production | Shorter | Merge time minus deploy time |
| Change fail rate | Deploys that need immediate repair | Lower | Share of rollbacks and hotfixes |
| Failed deployment recovery time | Time from a failed deploy to recovery | Shorter | How long the revert took |
| Deployment rework rate | Unplanned deploys caused by an incident | Lower | Share of deploys made in a hurry |

The recovery metric used to be called MTTR, or "time to restore service". The new name, failed deployment recovery time, says more precisely what is being measured, because what counts as recovery depends on whether a deploy caused the incident at all.

These metrics are useful because they **hold each other in check**. Push deployment frequency alone and the fail rate rises; chase the fail rate alone and you stop deploying. DORA's long-standing finding is that speed and stability are not a trade-off.

The caution: make a metric a target and people optimise the metric. Set "thirty deploys this month" as a goal and you get thirty meaningless deploys. Use the numbers to see a trend and find the bottleneck, nothing more.

### Blue-green and canary

Two common ways to deploy without downtime.

| Method | How it works | Cost | Where it fits |
| --- | --- | --- | --- |
| Rolling | Replace instances one at a time | Low | Ordinary web services |
| Blue-green | Two full environments, switch traffic at once | Double the resources | Services that need fast rollback |
| Canary | Send a slice of traffic first, watch, then widen | Low, but more operational care | High-risk changes, high-traffic services |

None of this applies to a static site. Replacing whole files is already atomic, and a failure is fixed by deploying the previous commit. This table starts to matter when you run a server or an API yourself.

### Shift-left security

Moving security checks from after the deploy toward the commit. The further left they go, the cheaper the fix.

| When | Check | Tool |
| --- | --- | --- |
| Before the commit | Passwords and tokens that slipped in | `.gitignore`, pre-commit hook |
| Pull request | Vulnerable dependencies, code scanning, permissions | Dependabot, CodeQL, `permissions` |
| Build | Reproducible build, signed artifact | Lockfile, OIDC, SBOM |
| After the deploy | Anomalous behaviour | Logs, alerts |

Half of security incidents come down to "the permission was wider than it needed to be". Narrowing the token's scope is often the first job, ahead of writing better code.

### What HD2Lab should add next

- A post-deploy smoke test as the final workflow step. Right now a successful deploy is the end of the check.
- A Lighthouse performance budget. A bundle that grows a little at a time is hard for a person to notice.
- A sweep of workflow permissions in older repositories. The earlier a workflow was written, the more likely its `permissions` block is empty.
- Tidying the alert channels. Today only server state changes get through, and that is about right.

## 6. Official references

| Link | What to read it for |
| --- | --- |
| [dora.dev](https://dora.dev/) | Metric definitions, the capability catalog, the annual report |
| [Google Cloud — DevOps capabilities](https://docs.cloud.google.com/architecture/devops) | CI/CD, trunk-based development, small batches and the rest |
| [The Twelve-Factor App](https://www.12factor.net/) | Principles for configuration, environment parity and logs |
| [GitHub Actions docs](https://docs.github.com/actions) | Workflow syntax, `permissions`, `schedule`, caching |
| [Docker docs](https://docs.docker.com/) | Images, build cache, compose |

## Closing

DevOps is not something you install. It is **a sequence you decide on**. Tools fix that sequence in place; tools without a sequence are just one more thing to maintain.

The smallest useful first step is three things.

1. Add one workflow that runs the type check and unit tests on push.
2. Write your deploy steps in the README, then move them into a script. The next deploy runs the script, nothing else.
3. Add one address that reports the current state. `/api/status` or `/healthz` is enough.

After those three, the next thing to add becomes obvious. If deploying is frightening, add rollback. If users report the outages, add monitoring. If the environment keeps drifting, add a container. Set the order once, and the tools become a choice you make along the way.
