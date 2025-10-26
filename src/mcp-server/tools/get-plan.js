import { z } from "zod";
import stateManager from "../../core/state-manager.js";
import { logToolCall, logToolResult } from "../logger.js";

export const schema = {
	title: "Get Plan",
	description:
		"Get the current project plan including brief, goal, and all tasks with their status",
	inputSchema: z.object({}),
	outputSchema: z.object({
		plan: z
			.object({
				brief: z.string().optional(),
				goal: z.string().optional(),
				tasks: z
					.array(
						z.object({
							phase: z.string(),
							description: z.string(),
							done: z.boolean(),
						}),
					)
					.optional(),
			})
			.nullable(),
	}),
};

export async function handler() {
	logToolCall("get-plan", {});

	const plan = stateManager.currentPlan;

	const result = {
		plan: plan
			? {
					brief: plan.brief,
					goal: plan.goal,
					tasks: plan.tasks || [],
				}
			: null,
	};

	logToolResult("get-plan", result);

	return {
		content: [
			{
				type: "text",
				text: plan
					? JSON.stringify(result.plan, null, 2)
					: "No plan currently loaded",
			},
		],
		structuredContent: result,
	};
}
