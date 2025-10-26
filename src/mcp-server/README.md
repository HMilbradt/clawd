# Clawd MCP Server

The Clawd MCP (Model Context Protocol) server exposes Clawd's functionality to other applications via a standardized protocol. This allows external tools and AI applications to interact with Clawd programmatically.

## Overview

When Clawd starts, it automatically launches an MCP server using Streamable HTTP transport. The server runs on localhost with a dynamically assigned port and provides tools for:

- Querying Clawd's execution status
- Queueing prompts for processing
- Pausing and resuming execution
- Toggling perpetual mode
- Answering questions about Clawd's state

## Architecture

```
src/mcp-server/
├── index.js              # HTTP server setup with Streamable HTTP transport
├── server.js             # MCP server instance and tool registration
├── logger.js             # MCP-specific logging
├── tools/                # Tool implementations
│   ├── answer-question.js
│   ├── get-status.js
│   ├── get-queued-prompts.js
│   ├── queue-prompt.js
│   ├── pause.js
│   ├── resume.js
│   └── toggle-perpetual.js
└── README.md             # This file
```

## Available Tools

### get-status
Get current Clawd execution status, including project state, progress, and settings.

**Input:** None

**Output:**
```json
{
  "execution": {
    "isRunning": true,
    "isPaused": false,
    "cancelRequested": false
  },
  "project": {
    "brief": "Project description",
    "goal": "Project goal",
    "currentTask": {
      "phase": "Implementation",
      "description": "Task description",
      "done": false
    },
    "currentPhase": "Implementation"
  },
  "progress": {
    "iteration": 5,
    "stepsComplete": 3,
    "totalSteps": 10
  },
  "settings": {
    "perpetualMode": false
  },
  "prompts": {
    "queued": 0,
    "list": []
  }
}
```

### answer-question
Answer questions about Clawd's current state, configuration, and execution.

**Input:**
```json
{
  "question": "What is the current task?"
}
```

**Output:**
```json
{
  "answer": "Current task: Implement user authentication (Phase: Implementation)",
  "context": {
    "currentTask": {
      "phase": "Implementation",
      "description": "Implement user authentication",
      "done": false
    }
  }
}
```

### queue-prompt
Queue a new prompt for Clawd to process after the current task completes.

**Input:**
```json
{
  "prompt": "Add error handling to the login flow"
}
```

**Output:**
```json
{
  "success": true,
  "message": "Prompt queued successfully. Total queued: 1",
  "queuedCount": 1
}
```

### get-queued-prompts
Retrieve the list of queued prompts.

**Input:** None

**Output:**
```json
{
  "prompts": ["Add error handling", "Write tests"],
  "count": 2
}
```

### pause
Pause Clawd execution. Can be resumed with the resume tool.

**Input:** None

**Output:**
```json
{
  "success": true,
  "message": "Execution paused",
  "isPaused": true
}
```

### resume
Resume paused Clawd execution.

**Input:** None

**Output:**
```json
{
  "success": true,
  "message": "Execution resumed",
  "isPaused": false
}
```

### toggle-perpetual
Toggle perpetual mode on/off. When enabled, Clawd continues to add new features after project completion.

**Input (optional):**
```json
{
  "enabled": true
}
```

**Output:**
```json
{
  "success": true,
  "message": "Perpetual mode enabled",
  "perpetualMode": true
}
```

## Testing with MCP Inspector

You can test the MCP server using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector http://localhost:<port>/mcp
```

Replace `<port>` with the port number shown when Clawd starts. The inspector provides an interactive interface to explore and test all available tools.

## Plugin Hook: mcp:started

Plugins can listen for the `mcp:started` hook to receive the MCP server connection information:

```javascript
export default {
  name: "my-plugin",
  hooks: {
    "mcp:started": async (context) => {
      const { url, port, protocol } = context;
      console.log(`MCP server available at ${protocol}://${url}:${port}`);

      // You can now connect to the MCP server from your plugin
      return context;
    }
  }
};
```

## Transport

The MCP server uses **Streamable HTTP** transport (not stdio or SSE). This allows:

- Easy deployment and testing
- HTTP-based communication
- Session management via headers
- Support for tools that require HTTP endpoints

## Security

The MCP server:

- Runs on localhost only (not exposed to external networks)
- Uses a dynamic port
- Has no authentication (intended for development use only)
- Should not be deployed to production environments

## State Management

The MCP server shares state with the TUI and core execution logic through the centralized `state-manager`. This ensures that:

- Status queries return real-time data
- Prompt queueing works seamlessly with the TUI
- Pause/resume commands affect actual execution
- All state changes are synchronized across components

## Logging

All MCP requests and tool invocations are logged using the core logger. Check the logs to see:

- Tool calls with parameters
- Tool results
- Server start/stop events
- Request handling

## Implementation Notes

- The server starts automatically when Clawd initializes
- The server stops automatically when Clawd exits
- All tools use Zod for schema validation
- Tool handlers are async functions
- Errors are caught and logged appropriately
- Each request creates a new MCP server and transport instance (stateless design)

## Testing the Server

You can test the MCP server independently without running full Clawd:

```bash
node src/mcp-server/test-server.js
```

This will start just the MCP server and display the port number for testing.

## Troubleshooting

### Error: Cannot read properties of undefined (reading 'method')

This typically means the request body is malformed or missing. Ensure:
- The request has `Content-Type: application/json` header
- The request body is valid JSON
- You're using POST (not GET) for the `/mcp` endpoint

Check the logs in `clawd.log` for detailed error information.

### Tool calls fail silently

All tool errors are logged to:
- Console output (with `[MCP]` prefix)
- `clawd.log` file
- Standard error output

Check these logs for detailed error messages and stack traces.

### Connection refused

The MCP server runs on a dynamic port. Make sure you're using the correct port number shown when Clawd starts:

```
✓ MCP server running at http://localhost:<PORT>
```

### Health check endpoint

Test if the server is running:

```bash
curl http://localhost:<PORT>/health
```

Should return:
```json
{"status":"ok","server":"clawd-mcp-server"}
```
