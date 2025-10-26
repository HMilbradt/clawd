import { z } from "zod";
import { ClaudeCodeAdapter } from "../../adapters/claude-code.js";
import stateManager from "../../core/state-manager.js";
import { logToolCall, logToolResult } from "../logger.js";

export const schema = {
	title: "Answer Question",
	description:
		"Answer questions about Clawd's current state, configuration, and execution using AI. Invokes Claude to analyze current state and provide intelligent responses.",
	inputSchema: z.object({
		question: z
			.string()
			.describe("The question to answer about Clawd's state or configuration"),
	}),
	outputSchema: z.object({
		answer: z.string(),
	}),
};

export async function handler({ question }) {
	logToolCall("answer-question", { question });

	// Get current state as context
	const status = stateManager.getStatus();
	const plan = stateManager.currentPlan;

	// Build context for Claude
	const context = {
		status,
		plan: plan
			? {
					brief: plan.brief,
					goal: plan.goal,
					tasks: plan.tasks,
				}
			: null,
	};

	// Build prompt for Claude
	const prompt = `You are helping analyze the state of a running Clawd instance. Clawd is an AI-powered coding assistant that executes tasks autonomously.

Current State:
${JSON.stringify(context, null, 2)}

User Question: ${question}

Please provide a clear, concise answer to the user's question based on the current state. If the question cannot be answered from the available context, explain what information is missing.`;

	// Invoke Claude asynchronously (don't wait for main execution loop)
	const adapter = new ClaudeCodeAdapter();
	const answer = await adapter.execute(prompt);

	const result = {
		answer: answer.trim(),
	};

	logToolResult("answer-question", result);

	return {
		content: [
			{
				type: "text",
				text: answer.trim(),
			},
		],
		structuredContent: result,
	};
}
