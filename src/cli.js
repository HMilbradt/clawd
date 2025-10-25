import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { initAction } from "./actions/init.js";
import { createPluginAction, listPluginsAction } from "./actions/plugins.js";
import { copyPromptAction, listPromptsAction } from "./actions/prompts.js";
import { runAction } from "./actions/run.js";

// Read version from package.json
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
	readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"),
);

const program = new Command();

program
	.name("clawd")
	.description("Claude Code CLI Wrapper for multi-phase project execution")
	.version(packageJson.version);

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
		await runAction(userPrompt, options);
	});

// Prompts subcommand
const promptsCmd = program.command("prompts").description("Manage prompts");

promptsCmd
	.command("list")
	.description("List all available prompts")
	.action(async () => {
		await listPromptsAction();
	});

promptsCmd
	.command("copy <name>")
	.description("Copy a built-in prompt to .clawd/prompts/ for editing")
	.option("--all", "Copy all prompts")
	.action(async (name, options) => {
		await copyPromptAction(name, options);
	});

// Plugins subcommand
const pluginsCmd = program.command("plugins").description("Manage plugins");

pluginsCmd
	.command("list")
	.description("List loaded plugins and their hooks")
	.action(() => {
		listPluginsAction();
	});

pluginsCmd
	.command("create <name>")
	.description("Create a new plugin from template")
	.action(async (name) => {
		await createPluginAction(name);
	});

// Init command
program
	.command("init")
	.description("Initialize .clawd/ directory structure")
	.action(async () => {
		await initAction();
	});

program.parse();
