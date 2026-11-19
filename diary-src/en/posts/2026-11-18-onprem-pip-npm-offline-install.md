---
title: "Getting Packages Into a Closed Network: pip and npm, Offline"
date: 2026-11-18T14:55:00+09:00
category: Notes
summary: "On an air-gapped network, installing packages usually breaks at the handover, not at the install. Three causes — transitive dependencies, OS/CPU/version tags, and install scripts that reach back out — plus pip's wheelhouse and npm's three carry-in methods, with real commands, real failure messages, measured sizes and a pre-handover checklist."
tags: [on-premise, airgap, pip, npm, offline, verdaccio, python, nodejs, notes]
lang: en
translationKey: notes-onprem-pip-npm-offline-install
layout: post
---

The first post said the model is the engine and the harness is the steering wheel. The third laid out the setup for keeping your hands on that wheel every day. But there is a place where that setup stops dead: a network with no internet. The model, the tools and the skills all ultimately arrive as packages, and if the packages cannot get in, everything prepared beforehand is standing still at the door.

These are notes on opening that door. Not a grand architecture, but a procedure: on a machine with internet, gather the packages and their dependencies into one bundle, carry that bundle across, and finish the install with nothing but the bundle. The `npx` skills story from [The Model Is the Engine, the Harness Is the Steering Wheel](/diary/en/posts/2026-11-18-harness-layer-concept-and-usage/) comes back here too — why that command stops on a closed network is part of this post.

The numbers below come from actually running it. On a Linux x86_64 machine, three lines of requirements produced 17 wheels, 8.7MB, and that wheelhouse installed into an empty virtual environment and imported cleanly. The examples are those values. Company network-separation policies and handover procedures differ, so follow your own rules; this post only covers the technical side.

## 1. Why offline installs keep breaking

### "Installing is copying" is the wrong model

Installing with internet is a machine that already works. `pip install fastapi` queries an index, picks candidates, resolves dependencies, and downloads the file that fits your platform. The process is so smooth that it looks like "fetching a package".

On a closed network that smoothness disappears. All that is left is a file. And when you copy that one file across, pip still wants to query an index, still wants to resolve dependencies, still wants to check it fits your platform. **If the package manager's work isn't finished in advance, a copied file does not become an install.** What breaks on a closed network narrows down to three causes.

### Cause ① Transitive dependencies don't come along

Three lines in `requirements.txt` almost never mean three packages. `fastapi` pulls `starlette`, `starlette` pulls `anyio`, `pydantic` pulls `pydantic-core`. `uvicorn[standard]` drags in `uvloop`, `httptools`, `watchfiles` and `websockets`.

With internet, the package manager resolves that chain. On a closed network there is nothing in the bundle to resolve against, so it stops where the chain breaks — and that point is usually a name you never wrote. In practice, three lines became seventeen.

### Cause ② OS, CPU architecture and version ride along as tags

A Python wheel's file name states its conditions. `uvloop-0.23.0-cp311-cp311-manylinux2014_x86_64.whl` means "usable only on Python 3.11, Linux, x86_64". When the conditions don't match, pip quietly drops the file from the candidates.

The trouble is that the result doesn't say "wrong platform". This is the actual message when a wheelhouse fetched for Python 3.11 is installed into a Python 3.12 environment.

```text
ERROR: Could not find a version that satisfies the requirement pydantic-core==2.27.2 (from versions: none)
ERROR: No matching distribution found for pydantic-core==2.27.2
```

It looks like the version doesn't exist — but the file for that version was filtered out by its tag. Read it as "the index must not have that version" and you can wander for a long time. Node is the same. Packages like `esbuild` and `sharp` fetch per-platform binaries as separate packages (`@esbuild/linux-arm64` and so on), so a cache built on one architecture is missing the package for another. And in that case the install itself succeeds — it breaks when you run the tool.

### Cause ③ Install scripts call the internet again

Even with every package file in the bundle, some packages run scripts during install. `playwright` checks for browsers, `sharp` for image libraries, `esbuild` for its platform binary, and anything using `node-gyp` looks for a compiler and headers. That step usually uses the network at install time.

Hence "all the packages are here but the install dies with a network error". What needed fetching wasn't a package — it was a **binary**.

### So change the order

The three causes reduce to one line: **if even one step still uses the network at install time, that is the step that breaks.** The fix is to move all of those steps to the internet side and make the inside use no network at all. That gives four stages: collect, seal, verify, install.

[![The package handover pipeline: collect outside, hand over through security, install offline inside](/diary/assets/images/2026-11-18-onprem-airgap-pipeline.png)](/diary/assets/images/2026-11-18-onprem-airgap-pipeline.png)

*Collect on the internet side, hand over through security review, install offline inside — with a manifest tying the two ends together.*

The important cell in that diagram is the middle one. A handover is not "moving things"; it is **making them verifiable**. One folder, one archive, one `sha256` list per file. With those three, verification and reproduction both finish at once. Scatter the files and bring them in one by one, and nobody can explain what came in.

## 2. pip: finishing the job with one wheelhouse

Python has a comparatively honest tool for this: `pip download`. It doesn't install; it gathers only the files an install would need. The folder that fills up is usually called a wheelhouse.

### Method ① `pip download` + `--no-index --find-links`

First, on the internet side, prepare the same `requirements.txt` the project uses. The example is the three lines actually used.

```text
fastapi==0.115.6
uvicorn[standard]==0.34.0
pydantic==2.10.4
```

Pinning versions with `==` matters. With a range (`>=`), a different day produces a different wheelhouse, and the result is not reproducible. "It worked last month" on the inside usually starts here.

Now download on the internet side. If the inside server's platform differs from your machine, name the target.

```bash
# if you are downloading on the same environment as the inside server, two lines are enough
pip download -r requirements.txt -d ./wheelhouse

# if the inside server is Linux x86_64 · Python 3.11, name the target
pip download -r requirements.txt -d ./wheelhouse \
  --platform manylinux2014_x86_64 \
  --python-version 3.11 \
  --only-binary=:all:
```

The moment you use `--platform` and `--python-version`, `--only-binary=:all:` becomes mandatory. Source distributions are not platform-neutral, and pip does not allow them here. Drop it without knowing that rule and you meet this message.

```text
ERROR: When restricting platform and interpreter constraints using --python-version,
--platform, --abi, or --implementation, either --no-deps must be set,
or --only-binary=:all: must be set and --no-binary must not be set.
```

The result:

| Item | Value |
| --- | --- |
| Requirements | 3 lines (`fastapi`, `uvicorn[standard]`, `pydantic`) |
| Wheelhouse | 17 files, 8.7MB |
| Actual install | Succeeded in an empty virtual environment; `import fastapi` confirmed |

Three lines becoming seventeen is normal. Writing that number down is the habit that matters: if the count drops on the next handover, something went missing.

Inside, turn off the index and use the folder as one.

```bash
pip install --no-index --find-links=./wheelhouse -r requirements.txt
```

`--no-index` means "look at no index at all"; `--find-links` means "look for files in this folder". Real offline install happens when both are present. With `--find-links` but no `--no-index`, pip tries to find a missing package in the index, the network is closed, and it dies on a timeout — because the package wasn't in the folder.

To pin hashes as well, add `--require-hashes`. The requirements file must carry `--hash=sha256:...`, and pip refuses to install if a file's hash in the wheelhouse differs. If you keep a wheelhouse for a long time, that one line is the last line of defence.

### Reading the three failure messages

Offline installs produce three kinds of message. Knowing which is which gives you the fix immediately.

**First, a tag mismatch.** The `No matching distribution found for pydantic-core==2.27.2` above. The file is there, the conditions don't match. Re-run `pip download` for the right platform, or check the actual tags with `ls wheelhouse | grep pydantic`.

**Second, missing build tools.** When pip meets a source distribution (sdist) it creates an isolated build environment and tries to install `setuptools` into it. With the index off, that fails too.

```text
ERROR: Could not find a version that satisfies the requirement setuptools>=40.8.0 (from versions: none)
```

Two fixes: add `setuptools` and `wheel` to the wheelhouse, or install with `--no-build-isolation` in an environment that already has the build tools. If you plan to run an internal mirror long term, the first is better — one wheelhouse finishes the job.

**Third, a version conflict.** Two versions of package A in the wheelhouse, or requirements disagreeing with what the wheelhouse holds. The wheelhouse is "that day's answer", so storing the lockfile from the day it was made alongside it reduces this confusion.

### Method ② An internal PyPI

Once carrying a wheelhouse around becomes frequent, keeping a repository is better. `devpi`, Nexus and Artifactory are the usual names, and the principle is the same: run a proxy repository inside that fetches external packages on your behalf, and point pip only at it.

The pip side is one file. On Linux it reads `/etc/pip.conf` (global), `~/.config/pip/pip.conf` (user), then `pip.conf` inside the virtual environment.

```ini
[global]
index-url = http://pypi.internal/simple
trusted-host = pypi.internal
timeout = 30
```

`trusted-host` is needed when the internal repository isn't HTTPS. With a certificate, pointing at it via `cert` is safer. The same settings can be made from the command line.

```bash
pip config set global.index-url http://pypi.internal/simple
pip config set global.trusted-host pypi.internal
```

In containers or CI, where a config file is awkward, use environment variables: `PIP_INDEX_URL`, `PIP_TRUSTED_HOST`, `PIP_NO_INDEX`. Precedence runs command line, then environment, then config file.

With an internal repository, the unit of handover changes from "project" to "package". A new project doesn't need to re-import packages the repository already holds. In exchange, somebody has to manage what came in and who approved it. That comes back in section 5.

[![Building a wheelhouse with pip download, installing with --no-index --find-links, and how to read wheel tags](/diary/assets/images/2026-11-18-onprem-pip-wheelhouse.png)](/diary/assets/images/2026-11-18-onprem-pip-wheelhouse.png)

*The collect-then-install flow on the left, and how to read a wheel's tag on the right.*

## 3. npm: no "gather it all" command, so three routes

### How it differs from pip

Python has `pip download`. Node has no built-in command that corresponds exactly. `npm pack` turns one package into a `.tgz`, but it doesn't gather a project's whole dependency graph at once. So in practice you pick one of three routes: move the cache, stand up a mirror, or move the install result whole.

The three are not better or worse; they are **different situations**. The answer depends on whether you are handing over one project once, whether several teams keep using it, and whether you can pin the target environment to a single machine.

### Method ① Carry the npm cache whole

The least work by hand. `npm ci` installs exactly what the lockfile says, so one run leaves the needed tarballs in the cache. Carry that cache folder across.

```bash
# outside — install exactly as the lockfile says, filling the cache in this folder
npm ci --cache ./npm-cache --prefer-online

# inside — install from the same cache without using the network
npm ci --offline --cache ./npm-cache
```

`--prefer-online` means "re-check upstream even if it is cached". On the internet side that is the safe option. Inside, the opposite: `--offline` declares "make no network requests at all", and if even one thing is missing from the cache it fails right there. Failing loudly instead of quietly is a feature.

Trying it with a project that had only `esbuild` and `chalk`, the cache came to 4.3MB, and an offline install in an empty folder that held only the cache succeeded. Two conditions apply.

- `package-lock.json` must be identical to the one used outside. A single character of difference and npm treats it as not in the cache and fails.
- The cache is content-addressed, so file names are hashes and no human can check them. Verification happens at the `sha256` and archive level instead.

One more trap. Per-platform packages (like `@esbuild/linux-arm64`) are cached **only for the environment that built the cache**. Carry the same cache to another architecture and the install succeeds — "added 2 packages" — and breaks when you run the tool. So verify an npm handover by **running** the result, not by the install message.

### Method ② A Verdaccio mirror

With several projects or several people, carrying a cache around hits its limit quickly. Then you stand up an internal npm registry. Verdaccio is a lightweight registry that runs from one config file, and the npm proxy repository in Nexus or Artifactory plays the same role.

The point with Verdaccio is to **separate filling it from using it**. Run Verdaccio outside, install through it, and the packages you needed accumulate in its storage folder. Carry that folder in and put it where the inside Verdaccio stores its data — and the inside has a repository that is already full.

```bash
# outside — installing through the internal registry fills its storage
npm --registry http://localhost:4873 install

# inside — from now on every install looks at the internal registry
npm config set registry http://npm.internal:4873
```

When authentication is needed, put the token in `.npmrc`. In a project file it can be committed to the repository, so keep it in the user's home `.npmrc` or in an environment variable.

```ini
registry=http://npm.internal:4873
//npm.internal:4873/:_authToken=${NPM_TOKEN}
strict-ssl=true
cafile=/etc/ssl/certs/internal-ca.pem
```

`cafile` and `strict-ssl` are where internal CA setups usually trip. Setting `strict-ssl=false` looks like the fastest fix, but that one line switches off verification for every install afterwards. Pointing at the CA path lasts longer.

### Method ③ Bundle node_modules

The fastest method, and the one that breaks most often. Finish installing on the outside, archive the result, unpack it as is.

```bash
# outside
tar -czf node_modules.tgz node_modules

# inside
tar -xzf node_modules.tgz
```

With no install step at all, nothing beats it for an air-gap demo. But all three conditions must hold: **same OS, same CPU architecture, same Node major version.** Change one and the symlinks in `node_modules/.bin` and the `.node` binaries disagree, and the error you get does not point at the cause.

In practice, use it for "demo where the target is one fixed machine" or "emergency recovery", not for day-to-day operation.

### The three methods on one page

| | Cache handover | Verdaccio mirror | node_modules bundle |
| --- | --- | --- | --- |
| Command | `npm ci --offline --cache` | `npm config set registry` | `tar -xzf` |
| What it needs | lockfile + cache folder | one server + storage | same OS · CPU · Node |
| Several projects | start over each time | fill once, keep going | start over each time |
| Where it breaks | different lockfile, different architecture | auth and certificate setup | platform mismatch |
| Good for | one project, once | several teams, ongoing | demos, emergency recovery |

[![Three npm offline patterns compared, and the npx workaround](/diary/assets/images/2026-11-18-onprem-npm-3ways.png)](/diary/assets/images/2026-11-18-onprem-npm-3ways.png)

*Cache, mirror and bundle side by side, with the `npx` fallbacks underneath.*

### Why `npx` is especially hard

The first post mentioned adding skills with `npx skills add https://github.com/cline/skills`. That command does not work as-is on a closed network. `npx` looks for the package **at run time** and fetches it from the registry, and `skills add` clones a GitHub repository. This is a case where the problem is execution, not installation.

Three workarounds. Pick by purpose.

**① Copy the folder in.** Clone the repository outside and copy only the skill folders you need into the agent's skills directory. The `cline/skills` repository was 38 skills, about 4.8MB — small enough that bringing the whole thing in and choosing what to use is better.

```bash
# outside
git clone --depth 1 https://github.com/cline/skills
tar -czf skills.tgz skills

# inside — for project-level use
cp -r skills/<skill-name> .cline/skills/
```

**② An internal Git mirror.** Swap the GitHub address for the internal mirror and the command stays the same. With many repositories and frequent updates, this is the only answer.

```bash
git config --global url."https://git.internal/gh/".insteadOf "https://github.com/"
```

**③ Offline execution.** If the package is already cached, `npx --offline` runs it without the network. It fails if the cache doesn't have it, so tools you use often have to be cached in advance.

## 4. Four traps that keep biting, and a pre-handover checklist

By now the procedure is in place. What actually eats time is not the procedure but the exceptions. Four of them.

| Trap | How it shows up | Why | How to block it |
| --- | --- | --- | --- |
| OS/CPU mismatch | "no version found" message, or a native module failing to load after install | Wheel tags and optional packages are split per platform | Record the target machine's `uname -m`, `python -VV`, `node -p process.arch` in the handover doc and match `--platform` |
| Missing transitive dependencies | Install stops on an unexpected package partway through | Only the packages you named were downloaded | Download from the whole lockfile and record the count. 3 lines becoming 17 is normal |
| postinstall / native builds | Install script fails looking for the network (`gyp ERR!`, `ECONNREFUSED`) | The package is there but browsers, binaries or headers are fetched separately | Install with `--ignore-scripts`, carry the binaries separately |
| `npx` and remote execution | One command just hangs (`404`, `fetch failed`) | It looks at the registry and GitHub at run time | Choose folder copy, internal Git mirror, or `--offline` |

### Handling postinstall in practice

The third trap needs technique more than explanation. Take it in this order.

1. Install the packages themselves with `npm ci --ignore-scripts`. This step uses no network.
2. Fetch the binaries needed at run time separately. For `playwright`, the browsers.
3. Re-run only the packages whose install scripts matter with `npm rebuild <package>`. If what they need is already local, no network is used.

`playwright` lets you move the browser path into an environment variable. Carry the folder the browsers were downloaded into, point at the same path inside, and you never have to run the install script again.

```bash
# outside — download the browsers into a chosen folder
PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright npx playwright install chromium

# after the handover, inside, use the same path
export PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
```

### The pre-handover checklist

Six checks before you file the handover request. I run this list in the same order every time I build a bundle.

1. **Is the lockfile committed?** Pinned values, not ranges. `==` in `requirements.txt`, `package-lock.json` for Node.
2. **Is the target platform written down?** OS, CPU, Python and Node versions. Get those four wrong and the rest doesn't matter.
3. **Are the build tools in the wheelhouse?** Add `setuptools` and `wheel` for the case where a source distribution turns up.
4. **Is there a manifest?** `sha256` per file, the date fetched, the platform. That is the basis for verification and reproduction.
5. **Did you install it somewhere clean?** An empty virtual environment, an empty `node_modules`. If it works there, it will work inside.
6. **Did it go through security and licence review?** The handover ends here. A technically perfect bundle that fails this step doesn't go in.

The manifest is simple enough to build like this. Even dozens of files fit on one page.

```bash
# build the manifest in the wheelhouse
cd wheelhouse
sha256sum *.whl > ../MANIFEST.sha256
echo "# files: $(ls *.whl | wc -l)" >> ../MANIFEST.sha256
cd ..

# verify the same way inside
cd wheelhouse && sha256sum -c ../MANIFEST.sha256
```

`sha256sum` treats lines starting with `#` as comments and skips them, so human-readable notes like the file count can live in the same file. If a single file changed while the archive was unpacked, this step catches it.

[![Top four air-gap handover failures as a checklist](/diary/assets/images/2026-11-18-onprem-pitfalls-checklist.png)](/diary/assets/images/2026-11-18-onprem-pitfalls-checklist.png)

*The four traps, why each happens, and the check that catches it.*

## 5. To think about: carry by hand, or run a private registry

By now the natural question is, "so how far should we automate this?" Rather than an answer, here is the material to judge with.

### Candidate 1 — hand over a wheelhouse and cache by hand

The lightest way to start. No server, no permissions, and you can do it today. The list of handed-over files becomes the record, which also helps an audit: you can show "what went into this deployment" as a file list.

The price is repetition. Every new project and every changed package means doing it again. It is human work, so eventually something is missed — usually discovered right before a deploy.

### Candidate 2 — run a private registry

Stand one up and the unit of handover changes from "project" to "package". A new project doesn't re-import what the repository already has. Version drift falls too, because everyone sees the same repository.

The price is operating it. A server, backups, certificates, access rights, and **a procedure for approving what comes in**. A mirror is a convenience, not a security control. Let it fetch anything from upstream and you have effectively run the internet into your closed network.

### Candidate 3 — overlap the two

The most common answer in practice. Keep an internal registry, but only load it from outside as **verified snapshots**. Day-to-day installs hit the registry; when a new package is needed you build a bundle, verify it, and load it. Handover records stay at bundle level and daily installs are automated.

The key to this arrangement is the boundary: not "anything in the registry may be installed freely" but "anything in the registry has already been approved". That approval happens when the bundle is built.

### Decision criteria

Three questions separate the candidates.

| Criterion | Question | Manual handover | Private registry |
| --- | --- | --- | --- |
| Frequency | How many times a month? | Rare favours manual | Frequent favours registry |
| Project count | How many share the same packages? | One favours manual | Several favour registry |
| Operating capacity | Is there someone to own a server and approvals? | Not needed | Needed |

If all three answers are "rare, one, nobody", manual handover is enough. If any answer is the opposite, that item is your moment to bring in a registry. Don't try to build a perfect mirror on day one; start with manual handover, and think about a repository the third time you fetch the same package.

### Five questions to answer yourself

1. **Can you state your internal server's OS, CPU and runtime versions in one line?** If not, the packages you fetch are already wrong.
2. **Do you know how many packages were in the last bundle?** If not, you won't know what went missing from the next one.
3. **Are any of your dependencies packages whose install scripts use the network?** `playwright`, `sharp` and `esbuild` are the usual suspects.
4. **Did you install it in a clean environment?** A bundle that only worked on a developer's machine has not been verified yet.
5. **Is there a record of who approved the handover?** If not, that bundle cannot be explained to the next person.

## To finish

Summed up:

- Offline installs break at the handover, not at the install. Transitive dependencies, platform tags, and install scripts calling out are the causes.
- Python builds a wheelhouse with `pip download` and installs with `--no-index --find-links`. Using `--platform` forces `--only-binary=:all:`.
- "No version found" usually means the tag doesn't match. Being able to read a wheel file name speeds up diagnosis.
- Node has no built-in gather command, so choose cache, mirror or bundle. The cache needs the same lockfile and platform; the bundle needs all three to match.
- `npx` looks at the network at run time. Work around it with a folder copy, an internal mirror, or `--offline`.
- A handover is making something verifiable: one folder, one manifest, one install rehearsal.

This post is less an introduction to tools than a record of where tools stop. A closed network isn't a special environment; it is the environment where everything we normally take for granted shows up at once. Once you have made the list of what is needed there, work on the internet side gets a little more solid too.

One thing to do today is enough. Open the `requirements.txt` and `package-lock.json` of the project you are on, and write the target environment's OS, CPU and versions at the top of the file. Those four lines become the blueprint for your first bundle.
