import logger from "./logger.js";
import { spawnClaude } from "./claude-helper.js";
import { loadPrompt } from "./prompt-loader.js";

export async function evaluateCompletion(projectBrief, goal) {
	logger.info("Evaluating project completion status...");

	const evaluationPrompt = await loadPrompt("completion-evaluation", {
		projectBrief,
		goal,
	});
	const output = await spawnClaude(evaluationPrompt);
	const result = output.trim();
	const isComplete = result.includes("PROJECT_COMPLETE");

	logger.info(`Evaluation result: ${isComplete ? "COMPLETE" : "INCOMPLETE"}`);
	return isComplete;
}
