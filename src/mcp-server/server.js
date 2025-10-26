import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import * as answerQuestion from "./tools/answer-question.js";
import * as getPlan from "./tools/get-plan.js";
import * as getQueuedPrompts from "./tools/get-queued-prompts.js";
import * as getStatus from "./tools/get-status.js";
import * as pause from "./tools/pause.js";
import * as queuePrompt from "./tools/queue-prompt.js";
import * as resume from "./tools/resume.js";
import * as togglePerpetual from "./tools/toggle-perpetual.js";

/**
 * Create and configure the MCP server instance
 */
export function createMCPServer() {
	const server = new Server(
		{
			name: "clawd-mcp-server",
			version: "1.0.0",
		},
		{
			capabilities: {
				tools: {},
			},
		},
	);

	// Register tools
	const tools = [
		{ name: "get-status", ...getStatus },
		{ name: "get-plan", ...getPlan },
		{ name: "answer-question", ...answerQuestion },
		{ name: "queue-prompt", ...queuePrompt },
		{ name: "get-queued-prompts", ...getQueuedPrompts },
		{ name: "pause", ...pause },
		{ name: "resume", ...resume },
		{ name: "toggle-perpetual", ...togglePerpetual },
	];

	// Register list_tools handler
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return {
			tools: tools.map((tool) => ({
				name: tool.name,
				description: tool.schema.description,
				inputSchema: zodToJsonSchema(tool.schema.inputSchema, {
					target: "openApi3",
					$refStrategy: "none",
				}),
			})),
		};
	});

	// Register call_tool handler
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args } = request.params;

		const tool = tools.find((t) => t.name === name);
		if (!tool) {
			throw new Error(`Unknown tool: ${name}`);
		}

		try {
			// Validate input with zod
			const validatedArgs = tool.schema.inputSchema.parse(args || {});

			// Call the tool handler
			const result = await tool.handler(validatedArgs);

			return result;
		} catch (error) {
			// Log the error but re-throw it for proper MCP error handling
			console.error(`Error in tool ${name}:`, error);
			throw error;
		}
	});

	return server;
}
