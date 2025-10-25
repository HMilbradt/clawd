import { spawn } from "node:child_process";
import logger from "../core/logger.js";
import { LLMAdapter } from "./base.js";

/**
 * Claude Code CLI adapter
 * Executes prompts using the Claude Code CLI with --dangerously-skip-permissions
 */
export class ClaudeCodeAdapter extends LLMAdapter {
	constructor(config = {}) {
		super(config);
		this.command = config.command || "claude";
		this.args = config.args || ["--dangerously-skip-permissions"];
	}

	/**
	 * Execute a prompt and return the response
	 * @param {string} prompt - The prompt to execute
	 * @param {boolean} captureOutput - Whether to capture and return output
	 * @returns {Promise<string>} - Claude's response
	 */
	async execute(prompt, _captureOutput = true) {
		logger.debug("LLM Input (execute):", { prompt });

		return new Promise((resolve, reject) => {
			const claude = spawn(this.command, [...this.args, "-p", prompt], {
				stdio: ["pipe", "pipe", "pipe"],
			});

			// Close stdin immediately - Claude doesn't need it in -p mode
			claude.stdin.end();

			let output = "";
			let errorOutput = "";

			claude.stdout.on("data", (data) => {
				const chunk = data.toString();
				output += chunk;
			});

			claude.stderr.on("data", (data) => {
				const chunk = data.toString();
				errorOutput += chunk;
			});

			claude.on("error", (err) => {
				logger.error(`Failed to spawn Claude: ${err.message}`);
				reject(new Error(`Failed to spawn Claude: ${err.message}`));
			});

			claude.on("close", (code) => {
				if (code !== 0) {
					// Capture both stdout and stderr for better error context
					const fullOutput = output.trim();
					const fullError = errorOutput.trim();

					// Log with more detail
					logger.error(`Claude process failed with exit code ${code}`, {
						exitCode: code,
						stdout: fullOutput || "(empty)",
						stderr: fullError || "(empty)",
						command: `${this.command} ${this.args.join(" ")} -p [prompt]`,
					});

					logger.debug("LLM Output (execute - error):", {
						exitCode: code,
						output: fullOutput || "(empty)",
						error: fullError || "(empty)",
					});

					// Create detailed error message
					const errorDetails = [];
					if (fullOutput) errorDetails.push(`stdout: ${fullOutput}`);
					if (fullError) errorDetails.push(`stderr: ${fullError}`);
					const errorMessage =
						errorDetails.length > 0
							? errorDetails.join(" | ")
							: "No output captured";

					reject(
						new Error(`Claude failed (exit code ${code}): ${errorMessage}`),
					);
					return;
				}

				logger.debug("LLM Output (execute - success):", { output });
				resolve(output);
			});
		});
	}

	/**
	 * Execute a prompt with TUI output streaming
	 * @param {string} prompt - The prompt to execute
	 * @param {Object} tui - TUI instance for output streaming
	 * @returns {Promise<{exitCode: number, output: string}>}
	 */
	async executeWithTUI(prompt, tui) {
		logger.debug("LLM Input (executeWithTUI):", { prompt });

		return new Promise((resolve) => {
			const stdioConfig = tui ? ["pipe", "pipe", "pipe"] : "inherit";

			const claude = spawn(this.command, [...this.args, "-p", prompt], {
				stdio: stdioConfig,
			});

			// Close stdin immediately - Claude doesn't need it in -p mode
			if (tui) {
				claude.stdin.end();
			}

			let output = "";

			// Capture output if using TUI
			if (tui) {
				claude.stdout.on("data", (data) => {
					output += data.toString();
					tui.writeOutput(data);
				});

				claude.stderr.on("data", (data) => {
					output += data.toString();
					tui.writeOutput(data);
				});
			}

			claude.on("close", (exitCode) => {
				if (exitCode !== 0) {
					logger.error(`Claude process exited with code ${exitCode}`);
				}

				logger.debug("LLM Output (executeWithTUI):", {
					exitCode: exitCode || 0,
					output,
				});

				resolve({ exitCode: exitCode || 0, output });
			});

			claude.on("error", (err) => {
				logger.error(`Failed to spawn Claude: ${err.message}`);
				resolve({ exitCode: 1, output: err.message });
			});
		});
	}

	/**
	 * Validate that Claude Code is available
	 * @returns {boolean}
	 */
	validate() {
		// Could add check for `which claude` here
		return true;
	}

	/**
	 * Get adapter name
	 * @returns {string}
	 */
	getName() {
		return "Claude Code";
	}
}
