import blessed from "blessed";

/**
 * Console component for TUI
 * Displays scrollable log output with colored messages
 */
export class ConsoleComponent {
	constructor(screen) {
		this.screen = screen;
		this.logBox = null;
	}

	/**
	 * Create the console UI element
	 */
	create() {
		this.logBox = blessed.log({
			parent: this.screen,
			top: 6, // After header (3) and stats bar (3)
			left: 0,
			width: "100%",
			height: "100%-12", // Leave room for header, stats, and hotkey bar
			tags: true,
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: "█",
				inverse: true,
			},
			mouse: true,
			keys: false, // Don't capture keys - let screen handle them
			vi: false,
			padding: {
				left: 1,
				right: 1,
				top: 1,
				bottom: 1,
			},
			style: {
				fg: "white",
				bg: "black",
				scrollbar: {
					bg: "blue",
				},
			},
			border: {
				type: "line",
			},
		});

		// Handle mouse wheel scrolling
		this.logBox.on("wheeldown", () => {
			this.logBox.scroll(1);
			this.screen.render();
		});

		this.logBox.on("wheelup", () => {
			this.logBox.scroll(-1);
			this.screen.render();
		});
	}

	/**
	 * Log a message to the console
	 * @param {string} message - The message to log
	 * @param {string} level - Log level (info, warn, error, success, debug)
	 */
	log(message, level = "info") {
		// Strip ANSI codes for blessed (we'll use blessed tags instead)
		const cleanMessage = this.stripAnsi(message);

		// Add color tags based on level
		let coloredMessage = cleanMessage;
		switch (level) {
			case "error":
				coloredMessage = `{red-fg}${cleanMessage}{/red-fg}`;
				break;
			case "warn":
				coloredMessage = `{yellow-fg}${cleanMessage}{/yellow-fg}`;
				break;
			case "success":
				coloredMessage = `{green-fg}${cleanMessage}{/green-fg}`;
				break;
			case "info":
				coloredMessage = `{cyan-fg}${cleanMessage}{/cyan-fg}`;
				break;
			case "debug":
				coloredMessage = `{gray-fg}${cleanMessage}{/gray-fg}`;
				break;
			default:
				coloredMessage = cleanMessage;
		}

		this.logBox.log(coloredMessage);
		this.screen.render();
	}

	/**
	 * Show a banner message
	 * @param {string} message - Banner message
	 * @param {string} style - Style (info, success, warning)
	 */
	showBanner(message, style = "info") {
		const border = "━".repeat(60);
		let color = "cyan";
		if (style === "success") color = "green";
		if (style === "warning") color = "yellow";

		this.log(`{${color}-fg}{bold}${border}{/bold}{/${color}-fg}`);
		this.log(`{${color}-fg}{bold}${message}{/bold}{/${color}-fg}`);
		this.log(`{${color}-fg}{bold}${border}{/bold}{/${color}-fg}`);
	}

	/**
	 * Write raw output (for child process stdout/stderr)
	 * @param {string} data - Raw data to write
	 */
	writeOutput(data) {
		// Split by lines and log each
		const lines = data.toString().split("\n");
		for (const line of lines) {
			if (line.trim()) {
				this.log(line);
			}
		}
	}

	/**
	 * Strip ANSI color codes from a string
	 * @param {string} str - String with ANSI codes
	 * @returns {string} - Clean string
	 */
	stripAnsi(str) {
		// biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching ANSI escape codes
		return str.replace(/\x1b\[[0-9;]*m/g, "");
	}

	/**
	 * Destroy the component
	 */
	destroy() {
		// No cleanup needed
	}
}
