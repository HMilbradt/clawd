import { z } from "zod";
import stateManager from "../../core/state-manager.js";
import { logToolCall, logToolResult } from "../logger.js";

export const schema = {
	title: "Queue Prompt",
	description:
		"Queue a new prompt for Clawd to process after the current task completes",
	inputSchema: z.object({
		prompt: z.string().describe("The prompt to queue for processing"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		queuedCount: z.number(),
	}),
};

export async function handler({ prompt }) {
	logToolCall("queue-prompt", { prompt });

	if (!prompt || !prompt.trim()) {
		const error = {
			success: false,
			message: "Prompt cannot be empty",
			queuedCount: stateManager.getQueuedPrompts().length,
		};
		logToolResult("queue-prompt", error);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(error),
				},
			],
			structuredContent: error,
		};
	}

	stateManager.queuePrompt(prompt.trim());
	const queuedCount = stateManager.getQueuedPrompts().length;

	const result = {
		success: true,
		message: `Prompt queued successfully. Total queued: ${queuedCount}`,
		queuedCount,
	};

	logToolResult("queue-prompt", result);

	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(result),
			},
		],
		structuredContent: result,
	};
}
