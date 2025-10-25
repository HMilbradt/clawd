import logger from "../core/logger.js";

/**
 * Hook manager for the plugin system
 * Manages registration and execution of hooks at various lifecycle points
 */
class HookManager {
	constructor() {
		// Map of hook name -> array of hook functions
		this.hooks = new Map();

		// Valid hook points in the system
		this.validHooks = [
			"pre:plan",
			"post:plan",
			"pre:exec",
			"post:exec",
			"pre:eval",
			"post:eval",
			"pre:complete",
			"post:complete",
		];
	}

	/**
	 * Register a hook function
	 * @param {string} hookName - Name of the hook (e.g., 'pre:exec')
	 * @param {Function} hookFn - Async function that receives and returns context
	 * @param {string} pluginName - Name of the plugin registering this hook
	 */
	register(hookName, hookFn, pluginName) {
		if (!this.validHooks.includes(hookName)) {
			throw new Error(
				`Invalid hook name: ${hookName}. Valid hooks: ${this.validHooks.join(", ")}`,
			);
		}

		if (typeof hookFn !== "function") {
			throw new Error(`Hook function must be a function, got ${typeof hookFn}`);
		}

		if (!this.hooks.has(hookName)) {
			this.hooks.set(hookName, []);
		}

		this.hooks.get(hookName).push({
			fn: hookFn,
			pluginName,
		});

		logger.debug(`Registered ${hookName} hook from plugin: ${pluginName}`);
	}

	/**
	 * Execute all hooks for a given hook point
	 * @param {string} hookName - Name of the hook to execute
	 * @param {Object} context - Context object to pass to hooks
	 * @returns {Promise<Object>} - Modified context after all hooks have run
	 */
	async execute(hookName, context) {
		if (!this.hooks.has(hookName)) {
			// No hooks registered for this point
			return context;
		}

		const hooks = this.hooks.get(hookName);
		logger.debug(`Executing ${hooks.length} hook(s) for ${hookName}`);

		let currentContext = context;

		for (const hook of hooks) {
			try {
				const result = await hook.fn(currentContext);

				// Hook must return a context object
				if (typeof result !== "object" || result === null) {
					logger.warn(
						`Hook ${hookName} from ${hook.pluginName} did not return an object, using previous context`,
					);
					continue;
				}

				currentContext = result;
			} catch (error) {
				logger.error(
					`Error executing ${hookName} hook from ${hook.pluginName}: ${error.message}`,
				);
				// Continue with other hooks even if one fails
			}
		}

		return currentContext;
	}

	/**
	 * Get count of registered hooks for a specific hook point
	 * @param {string} hookName - Name of the hook
	 * @returns {number}
	 */
	count(hookName) {
		return this.hooks.has(hookName) ? this.hooks.get(hookName).length : 0;
	}

	/**
	 * Clear all hooks (useful for testing)
	 */
	clear() {
		this.hooks.clear();
	}

	/**
	 * Get all registered hooks (for debugging/introspection)
	 * @returns {Object} - Object mapping hook names to arrays of plugin names
	 */
	getAll() {
		const result = {};
		for (const [hookName, hooks] of this.hooks.entries()) {
			result[hookName] = hooks.map((h) => h.pluginName);
		}
		return result;
	}
}

// Singleton instance
const hookManager = new HookManager();

export default hookManager;
