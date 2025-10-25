import chalk from "chalk";
import { copyPromptToUser, listPrompts } from "../core/prompt-loader.js";

/**
 * List all available prompts
 */
export async function listPromptsAction() {
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
}

/**
 * Copy a built-in prompt to .clawd/prompts/ for editing
 */
export async function copyPromptAction(name, options) {
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
}
