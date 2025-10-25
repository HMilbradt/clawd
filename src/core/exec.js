import { getAdapter } from "../adapters/loader.js";
import { buildExecContext } from "../plugin-system/context.js";
import hookManager from "../plugin-system/hooks.js";
import logger from "./logger.js";
import { loadPrompt } from "./prompt-loader.js";
import {
	calculateWaitTime,
	detectRateLimit,
	formatWaitTime,
	sleep,
} from "./rate-limit-handler.js";

/**
 * Exec module - Handles task execution using LLM adapter
 */

/**
 * Execute a single task using Claude
 * @param {Object} task - Task object with { phase, description, done }
 * @param {string} projectBrief - Project brief for context
 * @param {string} goal - Project goal for context
 * @param {Object} options - Execution options
 * @param {Object} tui - TUI instance (optional)
 * @returns {Promise<Object>} - { exitCode, output }
 */
export async function executeTask(
	task,
	projectBrief,
	goal,
	options = {},
	tui = null,
) {
	logger.info(`Executing task: ${task.description}`);

	// Build execution prompt
	const prompt = await loadPrompt("exec-task", {
		projectBrief,
		goal,
		phaseName: task.phase,
		stepDescription: task.description,
	});

	// Execute pre:exec hook
	const context = await hookManager.execute(
		"pre:exec",
		buildExecContext(task, prompt, options),
	);

	// Execute with retry on rate limit
	const result = await executeWithRetry(context.prompt || prompt, options, tui);

	// Execute post:exec hook
	await hookManager.execute(
		"post:exec",
		buildExecContext(task, prompt, options, result.output, result.exitCode),
	);

	return result;
}

/**
 * Execute LLM with automatic retry on rate limit
 * @param {string} prompt - Prompt to send to LLM
 * @param {Object} options - Execution options
 * @param {Object} tui - TUI instance (optional)
 * @returns {Promise<Object>} - { exitCode, output }
 */
async function executeWithRetry(prompt, options = {}, tui = null) {
	let attemptCount = 0;
	const maxAttempts = 100;
	const adapter = getAdapter();

	while (attemptCount < maxAttempts) {
		attemptCount++;

		if (attemptCount > 1) {
			logger.info(`Retry attempt ${attemptCount}`);
			if (tui) {
				tui.log(`Retry attempt ${attemptCount}`, "info");
			}
		}

		const result = await adapter.executeWithTUI(prompt, tui);

		// Success case
		if (result.exitCode === 0) {
			return result;
		}

		// Check if it's a rate limit error
		const combinedOutput = `${result.output || ""}`;
		const rateLimitInfo = detectRateLimit(combinedOutput);

		if (!rateLimitInfo) {
			// Not a rate limit error - return the failure
			logger.error(`Task failed with exit code ${result.exitCode}`);
			if (tui) {
				tui.log(`Task failed with exit code ${result.exitCode}`, "error");
			}
			return result;
		}

		// Rate limit detected - wait and retry
		const waitTime = calculateWaitTime(rateLimitInfo.resetTime);
		const waitTimeFormatted = formatWaitTime(waitTime);

		const rateLimitMsg = `⏳ Rate limit detected. Waiting ${waitTimeFormatted} before retry...`;
		logger.info(rateLimitMsg);

		if (tui) {
			tui.log(rateLimitMsg, "warn");

			const waitIndicator = tui.showRateLimitWaiting(
				waitTime,
				rateLimitInfo.resetTime,
			);

			const updateInterval = setInterval(() => {
				const shouldContinue = waitIndicator.update();
				if (!shouldContinue) {
					clearInterval(updateInterval);
				}
			}, 30000);

			await sleep(waitTime);

			clearInterval(updateInterval);
			waitIndicator.hide();

			tui.log("✓ Wait complete - retrying now...", "success");
		} else {
			console.log(rateLimitMsg);
			await sleep(waitTime);
			console.log("✓ Wait complete - retrying now...");
		}
	}

	// Exhausted all attempts
	const errorMsg = `Failed after ${maxAttempts} retry attempts`;
	logger.error(errorMsg);
	if (tui) {
		tui.log(errorMsg, "error");
	}

	return { exitCode: 1, output: "" };
}
