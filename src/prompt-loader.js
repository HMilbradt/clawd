import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load a prompt template from the prompts directory and replace placeholders
 * @param {string} promptName - Name of the prompt file (without .md extension)
 * @param {Object} variables - Object containing variable replacements (e.g., {userPrompt: "..."})
 * @returns {Promise<string>} - The rendered prompt
 */
export async function loadPrompt(promptName, variables = {}) {
	const promptPath = path.join(__dirname, "..", "prompts", `${promptName}.md`);
	let template = await fs.readFile(promptPath, "utf-8");

	// Replace all {{variableName}} with values from variables object
	for (const [key, value] of Object.entries(variables)) {
		const placeholder = new RegExp(`{{${key}}}`, "g");
		template = template.replace(placeholder, value);
	}

	return template;
}
