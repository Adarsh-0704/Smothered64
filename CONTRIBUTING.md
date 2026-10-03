# Contributing to Smothered

Thank you for contributing to Smothered.

This document describes the development workflow, repository structure, Git conventions, commit conventions, and pull request process used by the project.

The goal is to keep contributions consistent, easy to review, and safe to merge.

---

## Repository Structure

Smothered is organized as a monorepo using pnpm workspaces.

```text
smothered/
├── apps/
│   ├── web/                    # Frontend / website
│   └── backend/                # Backend application / server
│
├── packages/
│   └── engine/                 # Independent chess/game engine
│
├── package.json                # Root workspace configuration
├── pnpm-workspace.yaml         # pnpm workspace definition
└── CONTRIBUTING.md
```

### `apps/web`

Contains the Smothered website and frontend application.

```text
apps/web/
├── src/
├── public/
├── package.json
└── ...
```

The web application is responsible for the user interface and browser-specific functionality.

### `apps/backend`

Contains the backend application and server-side functionality.

```text
apps/backend/
├── src/
├── package.json
└── ...
```

Backend-specific functionality should remain here unless it is intentionally extracted into a reusable package.

### `packages/engine`

Contains the chess/game engine.

```text
packages/engine/
├── src/
├── package.json
└── ...
```

The engine is intentionally independent from the Smothered website and backend.

It should not depend on:

* React
* DOM APIs
* browser-specific APIs
* UI components
* website-specific state
* backend-specific functionality

The engine should contain reusable chess/game logic that can be developed and tested independently.

### Applications vs Packages

The general rule is:

> **Applications live in `apps/`. Reusable libraries live in `packages/`.**

An application is something that runs as part of the product, such as the website or backend.

A package is functionality that is intended to be consumed by one or more applications.

Do not move code into `packages/` simply for the sake of abstraction. A package should have a genuine reason to be reusable or independently maintained.

---

# Development Setup

## Prerequisites

Install:

* [Node.js](https://nodejs.org/)
* [pnpm](https://pnpm.io/)

Verify the installation:

```bash
node --version
pnpm --version
```

---

# Forking the Repository

Contributors should work from their own GitHub fork.

The repository workflow is:

```text
Main repository
      │
      │ fork
      ▼
Your GitHub fork
      │
      │ clone
      ▼
Your local repository
```

Create a fork of the Smothered repository on GitHub.

Then clone your fork:

```bash
git clone <your-fork-url>
cd smothered
```

---

# Git Remotes

Add the main Smothered repository as `upstream`:

```bash
git remote add upstream <main-repository-url>
```

Check your remotes:

```bash
git remote -v
```

You should have something similar to:

```text
origin    <your-fork-url>
upstream  <main-repository-url>
```

### `origin`

`origin` points to your personal GitHub fork.

You push your branches here.

### `upstream`

`upstream` points to the main Smothered repository.

You pull changes from here.

The normal relationship is:

```text
                    Smothered
                    upstream
                       │
                       │ fetch
                       ▼
                  Your local
                       │
                       │ push
                       ▼
                     origin
                  Your fork
```

---

# Installing Dependencies

From the repository root:

```bash
pnpm install
```

Because Smothered is a pnpm workspace, dependencies for the workspace can be installed from the root.

---

# Working on a Task

## 1. Update `main`

Before starting a new task, make sure your local `main` is up to date.

```bash
git checkout main
git fetch upstream
git merge upstream/main
```

If your fork's `main` also needs updating:

```bash
git push origin main
```

Do not start new work from an outdated `main`.

---

## 2. Create a Branch

Never work directly on `main`.

Create a new branch for your task:

```bash
git checkout -b feature/my-feature
```

Branches should describe the work they contain.

### Branch prefixes

| Prefix      | Purpose                  |
| ----------- | ------------------------ |
| `feature/`  | New functionality        |
| `fix/`      | Bug fixes                |
| `refactor/` | Code restructuring       |
| `test/`     | Tests                    |
| `docs/`     | Documentation            |
| `chore/`    | Maintenance and tooling  |
| `perf/`     | Performance improvements |

Examples:

```text
feature/threefold-repetition
feature/pgn-import
fix/rook-movement
fix/castling-rights
refactor/move-generation
test/repetition-detection
docs/contributing
chore/update-dependencies
```

A branch should normally represent **one logical task**.

Avoid branches containing several unrelated changes.

---

# Making Changes

Work normally on your feature branch.

Before committing, inspect your changes:

```bash
git status
```

Review the actual diff:

```bash
git diff
```

Make sure that:

* Only intended files have changed.
* No unrelated changes are included.
* Debugging code has been removed.
* Generated files are not accidentally committed.
* The implementation follows the existing project architecture.

Run the relevant tests, type checks, builds, and other project checks before opening a PR.

---

# Commit Conventions

Commits should describe a single logical change whenever practical.

Use the following format:

```text
type: short description
```

### Commit types

| Type       | Purpose                                        |
| ---------- | ---------------------------------------------- |
| `feat`     | New functionality                              |
| `fix`      | Bug fix                                        |
| `refactor` | Code restructuring without changing behavior   |
| `test`     | Adding or modifying tests                      |
| `docs`     | Documentation changes                          |
| `chore`    | Maintenance, dependencies, configuration, etc. |
| `perf`     | Performance improvements                       |

### Examples

```text
feat: add threefold repetition detection
```

```text
fix: correct rook movement on board edge
```

```text
refactor: simplify move history handling
```

```text
test: add repetition detection cases
```

```text
docs: add contribution guide
```

```text
chore: update workspace dependencies
```

Avoid vague commit messages:

```text
fix stuff
changes
update
work
final
```

A good commit should tell another developer what changed without requiring them to inspect the entire diff.

---

# Pushing Your Branch

Push your feature branch to your fork:

```bash
git push -u origin feature/my-feature
```

The branch will then be available on your GitHub fork.

---

# Pull Requests

Once your work is ready, open a Pull Request from your fork into the main Smothered repository.

```text
Your fork
└── feature/my-feature
          │
          │ Pull Request
          ▼
Smothered
└── main
```

Before opening the PR:

* Make sure the branch is based on the current `main`.
* Run the relevant tests/checks.
* Review your diff.
* Remove debugging code.
* Make sure unrelated files are not included.

---

# Pull Request Description

A PR should explain the change clearly.

A useful structure is:

```markdown
## What changed

Describe the implementation.

## Why

Explain the problem or requirement.

## Testing

Describe what was tested.
```

For example:

```markdown
## What changed

Added threefold repetition detection using Zobrist hashes.

## Why

The game needs to detect repeated positions according to
the rules of chess.

## Testing

- Added repetition detection tests
- Tested castling-right changes
- Tested en-passant changes
- Tested move undo/redo
```

If there are known limitations or follow-up work, mention them in the PR.

---

# Pull Request Size

Keep PRs focused.

A PR containing:

```text
feature + unrelated bug fix + UI redesign + dependency update
```

is difficult to review.

Prefer separate PRs:

```text
PR 1 → feature
PR 2 → unrelated bug fix
PR 3 → UI change
```

Small, focused PRs make it easier to understand and review changes.

---

# Code Review

Every PR should be reviewed before being merged.

Reviewers may comment on:

* Correctness
* Architecture
* Naming
* Readability
* Performance
* Testing
* Maintainability
* Unnecessary complexity

Code review is a collaborative process.

The purpose is to improve the code and catch problems before they reach `main`.

---

# Responding to Review Comments

If changes are requested, make them on the same branch.

For example:

```bash
git add .
git commit -m "fix: address review comments"
git push
```

The existing PR will automatically update.

There is no need to create another PR for review changes.

---

# Keeping a Branch Updated

`main` may change while you are working on your feature.

Update your branch using a merge:

```bash
git fetch upstream
git merge upstream/main
```

If Git reports conflicts, resolve them manually.

After resolving conflicts:

```bash
git add <resolved-files>
git commit
```

Then push your branch:

```bash
git push origin feature/my-feature
```

## Why merge?

The project uses a merge-based workflow for contributor branches.

This avoids rewriting existing branch history and means contributors do not need to force-push their branches.

Avoid:

```bash
git push --force
```

and:

```bash
git push --force-with-lease
```

unless a maintainer explicitly asks you to use them for a specific situation.

---

# After a PR Is Merged

Once your PR has been merged, update your local `main`:

```bash
git checkout main
git fetch upstream
git merge upstream/main
```

Delete the local feature branch:

```bash
git branch -d feature/my-feature
```

You can also delete the corresponding branch from your GitHub fork.

For your next task, create a new branch from the updated `main`.

---

# Working on the Engine

The chess engine is an important architectural boundary.

The intended dependency direction is:

```text
┌─────────────────────┐
│      apps/web       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  packages/engine    │
└─────────────────────┘
           ▲
           │
┌──────────┴──────────┐
│    apps/backend     │
└─────────────────────┘
```

Both applications may consume the engine, while the engine remains independent of the applications.

The engine should not import from:

```text
apps/web/
apps/backend/
```

Instead, application-specific functionality should depend on the engine.

This keeps the engine reusable and allows it to be developed independently from the website.

---

# Package Boundaries

Before creating a new package, consider whether the code actually needs to be shared or independently maintained.

For example, backend-only functionality can remain inside:

```text
apps/backend/
```

It does not need to become:

```text
packages/something/
```

unless there is a genuine reason for it to be a reusable package.

Likewise, frontend-specific functionality should normally remain inside:

```text
apps/web/
```

The purpose of the `packages/` directory is reusable functionality, not simply moving code out of an application.

---

# General Guidelines

## Do

* Keep branches focused.
* Write meaningful commit messages.
* Test changes before opening a PR.
* Review your own diff before requesting review.
* Keep PRs reasonably small.
* Explain non-obvious architectural decisions.
* Reuse existing abstractions where appropriate.
* Keep application-specific code inside the appropriate application.
* Keep reusable functionality inside packages.
* Preserve the independence of the chess engine.

## Avoid

* Committing directly to `main`.
* Mixing unrelated changes into a PR.
* Committing generated files unless they are intentionally tracked.
* Copying reusable logic between applications.
* Introducing unnecessary packages.
* Large formatting-only changes mixed with functional changes.
* Vague commit messages.
* Force-pushing contributor branches.
* Introducing circular or unnecessary package dependencies.

---

# Quick Reference

```bash
# Clone your fork
git clone <your-fork-url>
cd smothered

# Add the main repository
git remote add upstream <main-repository-url>

# Install dependencies
pnpm install

# Update main
git checkout main
git fetch upstream
git merge upstream/main

# Create a branch
git checkout -b feature/my-feature

# Check changes
git status
git diff

# Commit
git add .
git commit -m "feat: add my feature"

# Push
git push -u origin feature/my-feature

# After the PR is merged
git checkout main
git fetch upstream
git merge upstream/main
git branch -d feature/my-feature
```

---

# Contribution Principle

The basic workflow is:

```text
One task
   ↓
One branch
   ↓
Focused commits
   ↓
One Pull Request
   ↓
Code review
   ↓
Merge
```

Keep the workflow simple, keep changes focused, and preserve the boundaries between applications and reusable packages.
