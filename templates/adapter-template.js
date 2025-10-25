import { LLMAdapter } from "../src/adapters/base.js";

/**
 * Custom LLM Adapter Template
 *
 * This template shows how to create a custom adapter for any LLM provider.
 * Place this file at .clawd/adapter.js in your project to use it.
 *
 * Example use cases:
 * - Use OpenAI API instead of Claude Code
 * - Use local LLM (Ollama, LM Studio, etc.)
 * - Use Azure OpenAI
 * - Add custom pre/post-processing
 */
export default class CustomAdapter extends LLMAdapter {
	constructor(config = {}) {
		super(config);
		// Add your configuration here
		// this.apiKey = config.apiKey || process.env.YOUR_API_KEY;
		// this.model = config.model || "your-model-name";
	}

	/**
	 * Execute a prompt and return the response
	 * This is used for short, non-interactive prompts (plan generation, evaluation)
	 *
	 * @param {string} prompt - The prompt to execute
	 * @param {boolean} captureOutput - Whether to capture and return output
	 * @returns {Promise<string>} - The LLM's response
	 */
	async execute(prompt, captureOutput = true) {
		// Example implementation:
		// 1. Call your LLM API
		// 2. Return the response text

		try {
			// Replace this with your actual API call
			const response = await this.callYourLLM(prompt);
			return response;
		} catch (error) {
			throw new Error(`LLM execution failed: ${error.message}`);
		}
	}

	/**
	 * Execute a prompt with TUI output streaming
	 * This is used for task execution where we want to stream output to the TUI
	 *
	 * @param {string} prompt - The prompt to execute
	 * @param {Object} tui - TUI instance for output streaming (may be null)
	 * @returns {Promise<{exitCode: number, output: string}>}
	 */
	async executeWithTUI(prompt, tui) {
		try {
			let output = "";

			// If TUI is available, stream output to it
			if (tui) {
				// Example: stream response chunks to TUI
				const stream = await this.callYourLLMWithStreaming(prompt);

				for await (const chunk of stream) {
					output += chunk;
					tui.writeOutput(chunk);
				}
			} else {
				// No TUI - just get the full response
				output = await this.callYourLLM(prompt);
			}

			return { exitCode: 0, output };
		} catch (error) {
			return { exitCode: 1, output: error.message };
		}
	}

	/**
	 * Example: Call your LLM API
	 * Replace this with your actual implementation
	 */
	async callYourLLM(prompt) {
		// Example for OpenAI:
		// const response = await fetch('https://api.openai.com/v1/chat/completions', {
		//   method: 'POST',
		//   headers: {
		//     'Authorization': `Bearer ${this.apiKey}`,
		//     'Content-Type': 'application/json'
		//   },
		//   body: JSON.stringify({
		//     model: this.model,
		//     messages: [{ role: 'user', content: prompt }]
		//   })
		// });
		// const data = await response.json();
		// return data.choices[0].message.content;

		throw new Error("callYourLLM() must be implemented");
	}

	/**
	 * Example: Call your LLM API with streaming
	 * Replace this with your actual implementation
	 */
	async* callYourLLMWithStreaming(prompt) {
		// Example for streaming API:
		// const response = await fetch(...)
		// const reader = response.body.getReader();
		// const decoder = new TextDecoder();
		//
		// while (true) {
		//   const { done, value } = await reader.read();
		//   if (done) break;
		//   yield decoder.decode(value);
		// }

		throw new Error("callYourLLMWithStreaming() must be implemented");
	}

	/**
	 * Validate adapter configuration
	 * @returns {boolean}
	 */
	validate() {
		// Add validation logic here
		// return !!this.apiKey;
		return true;
	}

	/**
	 * Get adapter name
	 * @returns {string}
	 */
	getName() {
		return "Custom LLM Adapter";
	}
}
