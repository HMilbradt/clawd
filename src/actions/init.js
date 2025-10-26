import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { copyPromptToUser, listPrompts } from "../core/prompt-loader.js";

/**
 * Initialize .clawd/ directory structure
 */
export async function initAction() {
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

		// Copy all built-in prompts to .clawd/prompts/
		console.log(chalk.blue("Copying built-in prompts...\n"));
		const prompts = await listPrompts();
		for (const promptName of prompts.builtIn) {
			try {
				await copyPromptToUser(promptName);
				console.log(chalk.green(`  ✓ Copied ${promptName}.md`));
			} catch (error) {
				console.log(
					chalk.yellow(`  ⚠ Failed to copy ${promptName}: ${error.message}`),
				);
			}
		}
		console.log(chalk.green("\n✓ All prompts copied to .clawd/prompts/\n"));
	} catch (error) {
		console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
		process.exit(1);
	}
}
