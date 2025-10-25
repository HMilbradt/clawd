import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import logger from './logger.js';
import { getTUI } from './tui.js';

/**
 * Manages a queue of user prompts to be processed at the start of the next iteration
 */
export class PromptQueue {
  constructor() {
    this.queue = [];
  }

  /**
   * Add a prompt to the queue
   * @param {Object} prompt - The prompt object with type and content
   */
  enqueue(prompt) {
    this.queue.push(prompt);
    logger.info(`Queued prompt: ${prompt.type}`);
  }

  /**
   * Get all queued prompts and clear the queue
   * @returns {Array} - Array of queued prompts
   */
  dequeue() {
    const prompts = [...this.queue];
    this.queue = [];
    return prompts;
  }

  /**
   * Check if there are any queued prompts
   * @returns {boolean}
   */
  hasPrompts() {
    return this.queue.length > 0;
  }

  /**
   * Get the number of queued prompts
   * @returns {number}
   */
  count() {
    return this.queue.length;
  }
}

/**
 * Starts an interactive listener that allows users to queue prompts while Claude is running
 * @param {PromptQueue} promptQueue - The prompt queue to add prompts to
 * @param {TUI} tui - The TUI instance (optional, if not using TUI mode)
 * @returns {Object} - Object with stop() method to stop listening
 */
export function startInteractiveListener(promptQueue, tui = null) {
  let isListening = true;

  const handleKeypress = async (ch, key) => {
    if (!isListening) return;

    // Handle Ctrl+C (already handled by blessed if TUI is active)
    if (key.name === 'p') {
      // 'p' key - open prompt interface
      await handleInteractivePrompt(promptQueue, tui);
    } else if (key.name === 'space') {
      // Space key - pause execution
      if (tui) {
        const choice = await tui.showPauseMenu();
        if (choice === 'quit') {
          tui.destroy();
          process.exit(0);
        } else if (choice === 'prompt') {
          await handleInteractivePrompt(promptQueue, tui);
        }
        // If 'continue', just return and execution will resume
      }
    } else if (key.name === 'escape') {
      // ESC key - request cancellation
      if (tui) {
        const confirmed = await tui.confirm('Cancel current task?');
        if (confirmed) {
          tui.requestCancel();
          tui.log('🛑 Task cancellation requested. Will pause after current task.', 'warn');
        }
      }
    } else if (key.name === 'q') {
      // 'q' key - quit
      if (tui) {
        tui.destroy();
      }
      console.log(chalk.yellow('\n\nQuitting clawd...'));
      process.exit(0);
    } else if (key.name === '?' || key.ch === '?' || key.name === 'h') {
      // '?' or 'h' key - show help
      showInteractiveHelp(tui);
    }
  };

  // If using TUI, bind to blessed screen
  if (tui) {
    const screen = tui.getScreen();
    if (screen) {
      screen.key(['p'], () => handleKeypress({ ch: 'p' }, { name: 'p' }));
      screen.key(['space'], () => handleKeypress({ ch: ' ' }, { name: 'space' }));
      screen.key(['escape'], () => handleKeypress({ ch: '\x1b' }, { name: 'escape' }));
      screen.key(['q'], () => handleKeypress({ ch: 'q' }, { name: 'q' }));
      screen.key(['?', 'h'], () => handleKeypress({ ch: '?' }, { name: '?' }));
    }
  } else {
    // Fallback to stdin (non-TUI mode)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const rawKeyHandler = async (chunk) => {
        if (!isListening) return;
        const key = chunk.toString();

        if (key === '\u0003') {
          console.log(chalk.yellow('\n\nReceived Ctrl+C. Stopping clawd...'));
          process.exit(0);
        } else if (key === 'p' || key === 'P') {
          await handleInteractivePrompt(promptQueue, tui);
        } else if (key === 'q' || key === 'Q') {
          console.log(chalk.yellow('\n\nQuitting clawd...'));
          process.exit(0);
        } else if (key === '?' || key === 'h' || key === 'H') {
          showInteractiveHelp(tui);
        }
      };

      process.stdin.on('data', rawKeyHandler);

      return {
        stop: () => {
          isListening = false;
          if (process.stdin.isTTY) {
            process.stdin.removeListener('data', rawKeyHandler);
            process.stdin.setRawMode(false);
            process.stdin.pause();
          }
        },
      };
    }
  }

  return {
    stop: () => {
      isListening = false;
    },
  };
}

/**
 * Show interactive help message
 * @param {TUI} tui - The TUI instance (optional)
 */
function showInteractiveHelp(tui) {
  const helpMessage = `╔═══════════════════════════════════════════╗
║      Interactive Mode Commands            ║
╠═══════════════════════════════════════════╣
║  p     - Queue a prompt for next iteration║
║  SPACE - Pause execution (menu)           ║
║  ESC   - Cancel current task              ║
║  q     - Quit clawd                        ║
║  ?/h   - Show this help message           ║
╚═══════════════════════════════════════════╝`;

  if (tui) {
    tui.log(helpMessage, 'info');
  } else {
    console.log(chalk.cyan(helpMessage));
  }
}

/**
 * Handle interactive prompt - pause to collect user input
 * @param {PromptQueue} promptQueue - The prompt queue
 * @param {TUI} tui - The TUI instance (optional)
 */
async function handleInteractivePrompt(promptQueue, tui = null) {
  try {
    if (tui) {
      // Use TUI's built-in select and prompt (stays within TUI)
      tui.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      tui.log('   Interactive Prompt', 'info');
      tui.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

      const promptType = await tui.select('What would you like to do?', [
        { name: 'Ask a question about the current status', value: 'question' },
        { name: 'Request a change to the plan', value: 'plan_change' },
        { name: 'Add new scope or tasks', value: 'add_scope' },
        { name: 'Provide guidance or steering', value: 'guidance' },
        { name: 'Cancel', value: 'cancel' },
      ]);

      if (promptType === 'cancel') {
        tui.log('Cancelled.', 'warn');
        return;
      }

      const promptMessages = {
        question: 'What would you like to know?',
        plan_change: 'What changes would you like to make to the plan?',
        add_scope: 'What new scope or tasks would you like to add?',
        guidance: 'What guidance would you like to provide?',
      };

      const userInput = await tui.prompt(promptMessages[promptType]);

      if (userInput && userInput.trim()) {
        promptQueue.enqueue({
          type: promptType,
          content: userInput,
          timestamp: new Date().toISOString(),
        });

        tui.log('✓ Prompt queued! It will be processed at the start of the next iteration.', 'success');
        logger.info(`Queued ${promptType}: ${userInput}`);
      } else {
        tui.log('Empty input. Cancelled.', 'warn');
      }
    } else {
      // Fallback to inquirer for non-TUI mode
      // Temporarily disable raw mode to allow inquirer to work
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }

      console.log(chalk.cyan('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.cyan.bold('   Interactive Prompt'));
      console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

      const promptType = await select({
        message: 'What would you like to do?',
        choices: [
          { name: 'Ask a question about the current status', value: 'question' },
          { name: 'Request a change to the plan', value: 'plan_change' },
          { name: 'Add new scope or tasks', value: 'add_scope' },
          { name: 'Provide guidance or steering', value: 'guidance' },
          { name: 'Cancel', value: 'cancel' },
        ],
      });

      if (promptType === 'cancel') {
        console.log(chalk.yellow('Cancelled.\n'));
        return;
      }

      const promptMessages = {
        question: 'What would you like to know?',
        plan_change: 'What changes would you like to make to the plan?',
        add_scope: 'What new scope or tasks would you like to add?',
        guidance: 'What guidance would you like to provide?',
      };

      const userInput = await input({
        message: promptMessages[promptType],
      });

      if (userInput.trim()) {
        promptQueue.enqueue({
          type: promptType,
          content: userInput,
          timestamp: new Date().toISOString(),
        });

        console.log(
          chalk.green(
            '\n✓ Prompt queued! It will be processed at the start of the next iteration.\n'
          )
        );
        logger.info(`Queued ${promptType}: ${userInput}`);
      } else {
        console.log(chalk.yellow('Empty input. Cancelled.\n'));
      }

      // Re-enable raw mode
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
    }
  } catch (error) {
    if (error.name === 'ExitPromptError') {
      // User pressed Ctrl+C during prompt
      const msg = 'Prompt cancelled.';
      if (tui) {
        tui.log(msg, 'warn');
      } else {
        console.log(chalk.yellow(`\n${msg}\n`));
      }
    } else {
      logger.error(`Error in interactive prompt: ${error.message}`);
      if (tui) {
        tui.log(`Error: ${error.message}`, 'error');
      } else {
        console.log(chalk.red(`\nError: ${error.message}\n`));
      }
    }
  }
}
