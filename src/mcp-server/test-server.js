#!/usr/bin/env node

/**
 * Simple test script for MCP server
 * Run this to verify the MCP server works without running full Clawd
 */

import { startMCPServer } from "./index.js";

async function test() {
	console.log("Starting MCP server test...");

	try {
		const serverInfo = await startMCPServer();
		console.log(
			`✓ MCP server started at ${serverInfo.protocol}://${serverInfo.url}:${serverInfo.port}`,
		);
		console.log("\nTest the server with:");
		console.log(
			`  npx @modelcontextprotocol/inspector http://localhost:${serverInfo.port}/mcp`,
		);
		console.log("\nOr test the health endpoint:");
		console.log(`  curl http://localhost:${serverInfo.port}/health`);
		console.log("\nPress Ctrl+C to stop the server");

		// Keep running
		await new Promise(() => {});
	} catch (error) {
		console.error("❌ Error starting MCP server:", error);
		process.exit(1);
	}
}

test();
