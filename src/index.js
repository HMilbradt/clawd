#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { loadAdapter } from "./adapters/loader.js";
import * as complete from "./core/complete.js";
import * as evaluate from "./core/eval.js";
import * as exec from "./core/exec.js";
import logger, { setLoggerTUI } from "./core/logger.js";
import * as plan from "./core/plan.js";
import { copyPromptToUser, listPrompts } from "./core/prompt-loader.js";
import { initTUI } from "./core/tui.js";
import { listPlugins, loadPlugins } from "./plugin-system/loader.js";

const program = new Command();

program
	.name("clawd")
	.description("Claude Code CLI Wrapper for multi-phase project execution")
	.version("0.0.5");

// Main execution command
program
	.argument(
		"[prompt]",
		"Project prompt for Claude (optional - will prompt you at startup if omitted)",
	)
	.option(
		"-p, --perpetual",
		"Enable perpetual mode - continuously add new features after completion",
	)
	.option(
		"--non-interactive",
		"Disable terminal UI and run in standard output mode",
	)
	.action(async (userPrompt, options) => {
		await runMain(userPrompt, options);
	});

// Prompts subcommand
const promptsCmd = program.command("prompts").description("Manage prompts");

promptsCmd
	.command("list")
	.description("List all available prompts")
	.action(async () => {
		const prompts = await listPrompts();

		console.log(chalk.bold.blue("\n📝 Built-in Prompts:"));
		for (const name of prompts.builtIn) {
			const isOverridden = prompts.userOverrides.includes(name);
			if (isOverridden) {
				console.log(
					chalk.yellow(`  • ${name} (overridden in .clawd/prompts/)`),
				);
			} else {
				console.log(chalk.white(`  • ${name}`));
			}
		}

		if (prompts.userOverrides.length > 0) {
			console.log(chalk.bold.blue("\n✏️  User Override Prompts:"));
			for (const name of prompts.userOverrides) {
				if (!prompts.builtIn.includes(name)) {
					console.log(chalk.green(`  • ${name} (custom)`));
				}
			}
		}

		console.log();
	});

promptsCmd
	.command("copy <name>")
	.description("Copy a built-in prompt to .clawd/prompts/ for editing")
	.option("--all", "Copy all prompts")
	.action(async (name, options) => {
		if (options.all) {
			const prompts = await listPrompts();
			console.log(
				chalk.blue(`\nCopying ${prompts.builtIn.length} prompts...\n`),
			);
			for (const promptName of prompts.builtIn) {
				try {
					await copyPromptToUser(promptName);
					console.log(chalk.green(`✓ Copied ${promptName}`));
				} catch (error) {
					console.log(
						chalk.red(`✗ Failed to copy ${promptName}: ${error.message}`),
					);
				}
			}
			console.log(chalk.green("\n✓ All prompts copied to .clawd/prompts/\n"));
		} else {
			try {
				const filePath = await copyPromptToUser(name);
				console.log(chalk.green(`\n✓ Copied ${name} to ${filePath}\n`));
			} catch (error) {
				console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
				process.exit(1);
			}
		}
	});

// Plugins subcommand
const pluginsCmd = program.command("plugins").description("Manage plugins");

pluginsCmd
	.command("list")
	.description("List loaded plugins and their hooks")
	.action(() => {
		const plugins = listPlugins();
		const hookNames = Object.keys(plugins);

		if (hookNames.length === 0) {
			console.log(chalk.yellow("\nNo plugins loaded\n"));
			return;
		}

		console.log(chalk.bold.blue("\n🔌 Loaded Plugins:\n"));
		for (const [hookName, pluginNames] of Object.entries(plugins)) {
			console.log(chalk.cyan(`  ${hookName}:`));
			for (const pluginName of pluginNames) {
				console.log(chalk.white(`    • ${pluginName}`));
			}
		}
		console.log();
	});

pluginsCmd
	.command("create <name>")
	.description("Create a new plugin from template")
	.action(async (name) => {
		try {
			// Read template
			const templatePath = path.join(
				new URL(".", import.meta.url).pathname,
				"..",
				"templates",
				"plugin-template.js",
			);
			let template = await fs.readFile(templatePath, "utf-8");

			// Replace {{PLUGIN_NAME}} with actual name
			template = template.replace(/{{PLUGIN_NAME}}/g, name);

			// Ensure .clawd/plugins directory exists
			const pluginsDir = path.join(process.cwd(), ".clawd", "plugins");
			await fs.mkdir(pluginsDir, { recursive: true });

			// Write plugin file
			const pluginPath = path.join(pluginsDir, `${name}.js`);
			await fs.writeFile(pluginPath, template);

			console.log(chalk.green(`\n✓ Created plugin: ${pluginPath}\n`));
			console.log(chalk.white("Edit the file to customize hook behavior.\n"));
		} catch (error) {
			console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
			process.exit(1);
		}
	});

// Init command
program
	.command("init")
	.description("Initialize .clawd/ directory structure")
	.action(async () => {
		try {
			const clawdDir = path.join(process.cwd(), ".clawd");
			const promptsDir = path.join(clawdDir, "prompts");
			const pluginsDir = path.join(clawdDir, "plugins");
			const logsDir = path.join(clawdDir, "logs");

			await fs.mkdir(promptsDir, { recursive: true });
			await fs.mkdir(pluginsDir, { recursive: true });
			await fs.mkdir(logsDir, { recursive: true });

			console.log(chalk.green("\n✓ Initialized .clawd/ directory\n"));
			console.log(chalk.white("  Created:"));
			console.log(chalk.white("    .clawd/prompts/"));
			console.log(chalk.white("    .clawd/plugins/"));
			console.log(chalk.white("    .clawd/logs/\n"));
		} catch (error) {
			console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
			process.exit(1);
		}
	});

/**
 * Main execution function
 */
async function runMain(userPrompt, options) {
	try {
		const interactive = !options.nonInteractive;

		// Initialize TUI if in interactive mode
		let tui = null;
		if (interactive) {
			tui = initTUI();
			setLoggerTUI(tui);
			tui.showBanner("🤖 Clawd - Claude Code Orchestrator", "info");
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

		// Get prompt if not provided
		if (!userPrompt) {
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

					if (!options.perpetual) {
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

program.parse();
