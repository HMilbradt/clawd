# Clawd - Claude Code Orchestrator

A simple wrapper around the Claude Code CLI that orchestrates multi-phase project execution. Clawd generates a comprehensive project plan and then executes it step-by-step using Claude Code.

## How It Works

1. **Plan Generation**: Takes your prompt and generates a comprehensive markdown plan with phases and checklists
2. **Iterative Execution**: Spawns Claude Code instances to work on each step sequentially
3. **Progress Tracking**: Updates the plan file as tasks complete
4. **Completion Evaluation**: After each iteration, evaluates whether the project is complete
5. **Perpetual Mode** (optional): When complete, researches and adds new features to continue indefinitely

## Installation

```bash
npm install
npm link  # Make 'clawd' available globally
```

## Usage

### Start a New Project

```bash
clawd "Build a REST API with Express and PostgreSQL"
```

This will:
- Generate a `PROJECT_PLAN.md` in the current directory
- Begin executing each phase and step
- Log progress to console and `clawd.log`
- Continue until the project is complete

### Resume an Existing Project

```bash
clawd --resume "continuation prompt"
```

This will reload the existing `PROJECT_PLAN.md` and continue from unchecked items.

### Perpetual Mode

```bash
clawd --perpetual "Build a REST API with Express and PostgreSQL"
```

**Perpetual mode** runs indefinitely, continuously improving the project:
- When the current plan is complete, Claude researches and specs out additional features
- New phases are automatically added to the plan
- Execution continues with the expanded plan
- Great for iterative development and continuous improvement

To stop perpetual mode, use `Ctrl+C`.

### Interactive Mode

```bash
# Start with interactive mode (prompt will be asked in-app)
clawd --interactive

# Or provide a prompt upfront
clawd --interactive "Build a REST API with Express and PostgreSQL"
```

**Interactive mode** enables a full Terminal User Interface (TUI) that allows you to control Claude while the program is running:

**TUI Features:**
- **Scrollable log area**: All output (Claude, logs, status) displays in a scrolling window
- **Status bar**: Shows current phase, iteration, and keyboard commands
- **Prompt counter**: Displays number of queued prompts
- **Loading indicators**: Visual feedback during plan generation and long operations
- **No console duplication**: Logs don't cause the interface to scroll or duplicate
- **Auto-detection**: Automatically loads existing PROJECT_PLAN.md if found

**Keyboard Commands:**
- Press `p` to queue a prompt for the next iteration
- Press `SPACE` to pause execution (shows menu: continue/prompt/quit)
- Press `ESC` to cancel the current running task (requires "yes" confirmation)
- Press `?` or `h` to show help
- Press `q` to quit
- Press `Ctrl+C` to exit immediately
- Use mouse wheel or arrow keys to scroll through logs

**Prompt types:**
- **Ask a question**: Query the current status, progress, or implementation details
- **Request a plan change**: Modify the existing plan (preserves completed tasks)
- **Add new scope**: Add new tasks or features to the plan
- **Provide guidance**: Steer the AI's approach for upcoming tasks

Prompts are queued and processed at the start of the next iteration (after the current Claude task completes).

Interactive mode can be combined with perpetual mode:
```bash
clawd --interactive --perpetual "Build a REST API with Express and PostgreSQL"
```

**Testing the TUI:**
```bash
node test-tui.js
```

## Project Plan Format

The generated plan follows this structure:

```markdown
# Project Brief
[Description of what needs to be built]

# Goal
[Clear end goal statement]

# Phases
## Phase 1: Setup
- [ ] Initialize project
- [ ] Install dependencies

## Phase 2: Implementation
- [ ] Create database schema
- [ ] Build API endpoints
```

## Logs

- **Console**: Colored output showing current progress
- **clawd.log**: Detailed execution log
- **clawd-error.log**: Error-specific log

## Architecture

- **bin/clawd.js**: Binary entry point
- **src/index.js**: CLI entry point using Commander
- **src/planner.js**: Plan generation and parsing
- **src/executor.js**: Phase execution loop
- **src/evaluator.js**: Project completion evaluation
- **src/expander.js**: Feature research and expansion (perpetual mode)
- **src/interactive.js**: Interactive prompting system (PromptQueue, keyboard listener)
- **src/tui.js**: Terminal User Interface using blessed (scrollable logs, status bar, prompt counter)
- **src/logger.js**: Winston logger configuration with custom TUI transport
- **prompts/**: Prompt templates for various operations

## Requirements

- Node.js (ESM support)
- Claude Code CLI installed and available in PATH

## Release Process

This project uses npm scripts to automate the release process.

### Scripts

- `npm run changelog` - Generate/update CHANGELOG.md from git commits and tags
- `npm run tag` - Create a git tag based on package.json version
- `npm run release` - Complete release: create tag, push tag to origin, and publish to npm

### Creating a Release

1. **Update the version** in package.json (or use `npm version`):
   ```bash
   npm version patch  # or minor, major
   ```
   This automatically runs the `changelog` script and updates CHANGELOG.md

2. **Review the generated CHANGELOG.md** to ensure it looks correct

3. **Commit the version changes**:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "Bump version to x.x.x"
   ```

4. **Log in to npm** (first time only):
   ```bash
   npm login
   ```

5. **Run the release script**:
   ```bash
   npm run release
   ```
   This will:
   - Create a git tag `vX.X.X` based on package.json version
   - Push the tag to the remote repository
   - Publish the package to npm

### Manual Release Steps

If you prefer to run steps individually:

```bash
# 1. Generate changelog
npm run changelog

# 2. Commit changes
git add CHANGELOG.md
git commit -m "Update changelog for vX.X.X"

# 3. Create and push tag
npm run tag
git push origin vX.X.X

# 4. Publish to npm
npm publish
```

### Changelog Format

The changelog follows [Keep a Changelog](https://keepachangelog.com/) format and automatically categorizes commits:
- **Added**: Commits starting with "add" or "feat"
- **Changed**: Commits starting with "update", "change", or "refactor"
- **Fixed**: Commits starting with "fix"
- **Other**: All other commits
# clawd
