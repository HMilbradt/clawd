import chalk from "chalk";
import fs from "node:fs/promises";
import path from "node:path";
import { loadAdapter } from "../adapters/loader.js";
import * as complete from "../core/complete.js";
import * as evaluate from "../core/eval.js";
import * as exec from "../core/exec.js";
import logger, { setLoggerTUI } from "../core/logger.js";
import * as plan from "../core/plan.js";
import { initTUI } from "../core/tui.js";
import { loadPlugins } from "../plugin-system/loader.js";

/**
 * Main execution function
 */
export async function runAction(userPrompt, options) {
	try {
		const interactive = !options.nonInteractive;

		// Initialize TUI if in interactive mode
		let tui = null;
		if (interactive) {
			tui = initTUI();
			setLoggerTUI(tui);
			tui.showBanner("🤖 Clawd - Claude Code Orchestrator", "info");
			tui.setHotkeysVisible(false); // Hide hotkeys during initialization
			tui.startRuntime();
			// Set perpetual mode from options if provided
			if (options.perpetual) {
				tui.setPerpetualMode(true);
			}
		} else {
			console.log(chalk.bold.blue("\n🤖 Clawd - Claude Code Orchestrator\n"));
		}

		// Load LLM adapter
		if (tui) {
			tui.log("Loading LLM adapter...", "info");
		}
		const adapter = await loadAdapter();
		if (tui) {
			tui.log(`✓ Using adapter: ${adapter.getName()}`, "success");
		} else {
			console.log(chalk.green(`✓ Using adapter: ${adapter.getName()}`));
		}

		// Load plugins
		if (tui) {
			tui.log("Loading plugins...", "info");
		}
		const plugins = await loadPlugins();
		if (plugins.length > 0) {
			if (tui) {
				tui.log(`✓ Loaded ${plugins.length} plugin(s)`, "success");
			} else {
				console.log(chalk.green(`✓ Loaded ${plugins.length} plugin(s)`));
			}
		}

		// Check if a plan already exists
		const planPath = path.join(process.cwd(), "PROJECT_PLAN.md");
		let planExists = false;
		try {
			await fs.access(planPath);
			planExists = true;
		} catch {
			planExists = false;
		}

		// Get prompt only if not provided and no plan exists
		if (!userPrompt && !planExists) {
			if (tui) {
				userPrompt = await tui.prompt("What would you like to build?");
				if (!userPrompt || !userPrompt.trim()) {
					tui.log("No prompt provided. Exiting.", "error");
					tui.destroy();
					process.exit(1);
				}
			} else {
				console.error(chalk.red("\n❌ Error: Prompt is required\n"));
				process.exit(1);
			}
		}

		// If plan exists and no prompt provided, we'll load the existing plan
		if (planExists && !userPrompt) {
			if (tui) {
				tui.log("Loading existing plan...", "info");
			} else {
				console.log(chalk.yellow("Loading existing plan..."));
			}
		}

		// Initialize plan
		if (tui) {
			tui.log("Initializing project plan...", "info");
		} else {
			console.log(chalk.yellow("Initializing project plan..."));
		}

		const planObj = await plan.init(userPrompt, options);

		if (tui) {
			tui.log("✓ Plan loaded", "success");
			tui.log(`Project: ${planObj.brief}`, "info");
			tui.log(`Goal: ${planObj.goal}`, "info");

			// Calculate total steps
			const totalSteps = planObj.tasks ? planObj.tasks.length : 0;
			tui.updateStats({ stepsComplete: 0, totalSteps });

			// Initialization complete - show hotkeys and enable interactive mode
			tui.setHotkeysVisible(true);
			tui.updateStatus({ interactive: true });
		} else {
			console.log(chalk.green("✓ Plan loaded"));
			console.log(chalk.cyan("Project:"), planObj.brief);
			console.log(chalk.cyan("Goal:"), planObj.goal);
			console.log();
		}

		// Main execution loop
		let iteration = 0;

		while (true) {
			iteration++;
			logger.info(`=== Iteration ${iteration} ===`);

			// Get next task
			const currentTask = plan.getNextTask(planObj);

			if (!currentTask) {
				// No more tasks - trigger completion check
				if (tui) {
					tui.log("All tasks complete. Evaluating project...", "info");
				} else {
					console.log(
						chalk.yellow("\nAll tasks complete. Evaluating project..."),
					);
				}

				const isComplete = await complete.evaluate(
					planObj.brief,
					planObj.goal,
					planObj,
				);

				if (isComplete) {
					if (tui) {
						tui.showBanner("🎉 PROJECT COMPLETE!", "success");
					} else {
						console.log(chalk.green.bold("\n🎉 PROJECT COMPLETE!\n"));
					}

					// Check perpetual mode from TUI if in interactive mode, otherwise use options
					const perpetualEnabled = tui
						? tui.isPerpetualMode()
						: options.perpetual;

					if (!perpetualEnabled) {
						break;
					}

					// In perpetual mode, reload plan and continue
					if (tui) {
						tui.log("🔄 Perpetual mode: continuing...", "info");
					} else {
						console.log(chalk.magenta("\n🔄 Perpetual mode: continuing...\n"));
					}

					// Reload plan to get new tasks
					const reloadedPlan = await plan.load();
					planObj.tasks = reloadedPlan.tasks;

					// Update step counts after reload
					if (tui) {
						const totalSteps = planObj.tasks ? planObj.tasks.length : 0;
						const completedCount = planObj.tasks
							? planObj.tasks.filter((t) => t.done).length
							: 0;
						tui.updateStats({ stepsComplete: completedCount, totalSteps });
					}
					continue;
				}

				// Project not complete - new tasks were added, reload and continue
				if (tui) {
					tui.log("✓ New tasks added to plan, continuing...", "success");
				} else {
					console.log(chalk.green("✓ New tasks added to plan, continuing..."));
				}

				const reloadedPlan = await plan.load();
				planObj.tasks = reloadedPlan.tasks;

				// Update step counts after reload
				if (tui) {
					const totalSteps = planObj.tasks ? planObj.tasks.length : 0;
					const completedCount = planObj.tasks
						? planObj.tasks.filter((t) => t.done).length
						: 0;
					tui.updateStats({ stepsComplete: completedCount, totalSteps });
				}
				continue;
			}

			// Log current task
			if (tui) {
				tui.log(`Task: ${currentTask.description}`, "info");
				tui.updateStatus({
					phase: currentTask.phase,
					step: currentTask.description,
					iteration,
				});
			} else {
				console.log(chalk.cyan(`\nTask: ${currentTask.description}`));
			}

			// Execute task
			const _execResult = await exec.executeTask(
				currentTask,
				planObj.brief,
				planObj.goal,
				options,
				tui,
			);

			// Evaluate task
			if (tui) {
				tui.log("Evaluating task...", "info");
			} else {
				console.log(chalk.yellow("Evaluating task..."));
			}

			const evalResult = await evaluate.evaluateTask(
				currentTask,
				planObj.brief,
				planObj.goal,
			);

			if (evalResult.complete) {
				// Mark task as complete
				await plan.markComplete(currentTask);
				await plan.save(planObj);

				if (tui) {
					tui.log("✓ Task complete", "success");
					// Update steps complete count
					const completedCount = planObj.tasks
						? planObj.tasks.filter((t) => t.done).length
						: 0;
					const totalSteps = planObj.tasks ? planObj.tasks.length : 0;
					tui.updateStats({ stepsComplete: completedCount, totalSteps });
				} else {
					console.log(chalk.green("✓ Task complete"));
				}
			} else {
				// Task incomplete - add feedback and retry
				plan.addFeedback(currentTask, evalResult.feedback);

				if (tui) {
					tui.log(`Task incomplete: ${evalResult.feedback}`, "warn");
					tui.log("Retrying task...", "info");
				} else {
					console.log(chalk.yellow(`Task incomplete: ${evalResult.feedback}`));
					console.log(chalk.yellow("Retrying task..."));
				}

				// Task will be retried in next iteration
			}
		}

		if (tui) {
			tui.destroy();
		}
	} catch (error) {
		logger.error(`Error: ${error.message}`);
		console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
		if (error.stack) {
			logger.error(error.stack);
		}
		process.exit(1);
	}
}
