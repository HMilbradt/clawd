#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';
import { generatePlan, loadPlan } from './planner.js';
import { executePhases } from './executor.js';
import { initTUI } from './tui.js';
import { setLoggerTUI } from './logger.js';
import { setupProjectGit } from './git-setup.js';

const program = new Command();

program
  .name('clawd')
  .description('Claude Code CLI Wrapper for multi-phase project execution')
  .version('1.0.0');

program
  .argument('[prompt]', 'Project prompt for Claude (optional - will prompt you at startup if omitted)')
  .option('-p, --perpetual', 'Enable perpetual mode - continuously add new features after completion')
  .option('--non-interactive', 'Disable terminal UI and run in standard output mode')
  .action(async (prompt, options) => {
    try {
      // Interactive mode is enabled by default (unless --non-interactive is specified)
      const interactive = !options.nonInteractive;

      // Initialize TUI immediately if in interactive mode
      let tui = null;
      if (interactive) {
        tui = initTUI();
        setLoggerTUI(tui);
        tui.showBanner('🤖 Clawd - Claude Code Orchestrator', 'info');
      } else {
        console.log(chalk.bold.blue('\n🤖 Clawd - Claude Code Orchestrator\n'));
      }

      let planContent;
      let projectBrief = '';
      let goal = '';

      const planPath = path.join(process.cwd(), 'PROJECT_PLAN.md');

      // Check if PROJECT_PLAN.md exists
      let planExists = false;
      try {
        await fs.access(planPath);
        planExists = true;
      } catch {
        planExists = false;
      }

      if (planExists) {
        // Auto-detect and load existing plan
        if (tui) {
          tui.log('📋 Found existing PROJECT_PLAN.md', 'info');
          tui.log('✓ Loading existing plan', 'success');
        } else {
          console.log(chalk.cyan('📋 Found existing PROJECT_PLAN.md'));
          console.log(chalk.green('✓ Loading existing plan\n'));
        }
        planContent = await fs.readFile(planPath, 'utf-8');
      } else {
        // Need to generate new plan - ask for prompt if not provided
        if (!prompt) {
          if (tui) {
            prompt = await tui.prompt('What would you like to build?');
            if (!prompt || !prompt.trim()) {
              tui.log('No prompt provided. Exiting.', 'error');
              tui.destroy();
              process.exit(1);
            }
          } else {
            // This should never happen since we auto-enable interactive mode above
            console.error(chalk.red('\n❌ Error: Prompt is required\n'));
            process.exit(1);
          }
        }

        // Setup git repository before generating plan
        if (tui) {
          tui.log('Setting up git repository...', 'info');
        } else {
          console.log(chalk.yellow('Setting up git repository...\n'));
        }

        try {
          await setupProjectGit();
          if (tui) {
            tui.log('✓ Git repository ready', 'success');
          } else {
            console.log(chalk.green('✓ Git repository ready\n'));
          }
        } catch (error) {
          logger.error(`Git setup failed: ${error.message}`);
          if (tui) {
            tui.log('⚠️  Git setup failed, continuing without git integration', 'warn');
          } else {
            console.log(chalk.yellow('⚠️  Git setup failed, continuing without git integration\n'));
          }
        }

        // Generate new plan
        if (tui) {
          tui.log('Generating project plan...', 'info');
          tui.showLoadingIndicator('Generating plan');
        } else {
          console.log(chalk.yellow('Generating project plan...\n'));
        }
        planContent = await generatePlan(prompt);
        if (tui) {
          tui.hideLoadingIndicator();
          tui.log('✓ Plan generated and saved', 'success');
        } else {
          console.log(chalk.green('✓ Plan generated and saved\n'));
        }
      }

      // Extract project brief and goal from plan
      const briefMatch = planContent.match(/# Project Brief\s+(.+?)(?=\n#|$)/s);
      const goalMatch = planContent.match(/# Goal\s+(.+?)(?=\n#|$)/s);

      if (briefMatch) projectBrief = briefMatch[1].trim();
      if (goalMatch) goal = goalMatch[1].trim();

      if (tui) {
        tui.log(`Project Brief: ${projectBrief}`, 'info');
        tui.log(`Goal: ${goal}`, 'info');
      } else {
        console.log(chalk.cyan('Project Brief:'), projectBrief);
        console.log(chalk.cyan('Goal:'), goal);
        console.log();
      }

      // Execute phases (TUI is already initialized, just pass the flag)
      await executePhases(projectBrief, goal, options.perpetual, interactive);

      if (!options.perpetual) {
        if (tui) {
          tui.showBanner('✨ All done!', 'success');
        } else {
          console.log(chalk.green.bold('\n✨ All done!\n'));
        }
      }
    } catch (error) {
      logger.error(`Error: ${error.message}`);
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program.parse();
