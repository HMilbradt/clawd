import logger from "../core/logger.js";

/**
 * Context builders for different hook points
 * Each hook point receives a specific context object
 * All contexts include a logger instance and runPrompt() method
 */

/**
 * Run a prompt using the current LLM adapter
 * This function is injected into all plugin contexts
 * @param {string} prompt - The prompt to execute
 * @param {boolean} captureOutput - Whether to capture and return output (default: true)
 * @returns {Promise<string>} - The LLM's response
 */
async function runPrompt(prompt, captureOutput = true) {
	// This will be set by the adapter system
	const { getAdapter } = await import("../adapters/loader.js");
	const adapter = getAdapter();
	return adapter.execute(prompt, captureOutput);
}

/**
 * Build context for plan hooks (pre:plan, post:plan)
 * @param {string} userPrompt - The user's initial prompt
 * @param {Object} options - CLI options
 * @param {string} planContent - The generated plan content (for post:plan)
 * @returns {Object}
 */
export function buildPlanContext(userPrompt, options, planContent = null) {
	return {
		userPrompt,
		options,
		planContent,
		timestamp: new Date().toISOString(),
		logger,
		runPrompt,
	};
}

/**
 * Build context for exec hooks (pre:exec, post:exec)
 * @param {Object} task - The task being executed
 * @param {string} prompt - The prompt being sent to Claude
 * @param {Object} options - Execution options
 * @param {string} output - Claude output (for post:exec)
 * @param {number} exitCode - Claude exit code (for post:exec)
 * @returns {Object}
 */
export function buildExecContext(
	task,
	prompt,
	options,
	output = null,
	exitCode = null,
) {
	return {
		task,
		prompt,
		options,
		output,
		exitCode,
		timestamp: new Date().toISOString(),
		logger,
		runPrompt,
	};
}

/**
 * Build context for eval hooks (pre:eval, post:eval)
 * @param {Object} task - The task being evaluated
 * @param {Object} result - Evaluation result (for post:eval)
 * @param {boolean} result.complete - Whether task is complete
 * @param {string} result.feedback - Feedback for incomplete tasks
 * @returns {Object}
 */
export function buildEvalContext(task, result = null) {
	return {
		task,
		result,
		timestamp: new Date().toISOString(),
		logger,
		runPrompt,
	};
}

/**
 * Build context for complete hooks (pre:complete, post:complete)
 * @param {string} projectBrief - The project brief
 * @param {string} goal - The project goal
 * @param {Object} plan - The complete plan object
 * @param {boolean} allTasksMarkedComplete - Whether all tasks in plan are marked complete
 * @param {boolean} isComplete - Whether project is truly complete (for post:complete)
 * @returns {Object}
 */
export function buildCompleteContext(
	projectBrief,
	goal,
	plan,
	allTasksMarkedComplete,
	isComplete = null,
) {
	return {
		projectBrief,
		goal,
		plan,
		allTasksMarkedComplete,
		isComplete,
		timestamp: new Date().toISOString(),
		logger,
		runPrompt,
	};
}
