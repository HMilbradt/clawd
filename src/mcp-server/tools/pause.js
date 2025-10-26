import { z } from "zod";
import stateManager from "../../core/state-manager.js";
import { logToolCall, logToolResult } from "../logger.js";

export const schema = {
	title: "Pause Execution",
	description: "Pause Clawd execution. Can be resumed with resume tool.",
	inputSchema: z.object({}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		isPaused: z.boolean(),
	}),
};

export async function handler() {
	logToolCall("pause", {});

	if (stateManager.isPaused) {
		const result = {
			success: false,
			message: "Execution is already paused",
			isPaused: true,
		};
		logToolResult("pause", result);
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

	stateManager.setPaused(true);

	const result = {
		success: true,
		message: "Execution paused",
		isPaused: true,
	};

	logToolResult("pause", result);

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
