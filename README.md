# Clawd

**Clawd** is an intelligent orchestrator for the Claude Code CLI that transforms complex development tasks into automated, multi-phase project execution. It generates comprehensive project plans and executes them step-by-step, tracking progress and adapting along the way.

## Why Clawd?

If you're a Claude Pro subscriber using Claude Code, you've likely encountered these limitations:

- **💸 Claude API Not Included** - The Claude API requires separate payment and usage-based billing, even with a Pro subscription. Clawd leverages your existing Claude Pro subscription through Claude Code, so you're not paying twice.

- **⏹️ Claude Code Eventually Stops** - Claude Code has context limits and will pause execution, requiring you to manually reprompt it to continue. This interrupts your flow and requires constant supervision.

- **📝 Incomplete Task Execution** - Claude Code often completes part of a task but doesn't see it through to the end. You give it a complex request, it makes progress, then stops before finishing—leaving you to figure out what's left and reprompt.

- **🚀 Why Not Automate It?** - Clawd solves all of this by automatically breaking down your project into phases, executing each step, tracking completion, and reprompting as needed—all without your intervention. Set it and forget it (or watch it work in interactive mode).

In short: **Clawd lets you use your Claude Pro subscription to build entire projects autonomously**, without hitting API limits, manually reprompting, or babysitting incomplete executions.

## Features

- **🎯 Intelligent Planning** - Automatically breaks down complex prompts into structured, multi-phase project plans
- **🔄 Iterative Execution** - Spawns Claude Code instances to execute each task sequentially
- **📊 Progress Tracking** - Real-time updates to plan files with checkboxes showing completion status
- **♾️ Perpetual Mode** - Continuously researches and adds new features when projects complete
- **🖥️ Interactive TUI** - Full terminal interface with scrollable logs, keyboard controls, and live prompting
- **✅ Smart Evaluation** - Automatically evaluates progress and determines when projects are complete

## Prerequisites

- **Node.js** (v18 or higher with ESM support)
- **Claude Code CLI** - Must be installed and available in your PATH ([installation guide](https://docs.claude.com/en/docs/claude-code))

## Installation

```bash
npm install -g clawd
```

## Quick Start

The simplest way to use Clawd is to run it without any arguments:

```bash
clawd
```

This starts interactive mode where you'll be prompted for what you want to build. Alternatively, provide your project description directly:

```bash
clawd "Build a REST API with Express and PostgreSQL"
```

Clawd will:
1. Generate a `PROJECT_PLAN.md` with phases and tasks
2. Execute each task using Claude Code
3. Track progress with checkboxes
4. Continue until complete

## Usage

### Interactive Mode (Default)

Running `clawd` with no arguments starts the interactive Terminal User Interface:

```bash
clawd
```

**TUI Features:**
- Scrollable log area showing all output
- Status bar with current phase and keyboard shortcuts
- Prompt counter displaying queued prompts
- Loading indicators for long operations
- Auto-detection of existing `PROJECT_PLAN.md`

**Keyboard Commands:**
- `p` - Queue a prompt for the next iteration
- `SPACE` - Pause execution (shows menu: continue/prompt/quit)
- `ESC` - Cancel current task (requires confirmation)
- `?` or `h` - Show help
- `q` - Quit
- `Ctrl+C` - Exit immediately
- Mouse wheel or arrow keys - Scroll through logs

You can also provide a prompt upfront while staying in interactive mode:

```bash
clawd --interactive "Build a task management app"
```

### Standard Mode

Provide a prompt and let Clawd run autonomously:

```bash
clawd "Create a CLI tool for managing todos"
```

Output appears in the console and is logged to `clawd.log`.

### Resume Existing Project

Clawd automatically detects existing `PROJECT_PLAN.md` files. Simply run `clawd` in the same directory:

```bash
clawd
```

It will load the existing plan and continue from where you left off. You can optionally provide a continuation prompt:

```bash
clawd "continue with the authentication system"
```

### Perpetual Mode

Enable continuous development that never stops:

```bash
clawd --perpetual "Build a web scraper"
```

**How it works:**
- When the initial plan completes, Claude researches additional features
- New phases are automatically added to the plan
- Execution continues indefinitely with expanded scope
- Stop anytime with `Ctrl+C`

Combine with interactive mode for full control:

```bash
clawd --interactive --perpetual
```

## CLI Reference

### Command Format

```bash
clawd [prompt] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `[prompt]` | Project description (optional - omit to start interactive mode) |

### Options

| Option | Shorthand | Description |
|--------|-----------|-------------|
| `--interactive` | `-i` | Enable Terminal User Interface with keyboard controls |
| `--perpetual` | `-p` | Continuously add features after completion |
| `--help` | `-h` | Display help information |
| `--version` | `-V` | Show version number |

### Examples

**Start interactive mode:**
```bash
clawd
```

**Direct prompt execution:**
```bash
clawd "Build a URL shortener service"
```

**Interactive mode with prompt:**
```bash
clawd -i "Create a markdown blog generator"
```

**Resume with continuation prompt:**
```bash
clawd "add user authentication"
```

**Perpetual development:**
```bash
clawd -p "Build a weather dashboard"
```

**Interactive + Perpetual:**
```bash
clawd -i -p "Create a recipe app"
```

## Project Plan Format

Clawd generates plans in the following structure:

```markdown
# Project Brief
[Description of what needs to be built]

# Goal
[Clear end goal statement]

# Phases

## Phase 1: Setup
- [ ] Initialize project structure
- [ ] Install dependencies
- [ ] Configure environment

## Phase 2: Implementation
- [ ] Create database schema
- [ ] Build API endpoints
- [ ] Implement business logic

## Phase 3: Testing
- [ ] Write unit tests
- [ ] Add integration tests
- [ ] Perform manual testing
```

As tasks complete, checkboxes are automatically marked: `- [x] Completed task`

## Logs

Clawd maintains detailed logs for debugging and progress review:

- **Console/TUI** - Real-time colored output showing current progress
- **clawd.log** - Detailed execution log of all operations
- **clawd-error.log** - Error-specific logging for troubleshooting

## Architecture

Understanding Clawd's internal structure:

- **[bin/clawd.js](bin/clawd.js)** - Binary entry point
- **[src/index.js](src/index.js)** - CLI argument parsing and orchestration
- **[src/planner.js](src/planner.js)** - Plan generation and parsing logic
- **[src/executor.js](src/executor.js)** - Phase execution loop
- **[src/evaluator.js](src/evaluator.js)** - Project completion evaluation
- **[src/expander.js](src/expander.js)** - Feature research and expansion (perpetual mode)
- **[src/interactive.js](src/interactive.js)** - Interactive prompting system and PromptQueue
- **[src/tui.js](src/tui.js)** - Terminal User Interface (blessed-based)
- **[src/logger.js](src/logger.js)** - Winston logger with custom TUI transport
- **[src/git-setup.js](src/git-setup.js)** - Automatic git repository initialization
- **[prompts/](prompts/)** - Prompt templates for various operations

## Development & Publishing

### Setup for Development

Clone and link the package locally:

```bash
git clone <repository-url>
cd clawd
npm install
npm link
```

This makes the `clawd` command available globally from your local development copy.

### Testing

Run the test suite:

```bash
npm test
```

Test the TUI specifically:

```bash
node test-tui.js
```

## Contributing

Contributions are welcome! Please follow these guidelines:

### Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint. All commit messages must follow this format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` - A new feature
- `fix:` - A bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, semicolons, etc.)
- `refactor:` - Code refactoring without changing functionality
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks (dependencies, build config, etc.)

**Examples:**
```bash
git commit -m "feat: add perpetual mode for continuous development"
git commit -m "fix(tui): resolve scrolling issue in log display"
git commit -m "docs: update README with installation instructions"
git commit -m "refactor: simplify plan parsing logic"
```

**Scope** (optional) can be any component: `cli`, `tui`, `planner`, `executor`, etc.

### Commit Validation

Commitlint is configured with husky to validate commit messages automatically. If your commit message doesn't follow the conventional format, the commit will be rejected with a helpful error message.

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes following conventional commits
4. Run tests (`npm test`)
5. Push to your fork and submit a pull request

### Release Process

Clawd uses automated scripts for releases:

#### 1. Update Version

```bash
npm version patch  # For bug fixes (0.0.x)
npm version minor  # For new features (0.x.0)
npm version major  # For breaking changes (x.0.0)
```

This automatically:
- Updates `package.json`
- Generates/updates `CHANGELOG.md`
- Creates a git commit with the version bump

#### 2. Review Changes

Check the generated changelog:

```bash
cat CHANGELOG.md
```

Make any manual edits if needed, then commit:

```bash
git add CHANGELOG.md
git commit --amend
```

#### 3. Login to npm (First Time Only)

```bash
npm login
```

#### 4. Publish Release

```bash
npm run release
```

This will:
- Create a git tag (`vX.X.X`)
- Push the tag to the remote repository
- Publish the package to npm

### Manual Release Steps

If you prefer granular control:

```bash
# Generate changelog
npm run changelog

# Review and commit
git add CHANGELOG.md
git commit -m "Update changelog for vX.X.X"

# Create and push tag
npm run tag
git push origin vX.X.X

# Publish to npm
npm publish
```

### Available Scripts

- `npm run changelog` - Generate/update CHANGELOG.md from git commits
- `npm run tag` - Create git tag from package.json version
- `npm run release` - Full release: tag + push + publish
- `npm test` - Run test suite

## License

MIT
