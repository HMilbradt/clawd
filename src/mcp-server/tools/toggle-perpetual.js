import { z } from "zod";
import stateManager from "../../core/state-manager.js";
import { logToolCall, logToolResult } from "../logger.js";

export const schema = {
	title: "Toggle Perpetual Mode",
	description:
		"Toggle perpetual mode on/off. When enabled, Clawd continues to add new features after project completion.",
	inputSchema: z.object({
		enabled: z
			.boolean()
			.optional()
			.describe(
				"Set to true/false to explicitly enable/disable, or omit to toggle",
			),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		perpetualMode: z.boolean(),
	}),
};

export async function handler({ enabled }) {
	logToolCall("toggle-perpetual", { enabled });

	let newState;
	if (enabled === undefined) {
		// Toggle
		newState = stateManager.togglePerpetualMode();
	} else {
		// Explicit set
		stateManager.setPerpetualMode(enabled);
		newState = enabled;
	}

	const result = {
		success: true,
		message: `Perpetual mode ${newState ? "enabled" : "disabled"}`,
		perpetualMode: newState,
	};

	logToolResult("toggle-perpetual", result);

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
