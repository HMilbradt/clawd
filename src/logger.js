import winston from "winston";
import path from "path";
import Transport from "winston-transport";

// Custom transport for TUI
class TUITransport extends Transport {
	constructor(opts) {
		super(opts);
		this.tui = null;
	}

	setTUI(tui) {
		this.tui = tui;
	}

	log(info, callback) {
		setImmediate(() => {
			this.emit("logged", info);
		});

		if (this.tui) {
			const message = `${info.timestamp} ${info.level}: ${info.message}`;
			// Map winston levels to TUI levels
			const levelMap = {
				error: "error",
				warn: "warn",
				info: "info",
				debug: "debug",
			};
			this.tui.log(message, levelMap[info.level] || "info");
		} else {
			// Fallback to console if TUI is not available
			console.log(`${info.timestamp} ${info.level}: ${info.message}`);
		}

		callback();
	}
}

const tuiTransport = new TUITransport();

const logger = winston.createLogger({
	level: "info",
	format: winston.format.combine(
		winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
		winston.format.errors({ stack: true }),
		winston.format.splat(),
		winston.format.json(),
	),
	transports: [
		new winston.transports.File({
			filename: path.join(process.cwd(), "clawd-error.log"),
			level: "error",
		}),
		new winston.transports.File({
			filename: path.join(process.cwd(), "clawd.log"),
		}),
		tuiTransport,
	],
});

/**
 * Set the TUI instance for the logger
 * @param {TUI} tui - The TUI instance
 */
export function setLoggerTUI(tui) {
	tuiTransport.setTUI(tui);
}

export default logger;
