import fs from "fs/promises";
import path from "path";
import logger from "./logger.js";
import { spawnClaude } from "./claude-helper.js";
import { loadPrompt } from "./prompt-loader.js";

export async function expandFeatures(projectBrief, goal, currentPlan) {
	logger.info("Researching and expanding features for perpetual mode...");

	const expansionPrompt = await loadPrompt("feature-expansion", {
		projectBrief,
		goal,
		currentPlan,
	});
	const output = await spawnClaude(expansionPrompt);

	// Append new phases to the plan
	const planPath = path.join(process.cwd(), "PROJECT_PLAN.md");
	const existingPlan = await fs.readFile(planPath, "utf-8");
	const expandedPlan = existingPlan + "\n\n" + output;
	await fs.writeFile(planPath, expandedPlan);

	logger.info("New phases added to project plan");
	return output;
}
