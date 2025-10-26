import logger from "../core/logger.js";

/**
 * MCP-specific logger
 * Wraps the core logger with MCP-specific formatting
 */

export function logToolCall(toolName, parameters) {
	logger.info(`[MCP] Tool called: ${toolName}`, { parameters });
}

export function logToolResult(toolName, result) {
	logger.info(`[MCP] Tool result: ${toolName}`, {
		result: typeof result === "string" ? result : JSON.stringify(result),
	});
}

export function logToolError(toolName, error) {
	logger.error(`[MCP] Tool error: ${toolName}`, {
		error: error.message,
		stack: error.stack,
	});
}

export function logServerStart(url, port, protocol) {
	logger.info(`[MCP] Server started: ${protocol}://${url}:${port}`);
}

export function logServerStop() {
	logger.info("[MCP] Server stopped");
}

export function logRequest(method, path) {
	logger.debug(`[MCP] ${method} ${path}`);
}
