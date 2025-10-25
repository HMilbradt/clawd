import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import logger from "../core/logger.js";
import hookManager from "./hooks.js";

/**
 * Load and register all plugins from .clawd/plugins directory
 * @param {string} cwd - Working directory
 * @returns {Promise<Array>} - Array of loaded plugin objects
 */
export async function loadPlugins(cwd = process.cwd()) {
	const pluginsDir = path.join(cwd, ".clawd", "plugins");

	// Check if plugins directory exists
	try {
		await fs.access(pluginsDir);
	} catch {
		logger.debug("No .clawd/plugins directory found, skipping plugin loading");
		return [];
	}

	logger.info("Loading plugins from .clawd/plugins/");

	// Read all files in plugins directory
	let files;
	try {
		files = await fs.readdir(pluginsDir);
	} catch (error) {
		logger.error(`Failed to read plugins directory: ${error.message}`);
		return [];
	}

	// Filter for .js files
	const jsFiles = files.filter((file) => file.endsWith(".js"));

	if (jsFiles.length === 0) {
		logger.info("No plugin files found in .clawd/plugins/");
		return [];
	}

	logger.info(`Found ${jsFiles.length} plugin file(s)`);

	const loadedPlugins = [];

	for (const file of jsFiles) {
		const pluginPath = path.join(pluginsDir, file);

		try {
			// Import the plugin module
			const pluginUrl = pathToFileURL(pluginPath).href;
			const pluginModule = await import(pluginUrl);

			// Get the default export
			const plugin = pluginModule.default;

			if (!plugin) {
				logger.warn(`Plugin ${file} does not have a default export, skipping`);
				continue;
			}

			// Validate plugin structure
			if (!plugin.name || typeof plugin.name !== "string") {
				logger.warn(`Plugin ${file} does not have a valid name, skipping`);
				continue;
			}

			if (!plugin.hooks || typeof plugin.hooks !== "object") {
				logger.warn(`Plugin ${file} does not have hooks object, skipping`);
				continue;
			}

			// Register all hooks from the plugin
			let hookCount = 0;
			for (const [hookName, hookFn] of Object.entries(plugin.hooks)) {
				try {
					hookManager.register(hookName, hookFn, plugin.name);
					hookCount++;
				} catch (error) {
					logger.error(
						`Failed to register hook ${hookName} from plugin ${plugin.name}: ${error.message}`,
					);
				}
			}

			logger.info(`✓ Loaded plugin: ${plugin.name} (${hookCount} hooks)`);
			loadedPlugins.push(plugin);
		} catch (error) {
			logger.error(`Failed to load plugin ${file}: ${error.message}`);
		}
	}

	if (loadedPlugins.length > 0) {
		logger.info(`Successfully loaded ${loadedPlugins.length} plugin(s)`);
	}

	return loadedPlugins;
}

/**
 * List all loaded plugins and their hooks
 * @returns {Object} - Object with plugin information
 */
export function listPlugins() {
	return hookManager.getAll();
}
