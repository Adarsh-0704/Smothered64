# Smothered

Smothered is a web-based chess project built as a TypeScript monorepo. The project contains the chess application, backend services, and reusable packages that make up the chess engine and shared functionality.

## Project Structure

```text
.
├── apps/
│   ├── web/                 # Next.js web application
│   └── backend/             # Backend application
│
├── packages/
│   └── chess/               # Reusable chess engine/library
│
├── package.json             # Root package configuration
├── pnpm-workspace.yaml      # pnpm workspace configuration
├── pnpm-lock.yaml           # Locked dependency versions
├── tsconfig.json            # Shared TypeScript configuration
├── .gitignore
├── README.md
└── CONTRIBUTING.md
```

### `apps/web`

The frontend application built with Next.js, React, and TypeScript.

It is responsible for the web interface and communicating with the backend and shared packages.

### `apps/backend`

The backend application.

Backend-specific functionality belongs here rather than in `packages/`.

### `packages/chess`

The reusable chess package containing the core chess logic.

This package is designed to be independent of the web application so that the chess logic can be reused by different parts of the project.

## Tech Stack

* TypeScript
* Next.js
* React
* pnpm workspaces
* Node.js

## Monorepo

Smothered uses **pnpm workspaces** to manage multiple applications and packages in a single repository.

The workspace is defined in `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Install all workspace dependencies from the repository root:

```bash
pnpm install
```

To install using the exact versions recorded in the lockfile:

```bash
pnpm install --frozen-lockfile
```

## Development

Run commands from the repository root unless otherwise specified.

To see the workspace packages:

```bash
pnpm list -r --depth 0
```

Individual applications and packages can also be run using pnpm filters.

For example:

```bash
pnpm --filter <package-name> <command>
```

## Packages

Workspace packages should be referenced through their package names rather than through relative paths between applications.

For example:

```ts
import { Game } from "@smothered/chess";
```

rather than importing directly from another application's source directory.

This keeps the boundaries between applications and reusable packages clear.

## TypeScript

Each application/package has its own `tsconfig.json`.

The root TypeScript configuration contains settings shared across the repository, while individual projects extend it and define their own environment-specific settings.

The Next.js application in `apps/web` retains its Next.js-specific TypeScript configuration.

## Chess Engine

The chess engine is maintained as a reusable package under `packages/chess`.

Core chess functionality includes concepts such as:

* Board representation
* Pieces and positions
* Move generation and validation
* Move records and move history
* Applying and reverting changes
* Special chess rights
* Zobrist hashing
* Position repetition detection

The engine should remain independent from UI-specific code.

## Git Workflow

Development follows a feature-branch workflow.

Create a branch from the current base branch:

```bash
git switch -c feature/<description>
```

Make focused commits using conventional commit prefixes:

```text
feat:     new functionality
fix:      bug fix
refactor: code restructuring without behavior change
chore:    tooling, configuration, or dependency changes
docs:     documentation
test:     tests
style:    formatting/style-only changes
build:    build and compilation changes
```

Example:

```bash
git commit -m "feat: add threefold repetition detection"
```

Push the branch and open a pull request for review.

For the complete contribution workflow, including branching, rebasing, merge conflicts, and pull requests, see:

[`CONTRIBUTING.md`](CONTRIBUTING.md)

## Dependency Management

Dependencies are managed with pnpm.

The repository's `pnpm-lock.yaml` is committed to Git and should be kept in sync with dependency changes.

Do not manually edit the lockfile.

When dependencies change, run:

```bash
pnpm install
```

and commit the resulting `pnpm-lock.yaml` changes.

## Generated Files

Build output and generated files should not be committed.

Examples include:

```text
node_modules/
.next/
dist/
build/
coverage/
*.tsbuildinfo
```

See the root `.gitignore` and application-specific `.gitignore` files for the complete list.

## Contributing

Contributions are welcome.

Before making changes, read [`CONTRIBUTING.md`](CONTRIBUTING.md) for the project's development and Git workflow.

The main principles are:

1. Keep changes focused.
2. Keep reusable logic inside `packages/`.
3. Keep application-specific code inside `apps/`.
4. Use clear commit messages.
5. Test changes before opening a pull request.
6. Keep pull requests reviewable and focused on one purpose.

## License

License information will be added when the project license is established.
