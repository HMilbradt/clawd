import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Mustache from "mustache";
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load a prompt template with support for user overrides
 * Checks .clawd/prompts/ first, then falls back to built-in prompts/
 * @param {string} promptName - Name of the prompt file (without .md extension)
 * @param {Object} variables - Object containing variable replacements (e.g., {userPrompt: "..."})
 * @param {string} cwd - Working directory (defaults to process.cwd())
 * @returns {Promise<string>} - The rendered prompt
 */
export async function loadPrompt(
	promptName,
	variables = {},
	cwd = process.cwd(),
) {
	const fileName = `${promptName}.md`;

	// Try user override first (.clawd/prompts/)
	const userPromptPath = path.join(cwd, ".clawd", "prompts", fileName);
	let template = null;
	let _usedUserOverride = false;

	try {
		template = await fs.readFile(userPromptPath, "utf-8");
		_usedUserOverride = true;
		logger.debug(`Using user override prompt: ${fileName}`);
	} catch {
		// User override doesn't exist, use built-in
		const builtinPromptPath = path.join(
			__dirname,
			"..",
			"..",
			"prompts",
			fileName,
		);
		try {
			template = await fs.readFile(builtinPromptPath, "utf-8");
			logger.debug(`Using built-in prompt: ${fileName}`);
		} catch (error) {
			logger.error(`Error reading builtin prompt: ${error.message}`);
			throw new Error(
				`Prompt not found: ${promptName} (checked ${userPromptPath} and ${builtinPromptPath})`,
			);
		}
	}

	// Render template using Mustache
	const rendered = Mustache.render(template, variables);

	return rendered;
}

/**
 * List all available prompts (both built-in and user overrides)
 * @param {string} cwd - Working directory
 * @returns {Promise<Object>} - { builtIn: string[], userOverrides: string[] }
 */
export async function listPrompts(cwd = process.cwd()) {
	const builtinPromptsDir = path.join(__dirname, "..", "..", "prompts");
	const userPromptsDir = path.join(cwd, ".clawd", "prompts");

	// Get built-in prompts
	const builtInFiles = await fs.readdir(builtinPromptsDir);
	const builtIn = builtInFiles
		.filter((f) => f.endsWith(".md"))
		.map((f) => f.replace(".md", ""));

	// Get user override prompts
	let userOverrides = [];
	try {
		const userFiles = await fs.readdir(userPromptsDir);
		userOverrides = userFiles
			.filter((f) => f.endsWith(".md"))
			.map((f) => f.replace(".md", ""));
	} catch {
		// .clawd/prompts/ doesn't exist
	}

	return { builtIn, userOverrides };
}

/**
 * Copy a built-in prompt to .clawd/prompts/ for user editing
 * @param {string} promptName - Name of the prompt (without .md extension)
 * @param {string} cwd - Working directory
 */
export async function copyPromptToUser(promptName, cwd = process.cwd()) {
	const fileName = `${promptName}.md`;
	const builtinPromptPath = path.join(
		__dirname,
		"..",
		"..",
		"prompts",
		fileName,
	);
	const userPromptsDir = path.join(cwd, ".clawd", "prompts");
	const userPromptPath = path.join(userPromptsDir, fileName);

	// Check if built-in prompt exists
	try {
		await fs.access(builtinPromptPath);
	} catch {
		throw new Error(`Built-in prompt not found: ${promptName}`);
	}

	// Ensure .clawd/prompts/ directory exists
	await fs.mkdir(userPromptsDir, { recursive: true });

	// Copy the file
	await fs.copyFile(builtinPromptPath, userPromptPath);

	logger.info(`Copied ${fileName} to .clawd/prompts/`);
	return userPromptPath;
}
