# Contributing to omtre

Thanks for your interest in contributing to omtre! This document provides guidelines for contributing to the project.

## Ways to Contribute

### Reporting Bugs

Before creating a bug report, please check [existing issues](https://github.com/ScoFan-official/omtre/issues) to avoid duplicates.

When reporting a bug, include:
- omtre version (`omtre --version`)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or screenshots

### Suggesting Features

Feature requests are welcome! Please open an issue with:
- Clear description of the feature
- Use case / problem it solves
- Any implementation ideas (optional)

### Improving Documentation

Documentation improvements are always appreciated:

- Fix typos or unclear explanations
- Add examples
- Improve README or guide docs
- Improve the Chinese documentation site under `docs-site/`

Read the [documentation contribution guide](https://scofan-official.github.io/omtre/resources/contributing.html) before adding or restructuring pages.

### Contributing Code

Code contributions are welcome for:
- Bug fixes
- New features (please discuss in an issue first)
- Performance improvements
- Test coverage

## Development Setup

### Prerequisites

- Node.js 18.17.0+
- pnpm
- Python 3.9+ (for hooks)
- Bash (for scripts)

### Getting Started

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/omtre.git
   cd omtre
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Build the project**
   ```bash
   pnpm build
   ```

### Running Checks

```bash
pnpm lint               # ESLint for TypeScript + legacy-name gate
pnpm --filter omtre lint:py # Type checking for Python (basedpyright)
pnpm typecheck          # TypeScript type checking
pnpm check:legacy-names # Brand/name gate
pnpm docs:verify        # Content, CLI-reference, quickstart and site build checks
```

> **Note:** Pre-commit hooks will automatically run `eslint --fix` and `prettier --write` on staged `.ts` files.

## Project Structure

```
omtre/
├── packages/
│   ├── cli/                # CLI binary, commands, configurators, templates
│   └── core/               # Channel/task/memory SDK bundled into the CLI
├── skills/                 # First-party skills
├── marketplace/            # Skills, spec templates, workflows, registry
├── catalog/                # Vendored catalog assets (do not patch in place)
├── .claude/                # Claude Code config (project's own) ←
├── .omtre/                 # omtre workflow (project's own) ←
├── docs-site/              # Chinese user documentation (VitePress)
├── docs/                   # Product and maintainer documentation
└── scripts/                # Repository tooling
```

> **Important:** When modifying `.claude/`, `.omtre/`, or `.cursor/`, check if the same changes need to be applied to `src/templates/`. The project uses its own config files, but templates are what gets installed to user projects.

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples:**
```
feat(cli): add --dry-run flag to init command
fix(hooks): resolve context injection for nested tasks
docs(readme): update quick start instructions
```

## Pull Request Process

1. **Create a branch** from `main`
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** and commit following the commit guidelines

3. **Ensure quality checks pass**
   ```bash
   pnpm lint && pnpm typecheck
   ```

4. **Push to your fork**
   ```bash
   git push origin feat/your-feature-name
   ```

5. **Open a Pull Request** against `main` branch
   - Provide a clear description of changes
   - Reference any related issues
   - Include screenshots for UI changes

6. **Address review feedback** if requested

## Releasing

Maintainers: see [docs/release.md](./docs/release.md) for the npm and GitHub
Release procedure, version policy, and token setup.

## Thank You

Every contribution helps make omtre better. We appreciate your time and effort!
