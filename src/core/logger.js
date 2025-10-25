import fs from "fs";
import path from "path";
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

			const formattedMessage = `${timestamp} ${pino.levels.labels[level]}: ${message}`;

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

// Ensure .clawd/logs directory exists
const logsDir = path.join(process.cwd(), ".clawd", "logs");
if (!fs.existsSync(logsDir)) {
	fs.mkdirSync(logsDir, { recursive: true });
}

// Create file streams
const fileStream = fs.createWriteStream(path.join(logsDir, "clawd.log"), {
	flags: "a",
});
const errorStream = fs.createWriteStream(
	path.join(logsDir, "clawd-error.log"),
	{ flags: "a" },
);

// Create a multistream logger
const logger = pino(
	{
		level: "info",
		timestamp: pino.stdTimeFunctions.isoTime,
	},
	pino.multistream([
		{ level: "info", stream: fileStream },
		{ level: "error", stream: errorStream },
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
