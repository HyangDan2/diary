---
title: "Getting Started with Git: Your First Save, Your First Pull Request"
date: 2026-11-18
category: Notes
summary: "For anyone new to version control: Git's four everyday commands (add, commit, push, pull), the order branches and pull requests give a team, the three ways to merge, and five working habits — all with diagrams."
tags: [git, github, collaboration, workflow, notes]
lang: en
translationKey: notes-git-basics-for-beginners
layout: post
---

The first wall most people hit when they start writing code is Git. There are only a handful of commands, but every word is new: repository, staging area, commit, branch, merge, rebase. Translating the English into your own language doesn't help much either — the meaning still doesn't land.

This is a set of notes for getting over that wall in one go. Instead of memorising every command, it starts with **why the work happens in this order**, and keeps only what you actually need under your fingers. By the end you can run the whole loop on your own: save your work, cut a branch, and merge it back with a pull request.

## Why use Git at all?

Before Git, file management usually went something like this.

```
report.docx
report_final.docx
report_final(revised).docx
report_final_realfinal_v3.docx
```

The names get longer, and nobody can say for certain which one is current. You have to open a file to know, and opening it still doesn't tell you what changed. If someone deletes `v3`, the one sentence that only existed in `v3` goes with it.

Git is the way out of that hell. Instead of stacking full copies of files, it records **what changed, and why**, line by line. That makes three things possible.

- **You can go back to any moment.** Every commit is a photograph of the whole project at that time. If everything worked this morning and doesn't work now, you go back to this morning's photograph and look for the cause. No renaming copies to keep versions apart.
- **Several people can work on one project.** Each person works on their own branch, and the work is reviewed before it joins the rest. Because the record says who changed which line and when, "why is this code like this?" is answered by the history.
- **Experiments stop being scary.** If a new approach doesn't work out, delete the branch. `main` was never touched, so there is nothing to undo.

One distinction makes the rest easy. **Git is a program that runs on your computer**; **GitHub is a service that holds that record online.** Git alone is enough for working by yourself. GitHub is the layer on top that lets you share the history with a team, review it, and deploy from it.

## The four commands you can't avoid: `add` · `commit` · `push` · `pull`

Git is hard not because there are many commands but because **a file passes through four rooms**. Once you know where the rooms are, the commands follow naturally.

![The four-step saving flow, from your computer to GitHub](/diary/assets/images/2026-11-18-git-flow-4steps.png)

*Four rooms: working directory → staging area → local repository ⇄ remote, with `add`, `commit`, `push` and `pull` as the doors between them.*

- **Working directory** — the folder where you actually edit files. The one open in your editor.
- **Staging area** — where you pick the changes that go into this commit. `git add` puts them here.
- **Local repository** — the record inside your own machine, where commits pile up. `git commit` leaves a photograph here.
- **Remote** — the same record, living on GitHub. `git push` sends it up; `git pull` brings it down.

At first the staging area seems pointless. Why not save everything at once? Because `add` is what makes **one commit hold one change**. If you find a typo while fixing the login feature, you can stage the typo fix separately, and later revert only the login work while the typo fix stays. It is not a nuisance step; it is the device that makes undo possible.

### A terminal walkthrough you can follow in one sitting

This part is one-time setup. Your name and email are recorded with every commit, and the contribution graph and profile on GitHub are filled from that address.

```bash
git config --global user.name "Jane Doe"
git config --global user.email "jane@example.com"
git config --global init.defaultBranch main
```

Turn a project folder into a repository, and commit the first file.

```bash
mkdir my-project && cd my-project
git init

echo "# My Project" > README.md
git status                       # what changed?
git add README.md                # stage it (git add . for everything)
git commit -m "docs: add a project intro to README"
```

Create an empty repository on GitHub and send your work up. `-u` remembers this branch's default remote, so from then on `git push` is enough.

```bash
git remote add origin https://github.com/<username>/my-project.git
git push -u origin main
```

When you start work the next day, and whenever you want other people's changes, this comes first.

```bash
git pull
```

| Command | What it does |
| --- | --- |
| `git status` | Shows changed files and what is staged. The first thing to type whenever you are unsure. |
| `git add <file>` | Stages the change you chose. Use it right before committing. `git add .` stages everything. |
| `git commit -m "message"` | Turns the staging area into one record. Use it when one piece of work is done. |
| `git push` | Sends your commits to the remote. For sharing or backup. |
| `git pull` | Brings down the latest from the remote. Before you start work, and several times a day. |
| `git log --oneline --graph` | Shows the commit history one line at a time, branches drawn in. For when you want to see the shape. |
| `git restore <file>` | Throws away changes you have not committed yet. For undoing an accidental edit. |

## The working rhythm: protect `main`, work on a branch

Working alone, you can commit straight to `main`. The moment more than one person is involved you need one rule. **`main` always stays in a working state.** Deploys come out of `main`, and other people's work starts from `main`. If half-finished code lands in `main`, everyone builds on top of it.

So every piece of work gets its own branch.

![A team's branch and pull request workflow](/diary/assets/images/2026-11-18-git-branch-pr-workflow.png)

*A feature branch leaves `main`, is pushed and opened as a pull request, passes review and CI, merges, and is deleted.*

1. **Create a branch.** Start from the latest `main`, so merging later collides less.
2. **Commit in small pieces.** A commit should be small enough to explain in review.
3. **Push and open a pull request.** Push the branch, then ask GitHub to merge it into `main`.
4. **Let review and CI run, then merge.** Tests pass, a colleague approves, and it goes in.
5. **Delete the branch.** A merged branch has no reason to stay; keeping it only clutters the list.

Five lines when written down, but in practice it looks like this.

```bash
# 1. cut a working branch from the latest main
git switch main
git pull
git switch -c feat/login-ui

# 2. commit in small pieces
git add src/login.js
git commit -m "feat: validate email format in the login form"

# 3. push and open a pull request
git push -u origin feat/login-ui
```

`git switch -c` creates a branch and moves you onto it in one step. Older material shows `git checkout -b`, which does the same thing; recent Git recommends `switch`, which only deals with branches.

After the push, GitHub shows a `Compare & pull request` button above the repository. Set base to `main`, compare to the branch you just pushed, and open the pull request. Three things in the body make review faster.

- **What** changed (for anything visual, one screenshot)
- **Why** it changed (if there is an issue, `Closes #12`)
- **How you checked** it (which tests you ran, which paths you clicked through)

When the review approves and the CI badge turns green, merge. Teams often put protection rules on `main`. Switching on `Require a pull request before merging` and `Require status checks to pass` stops an accidental straight push to `main`, or a merge of code whose tests are broken. The button next to Merge lets you choose between merge styles — that is the next section. When the merge is done, press `Delete branch` on the page and tidy up locally as well.

```bash
git switch main
git pull
git branch -d feat/login-ui
```

Follow your team's branch naming, but prefixing the kind of work makes the list readable at a glance: `feat/login-ui`, `fix/header-overflow`, `docs/git-notes`. A branch should live a day or two. A branch that lives a week drifts away from `main` and comes back as a large conflict.

## The three ways to merge

When you merge a pull request, GitHub offers three styles. The result is the same — the code lands on `main`. What differs is **which history is left behind**.

![Merge, squash and rebase compared](/diary/assets/images/2026-11-18-git-merge-3ways.png)

*Merge keeps every commit, squash folds the branch into one commit, rebase replays the commits on top of `main`.*

| Style | Strength | Watch out for |
| --- | --- | --- |
| **Merge commit** | Keeps the whole working history; easy to revert a whole branch | The graph gets busy as pull requests pile up |
| **Squash and merge** | Keeps `main` clean; one revert undoes it all | The individual commits survive only in the pull request |
| **Rebase and merge** | Reads as a single line; each commit stays | Rebasing a branch someone else already has is dangerous |

**Squash and merge** folds "fix typo", "tests were broken", "review feedback" into one commit. `main` keeps a single commit such as `feat: validate email format in the login form (#23)`. If a problem appears later you revert that one commit, and `git log` stays readable. Nothing is lost, since the detail lives inside the pull request. If you are just starting out, make this your default: `main` stays clean even when your commit messages are not perfect.

**Merge commit** suits a long-lived feature branch, or merging work in release-sized pieces. Use it when you want to handle the whole branch as one block.

**Rebase and merge** suits someone who has kept each commit meaningful. There is one catch. Rebasing **replays** commits onto a different base, so the commit hashes change. If you rebase a branch you already pushed and a colleague has pulled, their history and yours disagree and you need a force push (`git push --force-with-lease`). Rebasing is safe only on **branches you have not shared yet**.

To put your branch on top of the latest `main`, do this. Doing it before you push keeps things tidy.

```bash
git switch feat/login-ui
git fetch origin
git rebase origin/main
```

## Five habits that keep a team out of trouble

Knowing the tool and working well with others are different problems. These five are habits that reduce accidents rather than rules.

**① Commit small, and often.** One commit, one change. If you bundle a login button, a typo fix and a settings change into one commit, a problem with the login takes all three down with it. Committing at every natural stopping point and pushing two or three times a day is safer than one big push at the end of the day.

**② Write commit messages that read at a glance.** Keep the first line under 50 characters and say **what happened**. `fix` or `update` tells nobody anything. Prefixing the kind of change (the Conventional Commits convention) makes the history far easier to read.

| Prefix | Use it for | Example |
| --- | --- | --- |
| `feat:` | A new feature | Validate email format in the login form |
| `fix:` | A bug fix | Error message disappeared after a failed login |
| `docs:` | Documentation | Add run instructions to README |
| `refactor:` | Same behaviour, restructured | Move auth logic into its own module |
| `test:` | Tests | Add a failing-case test for login validation |
| `chore:` | Config, dependencies, chores | Tidy up eslint rules |

If the reason for a change can't be read from the code, leave a blank line and explain in the body. Write it for yourself and your colleagues six months from now and it will be enough.

**③ `pull` before you start work.** Make `git pull` the first command of the day. Starting on top of yesterday's changes means you don't collide when you merge. `git pull` does two things at once: fetch the latest (`fetch`) and merge it into your branch (`merge`). If you dislike the tangled commits that produces, use `git pull --rebase`.

**④ Don't edit the same file at the same time.** Conflicts usually come from two people touching the same file, the same lines. Split ownership by file or folder, and if one large file has everyone's hands on it, split the file first. A single line — "I'm touching this file today" — cuts conflicts a long way. The same reason argues for merging often instead of keeping a branch alive.

**⑤ Don't panic at a conflict.** A conflict is not a failure. It is Git saying "a person has to decide which of these two changes stays". Take it in order.

```bash
git status
```

Open a file marked `both modified` and Git has marked both sides like this.

```
<<<<<<< HEAD
const timeout = 3000;
=======
const timeout = 5000;
>>>>>>> feat/login-ui
```

The `HEAD` side is the current branch (usually `main`); the lower side is the branch being merged in. Keep one, or keep both and rewrite them into something coherent. **The important part is deleting the `<<<<<<<`, `=======` and `>>>>>>>` lines.** Leave them in and the code breaks.

```bash
git add src/login.js     # stage the resolved file
git commit               # a commit if this is a merge (the default message is fine)
```

If the conflict happened during a rebase, use `git rebase --continue` instead of `git commit`. If you can't decide which side to keep, nothing is settled yet, so `git merge --abort` (or `git rebase --abort`) takes you back to where you were. Either way, run or test that part afterwards. Removing the conflict markers and the code working correctly are two different things.

## To finish: three lines to try today

Git is not memorised; it is worn in. You don't need every command from day one. Today, make a folder, start it with `git init`, edit a file, and get as far as `git add` and `git commit`. That is enough.

Tomorrow, start with `git pull`, cut a branch, push it and open a pull request — that closes the loop. From then on, open `git log` and the tables above when you need them. Most places people get stuck come from losing track of which of the four rooms their file is in. One `git status` answers most of that.
