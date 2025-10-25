import chalk from "chalk";
import fs from "node:fs/promises";
import path from "node:path";
import { listPlugins } from "../plugin-system/loader.js";

/**
 * List loaded plugins and their hooks
 */
export function listPluginsAction() {
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
}

/**
 * Create a new plugin from template
 */
export async function createPluginAction(name) {
	try {
		// Read template
		const templatePath = path.join(
			new URL(".", import.meta.url).pathname,
			"..",
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
}
