import { z } from "zod";
import stateManager from "../../core/state-manager.js";
import { logToolCall, logToolResult } from "../logger.js";

export const schema = {
	title: "Resume Execution",
	description: "Resume paused Clawd execution",
	inputSchema: z.object({}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		isPaused: z.boolean(),
	}),
};

export async function handler() {
	logToolCall("resume", {});

	if (!stateManager.isPaused) {
		const result = {
			success: false,
			message: "Execution is not paused",
			isPaused: false,
		};
		logToolResult("resume", result);
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

	stateManager.setPaused(false);

	const result = {
		success: true,
		message: "Execution resumed",
		isPaused: false,
	};

	logToolResult("resume", result);

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
