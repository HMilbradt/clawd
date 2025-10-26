import { z } from "zod";
import stateManager from "../../core/state-manager.js";
import { logToolCall, logToolResult } from "../logger.js";

export const schema = {
	title: "Get Queued Prompts",
	description: "Retrieve the list of queued prompts",
	inputSchema: z.object({}),
	outputSchema: z.object({
		prompts: z.array(z.string()),
		count: z.number(),
	}),
};

export async function handler() {
	logToolCall("get-queued-prompts", {});

	const prompts = stateManager.getQueuedPrompts();
	const result = {
		prompts,
		count: prompts.length,
	};

	logToolResult("get-queued-prompts", result);

	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(result, null, 2),
			},
		],
		structuredContent: result,
	};
}
