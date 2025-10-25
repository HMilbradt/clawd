import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { getAdapter } from "../adapters/loader.js";

/**
 * Show information about the current adapter
 */
export function showAdapterAction() {
	const adapter = getAdapter();
	console.log(chalk.bold.blue("\n🔌 Current Adapter:\n"));
	console.log(chalk.white(`  ${adapter.getName()}\n`));
}

/**
 * Create a new adapter from template
 */
export async function createAdapterAction(name) {
	try {
		// Read template
		const templatePath = path.join(
			new URL(".", import.meta.url).pathname,
			"..",
			"..",
			"templates",
			"adapter-template.js",
		);
		let template = await fs.readFile(templatePath, "utf-8");

		// Replace {{ADAPTER_NAME}} with actual name
		template = template.replace(/{{ADAPTER_NAME}}/g, name);

		// Ensure .clawd directory exists
		const clawdDir = path.join(process.cwd(), ".clawd");
		await fs.mkdir(clawdDir, { recursive: true });

		// Write adapter file
		const adapterPath = path.join(clawdDir, `${name}.js`);
		await fs.writeFile(adapterPath, template);

		console.log(chalk.green(`\n✓ Created adapter: ${adapterPath}\n`));
		console.log(chalk.white("Edit the file to customize adapter behavior.\n"));
		console.log(
			chalk.cyan(
				`To use this adapter, rename it to 'adapter.js' in the .clawd directory.\n`,
			),
		);
	} catch (error) {
		console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
		process.exit(1);
	}
}
