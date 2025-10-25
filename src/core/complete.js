import { getAdapter } from "../adapters/loader.js";
import { buildCompleteContext } from "../plugin-system/context.js";
import hookManager from "../plugin-system/hooks.js";
import logger from "./logger.js";
import * as plan from "./plan.js";
import { loadPrompt } from "./prompt-loader.js";

/**
 * Complete module - Handles project completion evaluation
 * Triggered when all tasks in the plan are marked complete
 */

/**
 * Evaluate if the entire project is truly complete
 * This is called when all tasks in the plan are marked as done
 * @param {string} projectBrief - Project brief
 * @param {string} goal - Project goal
 * @param {Object} planObj - Plan object with tasks
 * @param {string} cwd - Working directory
 * @returns {Promise<boolean>} - true if project is complete, false if more work needed
 */
export async function evaluate(
	projectBrief,
	goal,
	planObj,
	cwd = process.cwd(),
) {
	logger.info("Evaluating overall project completion...");

	const allTasksMarkedComplete = plan.allTasksComplete(planObj);

	// Execute pre:complete hook
	await hookManager.execute(
		"pre:complete",
		buildCompleteContext(projectBrief, goal, planObj, allTasksMarkedComplete),
	);

	// Build completion evaluation prompt
	const prompt = await loadPrompt("complete-project", {
		projectBrief,
		goal,
	});

	// Ask LLM to evaluate the entire project
	const adapter = getAdapter();
	const output = await adapter.execute(prompt);
	const result = parseCompletionResult(output);

	logger.info(
		`Project completion evaluation: ${result.isComplete ? "COMPLETE" : "INCOMPLETE"}`,
	);

	// Execute post:complete hook
	await hookManager.execute(
		"post:complete",
		buildCompleteContext(
			projectBrief,
			goal,
			planObj,
			allTasksMarkedComplete,
			result.isComplete,
		),
	);

	// If incomplete and new tasks suggested, add them to the plan
	if (!result.isComplete && result.newTasks && result.newTasks.length > 0) {
		logger.info(`Adding ${result.newTasks.length} new tasks to plan`);
		await addTasksToPlan(result.newTasks, planObj, cwd);
	}

	return result.isComplete;
}

/**
 * Parse Claude's completion evaluation response
 * Expected formats:
 *   PROJECT_COMPLETE
 * or
 *   PROJECT_INCOMPLETE
 *   New Phase: [Phase Name]
 *   - [ ] Task 1
 *   - [ ] Task 2
 *
 * @param {string} output - Claude's response
 * @returns {Object} - { isComplete: boolean, newTasks: Array }
 */
function parseCompletionResult(output) {
	const trimmed = output.trim();

	if (trimmed.includes("PROJECT_COMPLETE")) {
		return { isComplete: true, newTasks: [] };
	}

	// Project is incomplete - extract any new tasks
	const newTasks = [];
	const lines = trimmed.split("\n");

	let currentPhase = null;

	for (const line of lines) {
		// Look for new phase
		const phaseMatch = line.match(/New Phase:\s*(.+)/i);
		if (phaseMatch) {
			currentPhase = phaseMatch[1].trim();
			continue;
		}

		// Look for tasks
		const taskMatch = line.match(/^-\s+\[\s*\]\s+(.+)/);
		if (taskMatch && currentPhase) {
			newTasks.push({
				phase: currentPhase,
				description: taskMatch[1].trim(),
				done: false,
			});
		}
	}

	return { isComplete: false, newTasks };
}

/**
 * Add new tasks to the project plan file
 * @param {Array} newTasks - Array of task objects
 * @param {Object} planObj - Current plan object
 * @param {string} cwd - Working directory
 */
async function addTasksToPlan(newTasks, planObj, cwd) {
	// Group tasks by phase
	const tasksByPhase = {};
	for (const task of newTasks) {
		if (!tasksByPhase[task.phase]) {
			tasksByPhase[task.phase] = [];
		}
		tasksByPhase[task.phase].push(task);
	}

	// Add to plan object
	planObj.tasks.push(...newTasks);

	// Update the plan file
	const fs = await import("fs/promises");
	const path = await import("path");
	const planPath = path.join(cwd, "PROJECT_PLAN.md");

	let content = await fs.readFile(planPath, "utf-8");

	// Append new phases at the end
	content += "\n\n";

	for (const [phaseName, tasks] of Object.entries(tasksByPhase)) {
		// Find next phase number
		const phaseCount = content.match(/^## Phase \d+:/gm)?.length || 0;
		const nextPhaseNum = phaseCount + 1;

		content += `## Phase ${nextPhaseNum}: ${phaseName}\n`;
		for (const task of tasks) {
			content += `- [ ] ${task.description}\n`;
		}
		content += "\n";
	}

	await fs.writeFile(planPath, content);
	logger.info("Plan file updated with new tasks");
}
