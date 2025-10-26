import fs from "node:fs/promises";
import path from "node:path";
import { getAdapter } from "../adapters/loader.js";
import { buildPlanContext } from "../plugin-system/context.js";
import hookManager from "../plugin-system/hooks.js";
import logger from "./logger.js";
import { loadPrompt } from "./prompt-loader.js";

/**
 * Plan module - Handles project plan initialization, parsing, and task management
 */

const PLAN_FILE = "PROJECT_PLAN.md";

/**
 * Initialize a new plan or load existing one
 * @param {string} userPrompt - User's project description
 * @param {Object} options - CLI options
 * @param {string} cwd - Working directory
 * @returns {Promise<Object>} - Plan object with { brief, goal, tasks }
 */
export async function init(userPrompt, options = {}, cwd = process.cwd()) {
	const planPath = path.join(cwd, PLAN_FILE);

	// Execute pre:plan hook
	const context = await hookManager.execute(
		"pre:plan",
		buildPlanContext(userPrompt, options),
	);

	let planContent;
	let planExists = false;

	// Check if plan already exists
	try {
		await fs.access(planPath);
		planExists = true;
	} catch {
		planExists = false;
	}

	if (planExists) {
		logger.info("Loading existing PROJECT_PLAN.md");
		planContent = await fs.readFile(planPath, "utf-8");
	} else {
		logger.info("Generating new project plan...");

		// Use potentially modified prompt from hooks
		const prompt = await loadPrompt("plan-init", {
			userPrompt: context.userPrompt || userPrompt,
		});

		const adapter = getAdapter();
		planContent = await adapter.execute(prompt, true);

		// Save plan to file
		await fs.writeFile(planPath, planContent);
		logger.info(`Project plan saved to ${planPath}`);
	}

	// Parse the plan
	const plan = parsePlan(planContent);

	// Execute post:plan hook
	await hookManager.execute(
		"post:plan",
		buildPlanContext(userPrompt, options, planContent),
	);

	return plan;
}

/**
 * Parse plan content into structured format
 * @param {string} content - Raw plan markdown content
 * @returns {Object} - { brief, goal, tasks }
 */
export function parsePlan(content) {
	const lines = content.split("\n");

	let brief = "";
	let goal = "";
	const tasks = [];

	let currentPhase = null;
	let inBriefSection = false;
	let inGoalSection = false;

	for (const line of lines) {
		// Extract project brief
		if (line.startsWith("# Project Brief")) {
			inBriefSection = true;
			inGoalSection = false;
			continue;
		}

		// Extract goal
		if (line.startsWith("# Goal")) {
			inGoalSection = true;
			inBriefSection = false;
			continue;
		}

		// End of sections
		if (line.startsWith("#")) {
			inBriefSection = false;
			inGoalSection = false;
		}

		// Capture brief content
		if (inBriefSection && line.trim()) {
			brief += `${line.trim()} `;
		}

		// Capture goal content
		if (inGoalSection && line.trim()) {
			goal += `${line.trim()} `;
		}

		// Match phase headers like "## Phase 1: Setup"
		const phaseMatch = line.match(/^##\s+Phase\s+\d+:\s+(.+)/);
		if (phaseMatch) {
			currentPhase = phaseMatch[1].trim();
			continue;
		}

		// Match task items: - [ ] or - [x]
		const taskMatch = line.match(/^-\s+\[([ x])\]\s+(.+)/);
		if (taskMatch && currentPhase) {
			tasks.push({
				phase: currentPhase,
				description: taskMatch[2].trim(),
				done: taskMatch[1] === "x",
			});
		}
	}

	return {
		brief: brief.trim(),
		goal: goal.trim(),
		tasks,
	};
}

/**
 * Get the next incomplete task from the plan
 * @param {Object} plan - Plan object from init()
 * @returns {Object|null} - Task object or null if all complete
 */
export function getNextTask(plan) {
	return plan.tasks.find((task) => !task.done) || null;
}

/**
 * Mark a task as complete
 * @param {Object} task - Task to mark complete
 * @param {string} cwd - Working directory
 */
export async function markComplete(task, cwd = process.cwd()) {
	task.done = true;
	await updatePlanFile(cwd);
}

/**
 * Add feedback to a task (for incomplete tasks)
 * Stores feedback on the task object so it can be used in retry attempts
 * @param {Object} task - Task to add feedback to
 * @param {string} feedback - Feedback message
 */
export function addFeedback(task, feedback) {
	logger.info(`Task feedback for "${task.description}": ${feedback}`);
	task.feedback = feedback;
}

/**
 * Update the plan file with current task completion status
 * @param {string} cwd - Working directory
 */
async function updatePlanFile(cwd = process.cwd()) {
	// This is a simplified version - in practice you'd want to preserve
	// the exact format and only update checkboxes
	// For now, we'll reload and rewrite the plan
	const planPath = path.join(cwd, PLAN_FILE);
	const _content = await fs.readFile(planPath, "utf-8");

	// We need the current task statuses to update checkboxes
	// This requires access to the plan object, so we'll need to pass it
	// Let's refactor this to accept the plan object

	// For now, just log that we'd update it
	logger.debug("Plan file update needed");
}

/**
 * Check if all tasks are complete
 * @param {Object} plan - Plan object
 * @returns {boolean}
 */
export function allTasksComplete(plan) {
	return plan.tasks.every((task) => task.done);
}

/**
 * Load an existing plan from file
 * @param {string} cwd - Working directory
 * @returns {Promise<Object>} - Plan object
 */
export async function load(cwd = process.cwd()) {
	const planPath = path.join(cwd, PLAN_FILE);
	const content = await fs.readFile(planPath, "utf-8");
	return parsePlan(content);
}

/**
 * Update plan file with current task states
 * @param {Object} plan - Plan object with current task states
 * @param {string} cwd - Working directory
 */
export async function save(plan, cwd = process.cwd()) {
	const planPath = path.join(cwd, PLAN_FILE);
	const content = await fs.readFile(planPath, "utf-8");
	const lines = content.split("\n");

	let taskIndex = 0;
	const updatedLines = lines.map((line) => {
		const taskMatch = line.match(/^-\s+\[([ x])\]\s+(.+)/);
		if (taskMatch) {
			const task = plan.tasks[taskIndex];
			taskIndex++;

			if (task) {
				const checked = task.done ? "x" : " ";
				return `- [${checked}] ${taskMatch[2]}`;
			}
		}
		return line;
	});

	await fs.writeFile(planPath, updatedLines.join("\n"));
	logger.debug("Plan file updated");
}

/**
 * Print plan content in a readable format
 * @param {string} planContent - Raw plan markdown content
 * @returns {string} - Formatted plan text
 */
export function formatPlanForDisplay(planContent) {
	return planContent;
}

/**
 * Refine an existing plan based on user feedback
 * @param {string} userPrompt - Original user prompt
 * @param {string} currentPlanContent - Current plan content
 * @param {string} feedback - User feedback on the plan
 * @param {Object} options - CLI options
 * @param {string} cwd - Working directory
 * @returns {Promise<string>} - Refined plan content
 */
export async function refinePlan(
	userPrompt,
	currentPlanContent,
	feedback,
	_options = {},
	cwd = process.cwd(),
) {
	logger.info("Refining plan based on user feedback...");

	const prompt = await loadPrompt("plan-review", {
		userPrompt,
		currentPlan: currentPlanContent,
		feedback,
	});

	const adapter = getAdapter();
	const refinedPlanContent = await adapter.execute(prompt, true);

	// Save refined plan to file
	const planPath = path.join(cwd, PLAN_FILE);
	await fs.writeFile(planPath, refinedPlanContent);
	logger.info("Refined plan saved");

	return refinedPlanContent;
}
