import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import logger from './logger.js';
import { loadPlan, updatePlanProgress } from './planner.js';
import { evaluateCompletion } from './evaluator.js';
import { expandFeatures } from './expander.js';
import { loadPrompt } from './prompt-loader.js';
import { PromptQueue, startInteractiveListener } from './interactive.js';
import { spawnClaude } from './claude-helper.js';
import { getTUI } from './tui.js';
import {
  detectRateLimit,
  calculateWaitTime,
  formatWaitTime,
  sleep
} from './rate-limit-handler.js';
import {
  getCurrentBranch,
  checkoutBranch,
  stageAll,
  commit,
  merge
} from './git-setup.js';
import { allStepsComplete } from './step-evaluator.js';
import { evaluatePhase } from './phase-evaluator.js';

export async function executePhases(projectBrief, goal, perpetual = false, interactive = false) {
  // Get TUI instance if in interactive mode (already initialized in index.js)
  let tui = null;
  if (interactive) {
    tui = getTUI();
  }
  let phases = await loadPlan()
  let iteration = 0
  let promptQueue = null;
  let listener = null;

  // Initialize interactive mode if enabled
  if (interactive) {
    promptQueue = new PromptQueue();
    if (tui) {
      tui.showBanner('Interactive Mode Enabled', 'info');
      tui.log('Press [p] to queue a prompt, [?] for help, [q] to quit');
    } else {
      console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.cyan.bold('   Interactive Mode Enabled'));
      console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.white('  Press ') + chalk.green.bold('p') + chalk.white(' to queue a prompt'));
      console.log(chalk.white('  Press ') + chalk.green.bold('?') + chalk.white(' or ') + chalk.green.bold('h') + chalk.white(' for help'));
      console.log(chalk.white('  Press ') + chalk.green.bold('q') + chalk.white(' to quit'));
      console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    }
  }

  while (true) {
    iteration++
    logger.info(`=== Iteration ${iteration} ===`)

    // Update TUI status
    if (tui) {
      tui.updateStatus({ iteration, interactive });
    }

    // Process any queued prompts from previous iteration
    if (interactive && promptQueue && promptQueue.hasPrompts()) {
      const prompts = promptQueue.dequeue();
      const message = `📬 Processing ${prompts.length} queued prompt(s)...`;

      if (tui) {
        tui.log(message, 'info');
      } else {
        console.log(chalk.magenta(`\n${message}\n`));
      }

      for (const prompt of prompts) {
        await processInteractivePrompt(prompt, projectBrief, goal, phases, tui);
      }

      // Reload plan in case it was modified
      phases = await loadPlan();

      if (tui) {
        tui.log('✓ Prompts processed. Continuing with execution...', 'success');
      } else {
        console.log(chalk.green('✓ Prompts processed. Continuing with execution...\n'));
      }
    }

    // Find the current phase to work on
    const currentPhase = findCurrentPhase(phases)

    if (!currentPhase) {
      logger.info('All phases in the plan are marked complete.')
      break
    }

    const { phaseIndex, phase } = currentPhase

    // Log current phase
    if (tui) {
      tui.log(`Phase ${phaseIndex + 1}: ${phase.name}`, 'info');
      tui.updateStatus({ phase: phase.name, iteration, interactive });
    } else {
      console.log(chalk.cyan(`\nPhase ${phaseIndex + 1}: ${phase.name}`))
    }

    // Start interactive listener if enabled
    if (interactive && promptQueue) {
      listener = startInteractiveListener(promptQueue, tui);
      if (promptQueue.count() > 0) {
        if (tui) {
          tui.updatePromptCount(promptQueue.count());
        } else {
          console.log(chalk.yellow(`  (${promptQueue.count()} prompt(s) queued for next iteration)`));
        }
      } else if (tui) {
        tui.updatePromptCount(0);
      }
    }

    // Get main branch name for git operations
    const mainBranch = await getCurrentBranch();

    // Create a branch for this phase
    const phaseBranch = `clawd/phase-${phaseIndex}`;
    await checkoutBranch(phaseBranch);

    if (tui) {
      tui.log(`Created branch: ${phaseBranch}`, 'info');
    } else {
      console.log(chalk.cyan(`Created branch: ${phaseBranch}`));
    }

    // Execute all steps in the phase with retry loop
    let phaseComplete = false;
    let phaseAttemptCount = 0;
    const maxPhaseAttempts = 3;
    let incompleteStepsContext = new Map(); // Map<stepIndex, feedback>

    while (!phaseComplete && phaseAttemptCount < maxPhaseAttempts) {
      phaseAttemptCount++;

      if (phaseAttemptCount > 1) {
        const retryMsg = `Phase retry attempt ${phaseAttemptCount}`;
        if (tui) {
          tui.log(retryMsg, 'warn');
        } else {
          console.log(chalk.yellow(retryMsg));
        }
      }

      // Execute each step in the phase
      for (let stepIndex = 0; stepIndex < phase.steps.length; stepIndex++) {
        const step = phase.steps[stepIndex];

        // Skip if step is already marked done (from previous phase attempts)
        if (step.done && phaseAttemptCount === 1) {
          if (tui) {
            tui.log(`Step ${stepIndex + 1} already complete, skipping`, 'info');
          }
          continue;
        }

        if (tui) {
          tui.log(`Step ${stepIndex + 1}/${phase.steps.length}: ${step.description}`, 'info');
          tui.updateStatus({ phase: phase.name, step: step.description, iteration, interactive });
        } else {
          console.log(chalk.cyan(`\nStep ${stepIndex + 1}/${phase.steps.length}: ${step.description}`))
        }

        // Get additional context if this step was incomplete in previous attempt
        const additionalContext = incompleteStepsContext.get(stepIndex) || '';

        // Execute the step
        const taskPrompt = await loadPrompt('task-execution', {
          projectBrief,
          goal,
          phaseName: phase.name,
          stepDescription: step.description + (additionalContext ? `\n\nPrevious Attempt Feedback:\n${additionalContext}` : '')
        });

        logger.info('Executing step with Claude Code...');
        await executeClaudeTaskWithRetry(taskPrompt, tui);

        // Stop interactive listener after Claude completes
        if (listener) {
          listener.stop();
          listener = null;
          // Restart for next step
          if (interactive && promptQueue) {
            listener = startInteractiveListener(promptQueue, tui);
          }
        }

        // Check if cancellation was requested
        if (tui && tui.isCancelRequested()) {
          tui.clearCancelRequest();
          tui.log('🛑 Task cancelled by user', 'warn');

          const choice = await tui.showPauseMenu();
          if (choice === 'quit') {
            tui.destroy();
            process.exit(0);
          } else if (choice === 'prompt') {
            const prompts = promptQueue ? promptQueue.dequeue() : [];
            for (const prompt of prompts) {
              await processInteractivePrompt(prompt, projectBrief, goal, phases, tui);
            }
          }
          phases = await loadPlan();
          continue;
        }

        // Commit changes for this step
        try {
          await stageAll();
          await commit(`feat: ${step.description}`);

          if (tui) {
            tui.log('✓ Changes committed', 'success');
          } else {
            console.log(chalk.green('✓ Changes committed'));
          }
        } catch (error) {
          logger.error(`Failed to commit changes: ${error.message}`);
          if (tui) {
            tui.log('No changes to commit', 'info');
          }
        }
      }

      // Stop interactive listener before evaluation
      if (listener) {
        listener.stop();
        listener = null;
      }

      // Evaluate the entire phase
      if (tui) {
        tui.log('Evaluating phase completion...', 'info');
      } else {
        console.log(chalk.yellow('\nEvaluating phase completion...'));
      }

      const phaseEval = await evaluatePhase(
        phase,
        mainBranch,
        phaseBranch,
        projectBrief,
        goal
      );

      if (phaseEval.complete) {
        phaseComplete = true;
        if (tui) {
          tui.log('✓ Phase evaluation: COMPLETE', 'success');
        } else {
          console.log(chalk.green('✓ Phase evaluation: COMPLETE'));
        }

        // Mark all steps as done
        for (let i = 0; i < phase.steps.length; i++) {
          phases[phaseIndex].steps[i].done = true;
        }
        await updatePlanProgress(phases);
      } else {
        if (tui) {
          tui.log(`Phase evaluation: INCOMPLETE (${phaseEval.incompleteSteps.length} steps need work)`, 'warn');
        } else {
          console.log(chalk.yellow(`Phase evaluation: INCOMPLETE (${phaseEval.incompleteSteps.length} steps need work)`));
        }

        // Update context for incomplete steps
        incompleteStepsContext.clear();
        for (const incomplete of phaseEval.incompleteSteps) {
          incompleteStepsContext.set(incomplete.stepIndex, incomplete.feedback);
          if (tui) {
            tui.log(`  Step ${incomplete.stepIndex + 1}: ${incomplete.feedback}`, 'warn');
          } else {
            console.log(chalk.yellow(`  Step ${incomplete.stepIndex + 1}: ${incomplete.feedback}`));
          }
        }

        if (phaseAttemptCount >= maxPhaseAttempts) {
          const maxAttemptsMsg = `⚠️  Max retry attempts (${maxPhaseAttempts}) reached for phase. Marking as complete but may have issues.`;
          if (tui) {
            tui.log(maxAttemptsMsg, 'warn');
          } else {
            console.log(chalk.yellow(maxAttemptsMsg));
          }
          phaseComplete = true;
          // Mark all steps as done even if incomplete
          for (let i = 0; i < phase.steps.length; i++) {
            phases[phaseIndex].steps[i].done = true;
          }
          await updatePlanProgress(phases);
        }
      }
    }

    // Merge phase branch into main
    await checkoutBranch(mainBranch);
    await merge(phaseBranch);

    if (tui) {
      tui.log(`✓ Merged ${phaseBranch} into ${mainBranch}`, 'success');
    } else {
      console.log(chalk.green(`✓ Merged ${phaseBranch} into ${mainBranch}`));
    }

    logger.info(chalk.green(`✓ Completed Phase: ${phase.name}`))

    // Check if all phases are complete before running project evaluator
    const allComplete = allStepsComplete(phases);
    if (!allComplete) {
      // Not all phases done, continue to next phase
      phases = await loadPlan();
      continue;
    }

    // All phases are complete, evaluate if project is complete
    const isComplete = await evaluateCompletion(projectBrief, goal)

    if (isComplete) {
      if (tui) {
        tui.showBanner('🎉 PROJECT COMPLETE!', 'success');
      } else {
        logger.info(chalk.green.bold('\n🎉 PROJECT COMPLETE!'))
      }

      if (perpetual) {
        const perpetualMsg = '🔄 Perpetual Mode: Researching and adding new features...';
        if (tui) {
          tui.log(perpetualMsg, 'info');
        } else {
          console.log(chalk.magenta(`\n${perpetualMsg}\n`))
        }

        // Load current plan
        const planPath = path.join(process.cwd(), 'PROJECT_PLAN.md')
        const currentPlan = await fs.readFile(planPath, 'utf-8')

        // Expand with new features
        await expandFeatures(projectBrief, goal, currentPlan)

        if (tui) {
          tui.log('✓ New phases added to plan', 'success');
        } else {
          console.log(chalk.green('✓ New phases added to plan\n'))
        }
        logger.info('Continuing with expanded plan...')

        // Reload plan with new phases and continue
        phases = await loadPlan()
        continue
      }

      break
    }

    // Reload plan in case it was modified
    phases = await loadPlan()
  }
}

function findCurrentPhase(phases) {
  for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
    const phase = phases[phaseIndex]
    // Check if any step in this phase is not done
    const hasIncompleteSteps = phase.steps.some(step => !step.done)
    if (hasIncompleteSteps) {
      return { phaseIndex, phase }
    }
  }
  return null
}

/**
 * Execute Claude task with automatic retry on rate limit
 * @param {string} prompt - The prompt to execute
 * @param {TUI} tui - The TUI instance (optional)
 */
async function executeClaudeTaskWithRetry(prompt, tui = null) {
  let attemptCount = 0;
  const maxAttempts = 100; // Prevent infinite loops, but allow many retries

  while (attemptCount < maxAttempts) {
    attemptCount++;

    if (attemptCount > 1) {
      logger.info(`Retry attempt ${attemptCount} for Claude task`);
      if (tui) {
        tui.log(`Retry attempt ${attemptCount}`, 'info');
      }
    }

    const result = await executeClaudeTask(prompt, tui);

    // Success case
    if (result.code === 0) {
      return;
    }

    // Check if it's a rate limit error
    const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`;
    const rateLimitInfo = detectRateLimit(combinedOutput);

    if (!rateLimitInfo) {
      // Not a rate limit error - log and return (don't retry other errors)
      const errorMsg = `Claude task failed with exit code ${result.code} (not a rate limit)`;
      logger.error(errorMsg);
      if (tui) {
        tui.log(errorMsg, 'error');
      }
      return;
    }

    // Rate limit detected - calculate wait time and retry
    const waitTime = calculateWaitTime(rateLimitInfo.resetTime);
    const waitTimeFormatted = formatWaitTime(waitTime);

    const rateLimitMsg = `⏳ Rate limit detected. Waiting ${waitTimeFormatted} before retry...`;
    logger.info(rateLimitMsg, {
      resetTime: rateLimitInfo.resetTime,
      waitTimeMs: waitTime,
      attemptNumber: attemptCount
    });

    if (tui) {
      tui.log(rateLimitMsg, 'warn');

      // Show countdown UI
      const waitIndicator = tui.showRateLimitWaiting(waitTime, rateLimitInfo.resetTime);

      // Update countdown every 30 seconds
      const updateInterval = setInterval(() => {
        const shouldContinue = waitIndicator.update();
        if (!shouldContinue) {
          clearInterval(updateInterval);
        }
      }, 30000);

      // Wait for the full duration
      await sleep(waitTime);

      // Clean up
      clearInterval(updateInterval);
      waitIndicator.hide();

      tui.log('✓ Wait complete - retrying now...', 'success');
    } else {
      // No TUI - just log and wait
      console.log(chalk.yellow(rateLimitMsg));
      await sleep(waitTime);
      console.log(chalk.green('✓ Wait complete - retrying now...'));
    }
  }

  // If we exhausted all attempts
  const maxAttemptsMsg = `Failed after ${maxAttempts} retry attempts`;
  logger.error(maxAttemptsMsg);
  if (tui) {
    tui.log(maxAttemptsMsg, 'error');
  }
}

async function executeClaudeTask(prompt, tui = null) {
  return new Promise((resolve, reject) => {
    // If using TUI, capture output; otherwise inherit stdio
    const stdioConfig = tui ? ['pipe', 'pipe', 'pipe'] : 'inherit'

    const claude = spawn(
      'claude',
      ['--dangerously-skip-permissions', '-p', prompt],
      {
        stdio: stdioConfig
      }
    )

    // Close stdin immediately - Claude doesn't need it in -p mode
    if (tui) {
      claude.stdin.end()
    }

    let stdoutData = ''
    let stderrData = ''

    // If using TUI, pipe output to TUI and capture for error logging
    if (tui) {
      claude.stdout.on('data', (data) => {
        stdoutData += data.toString()
        tui.writeOutput(data)
      })

      claude.stderr.on('data', (data) => {
        stderrData += data.toString()
        tui.writeOutput(data)
      })
    }

    claude.on('close', (code) => {
      if (code !== 0) {
        const fullStdout = stdoutData.trim()
        const fullStderr = stderrData.trim()

        logger.error(`Claude process failed with exit code ${code}`, {
          exitCode: code,
          stdout: fullStdout || '(empty)',
          stderr: fullStderr || '(empty)',
          command: 'claude --dangerously-skip-permissions -p [task-prompt]',
          hasTUI: !!tui
        })

        // Return stdout/stderr for retry logic to analyze
        resolve({ code, stdout: fullStdout, stderr: fullStderr })
        return
      }

      resolve({ code: 0 })
    })

    claude.on('error', (err) => {
      logger.error(`Failed to spawn Claude: ${err.message}`)
      reject(err)
    })
  })
}

/**
 * Process an interactive prompt from the user
 * @param {Object} prompt - The prompt object
 * @param {string} projectBrief - The project brief
 * @param {string} goal - The project goal
 * @param {Array} phases - The current phases
 * @param {TUI} tui - The TUI instance (optional)
 */
async function processInteractivePrompt(prompt, projectBrief, goal, phases, tui = null) {
  const message = `Processing ${prompt.type} prompt: "${prompt.content}"`;

  if (tui) {
    tui.log(`┌─ ${message}`, 'info');
  } else {
    console.log(chalk.magenta(`\n┌─ ${message}`));
    console.log(chalk.magenta(`└─`));
  }

  // Calculate progress
  let totalSteps = 0;
  let completedSteps = 0;
  phases.forEach((phase) => {
    totalSteps += phase.steps.length;
    completedSteps += phase.steps.filter((s) => s.done).length;
  });

  // Find current phase
  const current = findCurrentPhase(phases);
  const currentPhase = current ? current.phase.name : 'All phases complete';
  const currentStep = current ? `Working on phase: ${current.phase.name}` : 'None';

  // Load the interactive query prompt template
  const queryPrompt = await loadPrompt('interactive-query', {
    queryType: prompt.type,
    userQuery: prompt.content,
    projectBrief,
    goal,
    currentPhase,
    currentStep,
    completedSteps,
    totalSteps,
  });

  logger.info(`Processing interactive ${prompt.type} prompt...`);

  // Execute with Claude in interactive mode (stdio: 'inherit' for user interaction)
  await executeClaudeTaskWithRetry(queryPrompt, tui);

  const completionMsg = `✓ Completed processing ${prompt.type} prompt`;
  if (tui) {
    tui.log(completionMsg, 'success');
  } else {
    console.log(chalk.green(`${completionMsg}\n`));
  }
}
