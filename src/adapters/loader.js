import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import logger from "../core/logger.js";
import { ClaudeCodeAdapter } from "./claude-code.js";

/**
 * Singleton adapter instance
 */
let currentAdapter = null;

/**
 * Load adapter from .clawd/adapter.js or use default
 * @param {string} cwd - Working directory
 * @returns {Promise<LLMAdapter>}
 */
export async function loadAdapter(cwd = process.cwd()) {
	const adapterPath = path.join(cwd, ".clawd", "adapter.js");

	// Check if custom adapter exists
	try {
		await fs.access(adapterPath);

		logger.info("Loading custom adapter from .clawd/adapter.js");

		// Import the custom adapter
		const adapterUrl = pathToFileURL(adapterPath).href;
		const adapterModule = await import(adapterUrl);

		// Get the default export or createAdapter function
		if (adapterModule.default) {
			if (typeof adapterModule.default === "function") {
				currentAdapter = adapterModule.default();
			} else {
				currentAdapter = adapterModule.default;
			}
		} else if (adapterModule.createAdapter) {
			currentAdapter = adapterModule.createAdapter();
		} else {
			throw new Error(
				"Custom adapter must export default or createAdapter function",
			);
		}

		// Validate adapter
		if (!currentAdapter.execute || !currentAdapter.executeWithTUI) {
			throw new Error(
				"Custom adapter must implement execute() and executeWithTUI() methods",
			);
		}

		logger.info(`✓ Loaded custom adapter: ${currentAdapter.getName()}`);
	} catch (error) {
		if (error.code !== "ENOENT") {
			logger.error(`Failed to load custom adapter: ${error.message}`);
			logger.warn("Falling back to default Claude Code adapter");
		}

		// Use default Claude Code adapter
		currentAdapter = new ClaudeCodeAdapter();
		logger.debug("Using default Claude Code adapter");
	}

	return currentAdapter;
}

/**
 * Get the current adapter instance
 * @returns {LLMAdapter}
 */
export function getAdapter() {
	if (!currentAdapter) {
		// Lazy load default adapter if not already loaded
		currentAdapter = new ClaudeCodeAdapter();
	}
	return currentAdapter;
}

/**
 * Set a custom adapter (useful for testing)
 * @param {LLMAdapter} adapter
 */
export function setAdapter(adapter) {
	currentAdapter = adapter;
}
