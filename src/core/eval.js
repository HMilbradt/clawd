import { getAdapter } from "../adapters/loader.js";
import { buildEvalContext } from "../plugin-system/context.js";
import hookManager from "../plugin-system/hooks.js";
import logger from "./logger.js";
import { loadPrompt } from "./prompt-loader.js";

/**
 * Eval module - Handles task evaluation
 */

/**
 * Evaluate if a task was completed successfully
 * @param {Object} task - Task object with { phase, description, done }
 * @param {string} projectBrief - Project brief for context
 * @param {string} goal - Project goal for context
 * @returns {Promise<Object>} - { complete: boolean, feedback: string }
 */
export async function evaluateTask(task, projectBrief, goal) {
	logger.info(`Evaluating task: ${task.description}`);

	// Execute pre:eval hook
	await hookManager.execute("pre:eval", buildEvalContext(task));

	// Build evaluation prompt
	const prompt = await loadPrompt("eval-task", {
		projectBrief,
		goal,
		phaseName: task.phase,
		stepDescription: task.description,
	});

	// Ask LLM to evaluate
	const adapter = getAdapter();
	const output = await adapter.execute(prompt);
	const result = parseEvaluationResult(output);

	logger.info(
		`Evaluation result: ${result.complete ? "COMPLETE" : "INCOMPLETE"}`,
	);
	if (!result.complete) {
		logger.info(`Feedback: ${result.feedback}`);
	}

	// Execute post:eval hook
	await hookManager.execute("post:eval", buildEvalContext(task, result));

	return result;
}

/**
 * Parse Claude's evaluation response
 * Expected format:
 *   TASK_COMPLETE
 * or
 *   TASK_INCOMPLETE
 *   Feedback: [specific feedback about what's missing]
 *
 * @param {string} output - Claude's response
 * @returns {Object} - { complete: boolean, feedback: string }
 */
function parseEvaluationResult(output) {
	const trimmed = output.trim();

	if (trimmed.includes("TASK_COMPLETE")) {
		return { complete: true, feedback: "" };
	}

	// Extract feedback
	const feedbackMatch = trimmed.match(/Feedback:\s*(.+)/s);
	const feedback = feedbackMatch
		? feedbackMatch[1].trim()
		: "The task implementation is incomplete. Please review the requirements.";

	return { complete: false, feedback };
}
