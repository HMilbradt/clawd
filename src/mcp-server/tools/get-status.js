import { z } from "zod";
import stateManager from "../../core/state-manager.js";
import { logToolCall, logToolResult } from "../logger.js";

export const schema = {
	title: "Get Status",
	description:
		"Get current Clawd execution status, including project state, progress, and settings",
	inputSchema: z.object({}),
	outputSchema: z.object({
		execution: z.object({
			isRunning: z.boolean(),
			isPaused: z.boolean(),
			cancelRequested: z.boolean(),
			runtime: z.number(),
		}),
		project: z.object({
			brief: z.string().optional(),
			goal: z.string().optional(),
			currentTask: z
				.object({
					phase: z.string(),
					description: z.string(),
					done: z.boolean(),
				})
				.optional(),
			currentPhase: z.string().optional(),
		}),
		progress: z.object({
			iteration: z.number(),
			stepsComplete: z.number(),
			totalSteps: z.number(),
		}),
		settings: z.object({
			perpetualMode: z.boolean(),
		}),
		prompts: z.object({
			queued: z.number(),
			list: z.array(z.string()),
		}),
	}),
};

export async function handler() {
	logToolCall("get-status", {});

	const status = stateManager.getStatus();

	logToolResult("get-status", status);

	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(status, null, 2),
			},
		],
		structuredContent: status,
	};
}
