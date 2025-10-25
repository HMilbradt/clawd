import logger from "./logger.js";
import { spawnClaude } from "./claude-helper.js";
import { loadPrompt } from "./prompt-loader.js";
import {
	getDiff,
	getCommitsSince,
	getCommitMessage,
	getCommitDiff,
} from "./git-setup.js";

/**
 * Evaluate if a phase has been completed successfully
 * @param {Object} phase - Phase object with name and steps
 * @param {string} baseBranch - Base branch to compare against (usually 'main')
 * @param {string} phaseBranch - Branch where the phase was executed
 * @param {string} projectBrief - Project brief for context
 * @param {string} goal - Project goal for context
 * @param {string} cwd - Working directory
 * @returns {Promise<{complete: boolean, incompleteSteps: Array<{stepIndex: number, description: string, feedback: string}>}>}
 */
export async function evaluatePhase(
	phase,
	baseBranch,
	phaseBranch,
	projectBrief,
	goal,
	cwd = process.cwd(),
) {
	logger.info(`Evaluating phase completion: ${phase.name}`);

	// Get all commits in the phase branch
	const commits = await getCommitsSince(baseBranch, cwd);

	if (commits.length === 0) {
		logger.warn("No commits found in phase branch");
		return {
			complete: false,
			incompleteSteps: phase.steps.map((step, index) => ({
				stepIndex: index,
				description: step.description,
				feedback:
					"No changes were made for this step. Please implement the required functionality.",
			})),
		};
	}

	// Get commit details for context
	const commitDetails = await Promise.all(
		commits.map(async (hash) => {
			const message = await getCommitMessage(hash, cwd);
			const diff = await getCommitDiff(hash, cwd);
			return { hash, message, diff };
		}),
	);

	// Get overall phase diff
	const phaseDiff = await getDiff(baseBranch, phaseBranch, cwd);

	// Prepare step descriptions for evaluation
	const stepDescriptions = phase.steps
		.map((step, index) => `${index + 1}. ${step.description}`)
		.join("\n");

	// Prepare commit summary
	const commitSummary = commitDetails
		.map((c, i) => `Commit ${i + 1}: ${c.message}`)
		.join("\n");

	// Prepare evaluation prompt
	const evaluationPrompt = await loadPrompt("phase-evaluation", {
		phaseName: phase.name,
		stepDescriptions,
		commitSummary,
		phaseDiff,
		projectBrief,
		goal,
	});

	// Ask Claude to evaluate the phase
	const output = await spawnClaude(evaluationPrompt);
	const result = output.trim();

	// Parse the evaluation result
	if (result.includes("PHASE_COMPLETE")) {
		logger.info("✓ Phase evaluation: COMPLETE");
		return { complete: true, incompleteSteps: [] };
	}

	// Parse incomplete steps
	// Expected format:
	// PHASE_INCOMPLETE
	// Step 2: [description]
	// Feedback: [feedback for step 2]
	//
	// Step 5: [description]
	// Feedback: [feedback for step 5]

	const incompleteSteps = [];
	const lines = result.split("\n");

	let currentStepIndex = null;
	let currentDescription = "";
	let currentFeedback = "";

	for (const line of lines) {
		// Match "Step N: description"
		const stepMatch = line.match(/^Step (\d+):\s*(.+)/);
		if (stepMatch) {
			// Save previous step if exists
			if (currentStepIndex !== null) {
				incompleteSteps.push({
					stepIndex: currentStepIndex,
					description: currentDescription,
					feedback: currentFeedback.trim(),
				});
			}

			// Start new step
			currentStepIndex = parseInt(stepMatch[1]) - 1; // Convert to 0-based index
			currentDescription = stepMatch[2].trim();
			currentFeedback = "";
			continue;
		}

		// Match "Feedback: ..."
		const feedbackMatch = line.match(/^Feedback:\s*(.+)/);
		if (feedbackMatch && currentStepIndex !== null) {
			currentFeedback = feedbackMatch[1];
			continue;
		}

		// Continuation of feedback
		if (
			currentStepIndex !== null &&
			line.trim() &&
			!line.startsWith("PHASE_")
		) {
			currentFeedback += "\n" + line;
		}
	}

	// Save last step
	if (currentStepIndex !== null) {
		incompleteSteps.push({
			stepIndex: currentStepIndex,
			description: currentDescription,
			feedback: currentFeedback.trim(),
		});
	}

	logger.info("Phase evaluation: INCOMPLETE");
	logger.info(`Incomplete steps: ${incompleteSteps.length}`);

	return { complete: false, incompleteSteps };
}
