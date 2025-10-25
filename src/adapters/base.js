/**
 * Base adapter class for LLM providers
 * All adapters should extend this class and implement the required methods
 */
export class LLMAdapter {
	/**
	 * @param {Object} config - Adapter configuration
	 */
	constructor(config = {}) {
		this.config = config;
	}

	/**
	 * Execute a prompt and return the response
	 * @param {string} prompt - The prompt to execute
	 * @param {boolean} captureOutput - Whether to capture and return output
	 * @returns {Promise<string>} - The LLM's response
	 */
	async execute(_prompt, _captureOutput = true) {
		throw new Error("execute() must be implemented by adapter");
	}

	/**
	 * Execute a prompt with TUI output streaming
	 * @param {string} prompt - The prompt to execute
	 * @param {Object} tui - TUI instance for output streaming
	 * @returns {Promise<{exitCode: number, output: string}>}
	 */
	async executeWithTUI(_prompt, _tui) {
		throw new Error("executeWithTUI() must be implemented by adapter");
	}

	/**
	 * Get the adapter name
	 * @returns {string}
	 */
	getName() {
		return this.constructor.name;
	}

	/**
	 * Validate adapter configuration
	 * @returns {boolean}
	 */
	validate() {
		return true;
	}
}
