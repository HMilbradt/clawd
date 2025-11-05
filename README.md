# Clawd

**Clawd** is an intelligent orchestrator for the Claude Code CLI that transforms complex development tasks into automated, multi-phase project execution. It generates comprehensive project plans and executes them step-by-step, tracking progress and adapting along the way.

> **⚠️ IMPORTANT:** Clawd requires Claude Code to run with the `dangerously-skip-permissions` flag enabled. This allows Clawd to execute commands without manual approval prompts. **Use at your own risk** - only run Clawd in trusted environments and review the generated project plans before execution.

## Why Clawd?

If you're a Claude Pro subscriber using Claude Code, you've likely encountered these limitations:

- **🤖 Automation** - Clawd automates the entire project execution process, from planning to completion.  You can set it and forget it, or watch it work in interactive mode.

- **⏹️ Session limits and reprompting** - Claude Code will stop working if you hit the session limit, or if it decides it's finished it's task.  This requires manual intervention and loses valuable time.

- **💸 Claude API Not Included** - The Claude API requires separate payment and usage-based billing, even with a Pro subscription. Clawd leverages your existing Claude Pro subscription through Claude Code, so you're not paying twice.

- **📝 Incomplete Task Execution** - Claude Code often completes part of a task but doesn't see it through to the end. You give it a complex request, it makes progress, then stops before finishing—leaving you to figure out what's left and reprompt.

In short: **Clawd lets you use your Claude Pro subscription to build entire projects autonomously**, avoiding session limits, manually reprompting, or babysitting incomplete executions.

## Features

- **🎯 Intelligent Planning** - Automatically breaks down complex prompts into structured, multi-phase project plans
- **🔄 Iterative Execution** - Spawns Claude Code instances to execute each task sequentially
- **📊 Progress Tracking** - Real-time updates to plan files with checkboxes showing completion status
- **♾️ Perpetual Mode** - Continuously researches and adds new features when projects complete
- **🖥️ Interactive TUI** - Full terminal interface with scrollable logs, keyboard controls, and live prompting
- **✅ Smart Evaluation** - Automatically evaluates progress and determines when tasks are complete
- **🔔 Desktop Notifications** - Get notified when tasks complete, projects finish, or errors occur
- **🔌 Plugin System** - Extend Clawd with custom hooks and behaviors
- **📝 Configurable Prompts** - Override any prompt template to customize Claude's behavior
- **🌐 MCP Server** - Built-in Model Context Protocol server for programmatic access to Clawd (see [MCP Server Documentation](src/mcp-server/README.md))

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

This starts interactive mode where you'll be prompted for what you want to build. Alternatively, you can run in non-interactive mode by providing your project description:

```bash
clawd --non-interactive "Build a REST API with Express and PostgreSQL"
```

In both modes, Clawd will:
1. Generate a `PROJECT_PLAN.md` with phases and tasks
2. Execute each task using Claude Code
3. Evaluate task completion
4. Track progress with checkboxes
5. Continue until complete

## Architecture

Clawd follows a **Plan → Exec → Eval → Complete** workflow:

1. **Plan** - Initialize or load project plan, parse into tasks
2. **Exec** - Execute each task with Claude Code
3. **Eval** - Evaluate if task was completed successfully
4. **Complete** - When all tasks are done, evaluate if project is truly complete

Each step is hookable via the plugin system, allowing you to customize Clawd's behavior.  Each prompt is also customizable via the prompt system, allowing you to override any prompt to customize Claude's behavior.

## Core Concepts

### Project Plan

Every Clawd project has a project plan stored in the current working directory as `PROJECT_PLAN.md`.  This file is used to track the progress of the project and is updated as tasks are completed.  

When running Clawd in a new directory, Clawd will automatically create a project plan for you based on the prompt you provided.  When running Clawd in an existing directory, Clawd will load the project plan from the current working directory.

### Plugins

To customize Clawd's behavior, you can create plugins in `.clawd/plugins/` to hook into Clawd's lifecycle.  Create plugins in `.clawd/plugins/` to hook into Clawd's lifecycle:

```bash
clawd plugins create my-plugin
```

```javascript
// .clawd/plugins/my-plugin.js
export default {
  name: 'my-plugin',
  hooks: {
    'post:exec': async (context) => {
      // Run after each task execution
      console.log(`Task completed: ${context.task.description}`)
      return context
    }
  }
}
```

**Available hooks:**
- `pre:plan` / `post:plan` - Before/after plan initialization
- `pre:exec` / `post:exec` - Before/after task execution
- `pre:eval` / `post:eval` - Before/after task evaluation
- `pre:complete` / `post:complete` - Before/after project completion check
- `mcp:started` - When MCP server starts (receives `{ url, port, protocol }`)

### Configurable Prompts

Override any prompt by creating `.clawd/prompts/<name>.md`:

```bash
# Copy a prompt to customize it
clawd prompts copy plan-init
```

> **Important:** Clawd currently expects the plan-init file to be formatted as follows:

```markdown
# Project Brief
[Brief description of what needs to be built]

# Goal
[Clear statement of the end goal]

# Phases
## Phase 1: [Phase Name]
- [ ] [Specific actionable step with deliverable]
- [ ] [Specific actionable step with deliverable]
```

It's crucial for Clawd to be able to parse the plan-init file correctly, so that it can generate the project plan correctly and execute steps properly.  This will be improved in the future, but for now, please follow the format above.

## CLI Reference

### Main Command

```bash
clawd [prompt] [options]
```

**Arguments:**
- `[prompt]` - Project description (optional - you will be prompted if omitted)

**Options:**
- `-p, --perpetual` - Enable perpetual mode (continuously add features)
- `--non-interactive` - Disable terminal UI, use standard output
- `--no-notifications` - Disable desktop notifications
- `--no-notification-sound` - Disable notification sounds (notifications will still appear)

**Examples:**
```bash
clawd                                    # Interactive mode with prompt
clawd "Build a task manager"             # Direct prompt
clawd --non-interactive "Build an API"   # Non-interactive mode
clawd -p "Build a blog"                  # Perpetual mode
clawd --no-notifications "Build an app"  # Disable notifications
```

### Prompts Management

```bash
# List all available prompts
clawd prompts list

# Copy a specific prompt for editing
clawd prompts copy plan-init

# Copy all prompts
clawd prompts copy --all
```

### Plugin Management

```bash
# List loaded plugins and their hooks
clawd plugins list

# Create a new plugin from template
clawd plugins create my-plugin
```

### Project Initialization

```bash
# Initialize .clawd/ directory structure
clawd init
```

This creates:
- `.clawd/prompts/` - For custom prompt overrides
- `.clawd/plugins/` - For custom plugins

## Plugin Examples

### Git Plugin

Automatically commit after each successful task:

```javascript
// .clawd/plugins/git.js
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default {
  name: 'git',
  hooks: {
    'post:exec': async (context) => {
      if (context.exitCode === 0) {
        try {
          await execAsync('git add -A')
          await execAsync(`git commit -m "feat: ${context.task.description}"`)
          console.log('✓ Changes committed')
        } catch (error) {
          console.log('No changes to commit')
        }
      }
      return context
    }
  }
}
```

### Notification Plugin

Send notifications when tasks complete:

```javascript
// .clawd/plugins/notifications.js
import notifier from 'node-notifier'

export default {
  name: 'notifications',
  hooks: {
    'post:eval': async (context) => {
      if (context.result.complete) {
        notifier.notify({
          title: 'Clawd',
          message: `Task completed: ${context.task.description}`
        })
      }
      return context
    },
    'post:complete': async (context) => {
      if (context.isComplete) {
        notifier.notify({
          title: 'Clawd',
          message: '🎉 Project Complete!'
        })
      }
      return context
    }
  }
}
```

### Logging Plugin

Enhanced logging with timestamps:

```javascript
// .clawd/plugins/detailed-logging.js
import fs from 'fs/promises'

export default {
  name: 'detailed-logging',
  hooks: {
    'post:exec': async (context) => {
      const log = {
        timestamp: new Date().toISOString(),
        task: context.task.description,
        exitCode: context.exitCode,
        output: context.output
      }

      await fs.appendFile(
        'clawd-detailed.log',
        JSON.stringify(log) + '\n'
      )

      return context
    }
  }
}
```

## MCP Server

When Clawd starts, it automatically launches a Model Context Protocol (MCP) server that allows other applications to interact with Clawd programmatically. This is useful for:

- Building external tools that control Clawd
- Monitoring Clawd's progress from other applications
- Integrating Clawd into larger AI workflows
- Creating custom dashboards or interfaces

### Quick Start with MCP Inspector

Test the MCP server using the official inspector:

```bash
# Start Clawd in one terminal
clawd

# In another terminal, use the port number shown in Clawd's output
npx @modelcontextprotocol/inspector http://localhost:<port>/mcp
```

### Available MCP Tools

The MCP server exposes these tools:

- **get-status** - Get current execution status and progress
- **answer-question** - Ask questions about Clawd's state
- **queue-prompt** - Queue a new prompt for processing
- **get-queued-prompts** - Retrieve queued prompts
- **pause** / **resume** - Control execution
- **toggle-perpetual** - Enable/disable perpetual mode

For detailed documentation and examples, see [MCP Server Documentation](src/mcp-server/README.md).

### Plugin Integration

Plugins can access MCP server information via the `mcp:started` hook:

```javascript
export default {
  name: 'mcp-logger',
  hooks: {
    'mcp:started': async (context) => {
      console.log(`MCP server: ${context.protocol}://${context.url}:${context.port}`);
      // You can now connect to the MCP server from your plugin
      return context;
    }
  }
}
```

## Desktop Notifications

Clawd includes built-in desktop notifications to keep you informed when Claude completes tasks. By default, notifications are enabled and will alert you when:

- **Task Complete** - A task finishes successfully
- **Project Complete** - All tasks are finished and the project is complete
- **New Tasks Added** - Claude adds new tasks to the plan after completion evaluation
- **Execution Paused** - Execution is paused (via `SPACE` key)
- **Execution Cancelled** - Execution is cancelled (via `ESC` key)
- **Error Occurs** - An error occurs during execution

**Controlling Notifications:**

```bash
# Disable all notifications
clawd --no-notifications "Build an API"

# Keep notifications but disable sounds
clawd --no-notification-sound "Build an API"
```

Notifications work cross-platform on macOS, Windows, and Linux. They appear as native system notifications and are perfect for letting you step away from your desk while Clawd works.

## Perpetual Mode

Enable continuous development that never stops:

```bash
clawd --perpetual "Build a web scraper"
```

**How it works:**
- When the initial plan completes, Claude evaluates the entire project
- If more work is needed, Claude adds new phases/tasks to the plan
- Execution continues indefinitely with expanded scope
- Stop anytime with `Ctrl+C`

## Interactive TUI Features

**TUI Features:**
- Scrollable log area showing all output
- Status bar with current phase and keyboard shortcuts
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

## Logs

Clawd maintains detailed logs:

- **Console/TUI** - Real-time colored output showing current progress
- **clawd.log** - Detailed execution log of all operations
- **clawd-error.log** - Error-specific logging for troubleshooting

## File Structure

```
clawd/
├── src/
│   ├── core/              # Core modules (plan, exec, eval, complete, state)
│   ├── plugin-system/     # Plugin loader and hook manager
│   ├── mcp-server/        # Model Context Protocol server
│   ├── index.js           # CLI entry point
│   ├── prompt-loader.js   # Prompt template system
│   ├── logger.js          # Logging system
│   └── tui.js             # Terminal UI
├── prompts/               # Built-in prompt templates
├── templates/             # Plugin template
└── .clawd/                # User customizations (created in projects)
    ├── prompts/           # User prompt overrides
    └── plugins/           # User plugins
```

## Development & Contributing

### Setup for Development

```bash
git clone <repository-url>
cd clawd
npm install
npm link
```

### Testing

```bash
npm test
```

### Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug"
git commit -m "docs: update README"
```

## Advanced Patterns

### Custom LLM Adapters

Clawd uses an adapter pattern to support any LLM provider. By default, it uses the Claude Code CLI, but you can easily swap in a different LLM.

#### Creating a Custom Adapter

Create a file at `.clawd/adapter.js` in your project:

```javascript
import { LLMAdapter } from "../node_modules/clawd/src/adapters/base.js";

export default class MyLLMAdapter extends LLMAdapter {
  async execute(prompt, captureOutput = true) {
    // Call your LLM API and return the response
    const response = await fetch('https://api.your-llm.com/v1/chat', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.API_KEY}` },
      body: JSON.stringify({ prompt })
    });
    return await response.text();
  }

  async executeWithTUI(prompt, tui) {
    const output = await this.execute(prompt);
    if (tui) tui.writeOutput(output);
    return { exitCode: 0, output };
  }

  getName() {
    return "My Custom LLM";
  }
}
```

#### Adapter Examples

**OpenAI GPT-4:**
```javascript
export default class OpenAIAdapter extends LLMAdapter {
  async execute(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

**Local Ollama:**
```javascript
export default class OllamaAdapter extends LLMAdapter {
  async execute(prompt) {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: 'codellama',
        prompt: prompt,
        stream: false
      })
    });
    const data = await response.json();
    return data.response;
  }
}
```

### Using runPrompt() in Plugins

All plugin hooks receive a `runPrompt()` function in their context, allowing plugins to execute additional LLM queries:

```javascript
export default {
  name: 'my-plugin',
  hooks: {
    'post:eval': async (context) => {
      if (!context.result.complete) {
        // Use the current LLM adapter to get suggestions
        const suggestion = await context.runPrompt(
          `Suggest a fix for: ${context.result.feedback}`
        );
        context.logger.info(`Suggestion: ${suggestion}`);
      }
      return context;
    }
  }
}
```

#### Advanced Plugin Patterns

**Self-Healing Plugin** - Automatically attempts to fix failed tasks:

```javascript
export default {
  name: 'self-healing',
  hooks: {
    'post:eval': async (context) => {
      if (!context.result.complete && context.task.retryCount < 3) {
        context.logger.info('[self-healing] Analyzing failure...');

        const analysis = await context.runPrompt(`
          A task failed with this feedback: "${context.result.feedback}"

          Analyze the issue and provide a specific action plan to fix it.
          Be concise and actionable.
        `);

        context.logger.info(`[self-healing] Analysis: ${analysis}`);

        // Store retry count on task
        context.task.retryCount = (context.task.retryCount || 0) + 1;
      }
      return context;
    }
  }
}
```

**Code Review Plugin** - Reviews code after each task:

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default {
  name: 'code-reviewer',
  hooks: {
    'post:exec': async (context) => {
      if (context.exitCode === 0) {
        // Get git diff of changes
        const { stdout } = await execAsync('git diff HEAD');

        if (stdout) {
          const review = await context.runPrompt(`
            Review this code change for quality and potential issues:

            ${stdout}

            Provide a brief review focusing on:
            - Code quality
            - Potential bugs
            - Best practices
          `);

          context.logger.info(`[code-review] ${review}`);
        }
      }
      return context;
    }
  }
}
```

**Adaptive Planning Plugin** - Adjusts plan based on progress:

```javascript
export default {
  name: 'adaptive-planner',
  hooks: {
    'post:complete': async (context) => {
      if (!context.isComplete) {
        // Ask LLM to suggest plan improvements
        const suggestion = await context.runPrompt(`
          Project: ${context.projectBrief}
          Goal: ${context.goal}

          The project evaluation shows it's incomplete.
          Current plan has ${context.plan.tasks.length} tasks.

          Suggest 2-3 additional tasks that would help complete the project.
          Format as a numbered list.
        `);

        context.logger.info(`[adaptive-planner] Suggestions: ${suggestion}`);
      }
      return context;
    }
  }
}
```

**Context-Aware Prompt Modifier** - Modifies prompts before execution:

```javascript
export default {
  name: 'context-enhancer',
  hooks: {
    'pre:exec': async (context) => {
      // Add project-specific context to every prompt
      const projectContext = `
        IMPORTANT: This project uses TypeScript with strict mode.
        Always include type annotations and handle errors properly.
      `;

      context.prompt = projectContext + '\n\n' + context.prompt;

      context.logger.debug('[context-enhancer] Enhanced prompt with project context');
      return context;
    }
  }
}
```

### Configurable Prompts

Override any built-in prompt by creating matching files in `.clawd/prompts/`:

```bash
# Copy a prompt to customize it
clawd prompts copy plan-init

# Edit .clawd/prompts/plan-init.md
# Add your custom instructions, examples, or constraints
```

**Example custom prompt** (`.clawd/prompts/plan-init.md`):

```markdown
Create a project plan for: {{userPrompt}}

IMPORTANT CONSTRAINTS:
- Use Python 3.11+
- Follow PEP 8 style guide
- Include comprehensive docstrings
- Add type hints to all functions
- Use pytest for all tests

Format the plan as follows:
# Project Brief
[Description]

# Goal
[End goal]

# Phases
## Phase 1: [Name]
- [ ] Task 1
- [ ] Task 2
```

## Troubleshooting

### Claude Code not found

Ensure Claude Code CLI is installed and in your PATH:

```bash
which claude
```

If not found, install from: https://docs.claude.com/en/docs/claude-code

### Rate limiting

Clawd automatically handles rate limits by waiting and retrying. You'll see wait time estimates in the output.

### Plugins not loading

Ensure your plugin exports a default object with `name` and `hooks`:

```javascript
export default {
  name: 'my-plugin',
  hooks: {
    // Your hooks here
  }
}
```

Check `clawd.log` for plugin loading errors.

## License

MIT
