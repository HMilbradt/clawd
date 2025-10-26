import http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express from "express";
import logger from "../core/logger.js";
import hookManager from "../plugin-system/hooks.js";
import { logRequest, logServerStart, logServerStop } from "./logger.js";
import { createMCPServer } from "./server.js";

/**
 * Start the MCP server with HTTP transport
 * @param {number} port - Port to listen on (default: 3000)
 * @returns {Promise<Object>} - Server info { url, port, protocol, httpServer }
 */
export async function startMCPServer(port = 3000) {
	const app = express();

	// Enable CORS for all origins (development tool)
	app.use(
		cors({
			origin: "*",
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: "*",
			exposedHeaders: "*",
			credentials: false,
			preflightContinue: false,
			optionsSuccessStatus: 204,
		}),
	);

	app.use(express.json());

	// MCP endpoint - create new server and transport for each request
	app.post("/mcp", async (req, res) => {
		logRequest("POST", "/mcp");

		try {
			// Create new MCP server instance for this request
			const mcpServer = createMCPServer();

			// Create new transport for this request
			const transport = new StreamableHTTPServerTransport({
				sessionIdHeader: "Mcp-Session-Id",
			});

			// Clean up transport when response closes
			res.on("close", () => {
				transport.close();
			});

			// Connect transport to MCP server
			await mcpServer.connect(transport);

			// Handle the request (pass req.body as third parameter)
			await transport.handleRequest(req, res, req.body);
		} catch (error) {
			logger.error(
				{ stack: error.stack },
				`Error handling MCP request: ${error.message}`,
			);
			if (!res.headersSent) {
				// Return JSON-RPC error format
				res.status(500).json({
					jsonrpc: "2.0",
					error: {
						code: -32603,
						message: "Internal server error",
						data: {
							error: error.message,
							stack: error.stack,
						},
					},
					id: null,
				});
			}
		}
	});

	// Health check endpoint
	app.get("/health", (_req, res) => {
		res.json({ status: "ok", server: "clawd-mcp-server" });
	});

	// Global error handler for Express
	app.use((error, req, res, _next) => {
		logger.error("Express error handler:", error);
		logger.error("Request path:", req.path);
		logger.error("Request method:", req.method);
		if (!res.headersSent) {
			res.status(500).json({
				error: "Internal server error",
				message: error.message,
			});
		}
	});

	// Create HTTP server
	const httpServer = http.createServer(app);

	// Handle HTTP server errors
	httpServer.on("error", (error) => {
		logger.error("HTTP server error:", error);
	});

	httpServer.on("clientError", (error, socket) => {
		logger.error("HTTP client error:", error);
		socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
	});

	// Start listening
	await new Promise((resolve, reject) => {
		httpServer.listen(port, "localhost", (error) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});

	const actualPort = httpServer.address().port;
	const url = "localhost";
	const protocol = "http";

	logServerStart(url, actualPort, protocol);

	// Trigger mcp:started hook
	await hookManager.execute("mcp:started", {
		url,
		port: actualPort,
		protocol,
		timestamp: new Date().toISOString(),
	});

	return {
		url,
		port: actualPort,
		protocol,
		httpServer,
	};
}

/**
 * Stop the MCP server
 * @param {Object} serverInfo - Server info from startMCPServer
 */
export async function stopMCPServer(serverInfo) {
	if (!serverInfo?.httpServer) {
		return;
	}

	await new Promise((resolve, reject) => {
		serverInfo.httpServer.close((err) => {
			if (err) {
				reject(err);
			} else {
				logServerStop();
				resolve();
			}
		});
	});
}
