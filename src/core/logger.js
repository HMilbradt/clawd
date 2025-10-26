import fs from "node:fs";
import path from "node:path";
import pino from "pino";

// Custom TUI destination for pino
class TUIDestination {
	constructor() {
		this.tui = null;
	}

	setTUI(tui) {
		this.tui = tui;
	}

	write(msg) {
		try {
			const log = JSON.parse(msg);
			const timestamp = new Date(log.time)
				.toISOString()
				.replace("T", " ")
				.substring(0, 19);
			const level = log.level;
			const message = log.msg;

			// Map pino levels to TUI levels
			const levelMap = {
				10: "debug", // trace
				20: "debug", // debug
				30: "info", // info
				40: "warn", // warn
				50: "error", // error
				60: "error", // fatal
			};

			// Build formatted message with stack trace if present
			let formattedMessage = `${timestamp} ${pino.levels.labels[level]}: ${message}`;

			// Add stack trace for error logs if available
			if (log.stack) {
				formattedMessage += `\n${log.stack}`;
			}

			if (this.tui) {
				this.tui.log(formattedMessage, levelMap[level] || "info");
			} else {
				// Fallback to console if TUI is not available
				console.log(formattedMessage);
			}
		} catch (err) {
			console.error("Error parsing log:", err);
		}
	}
}

const tuiDestination = new TUIDestination();

// Lazy initialization of file streams
let fileStream;
let errorStream;

function ensureLogStreams() {
	if (fileStream && errorStream) {
		return;
	}

	// Ensure .clawd/logs directory exists
	const logsDir = path.join(process.cwd(), ".clawd", "logs");
	if (!fs.existsSync(logsDir)) {
		fs.mkdirSync(logsDir, { recursive: true });
	}

	// Create file streams
	fileStream = fs.createWriteStream(path.join(logsDir, "clawd.log"), {
		flags: "a",
	});
	errorStream = fs.createWriteStream(path.join(logsDir, "clawd-error.log"), {
		flags: "a",
	});
}

// Initialize streams only if not in test environment
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
	ensureLogStreams();
}

// Create a multistream logger with lazy stream access
const logger = pino(
	{
		level: process.env.LOG_LEVEL || "debug",
		timestamp: pino.stdTimeFunctions.isoTime,
	},
	pino.multistream([
		{
			level: "debug",
			stream: {
				write: (msg) => {
					ensureLogStreams();
					fileStream.write(msg);
				},
			},
		},
		{
			level: "error",
			stream: {
				write: (msg) => {
					ensureLogStreams();
					errorStream.write(msg);
				},
			},
		},
		{ level: "info", stream: { write: (msg) => tuiDestination.write(msg) } },
	]),
);

/**
 * Set the TUI instance for the logger
 * @param {TUI} tui - The TUI instance
 */
export function setLoggerTUI(tui) {
	tuiDestination.setTUI(tui);
}

export default logger;
