import chalk from "chalk";
import fs from "node:fs/promises";
import path from "node:path";

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
	} catch (error) {
		console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
		process.exit(1);
	}
}
