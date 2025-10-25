import logger from "./logger.js";
import { spawnClaude } from "./claude-helper.js";
import { loadPrompt } from "./prompt-loader.js";
import { getDiff } from "./git-setup.js";

/**
 * Evaluate if a step has been completed successfully
 * @param {string} stepDescription - Description of the step from the plan
 * @param {string} baseBranch - Base branch to compare against (usually 'main')
 * @param {string} stepBranch - Branch where the step was executed
 * @param {string} projectBrief - Project brief for context
 * @param {string} goal - Project goal for context
 * @param {string} cwd - Working directory
 * @returns {Promise<{complete: boolean, feedback: string}>}
 */
export async function evaluateStep(
	stepDescription,
	baseBranch,
	stepBranch,
	projectBrief,
	goal,
	cwd = process.cwd(),
) {
	logger.info(`Evaluating step completion: ${stepDescription}`);

	// Get the git diff for changes made in this step
	const diff = await getDiff(baseBranch, stepBranch, cwd);

	if (!diff || diff.trim().length === 0) {
		logger.warn("No changes detected in step branch");
		return {
			complete: false,
			feedback:
				"No changes were made. Please implement the required functionality for this step.",
		};
	}

	// Prepare evaluation prompt
	const evaluationPrompt = await loadPrompt("step-evaluation", {
		stepDescription,
		projectBrief,
		goal,
		gitDiff: diff,
	});

	// Ask Claude to evaluate the changes
	const output = await spawnClaude(evaluationPrompt);
	const result = output.trim();

	// Parse the evaluation result
	// Expected format:
	// STEP_COMPLETE
	// or
	// STEP_INCOMPLETE
	// Feedback: [detailed feedback about what's missing]

	if (result.includes("STEP_COMPLETE")) {
		logger.info("✓ Step evaluation: COMPLETE");
		return { complete: true, feedback: "" };
	}

	// Extract feedback from the response
	const feedbackMatch = result.match(/Feedback:\s*(.+)/s);
	const feedback = feedbackMatch
		? feedbackMatch[1].trim()
		: "The step implementation is incomplete. Please review the requirements and ensure all functionality is implemented.";

	logger.info("Step evaluation: INCOMPLETE");
	logger.info(`Feedback: ${feedback}`);

	return { complete: false, feedback };
}

/**
 * Check if all steps in all phases are marked as done
 * @param {Array} phases - Array of phase objects with steps
 * @returns {boolean}
 */
export function allStepsComplete(phases) {
	for (const phase of phases) {
		for (const step of phase.steps) {
			if (!step.done) {
				return false;
			}
		}
	}
	return true;
}
