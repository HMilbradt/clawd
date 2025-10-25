import blessed from "blessed";

/**
 * Help modal component for TUI
 * Shows all available keyboard shortcuts and commands
 */
export class HelpModalComponent {
	constructor(screen) {
		this.screen = screen;
		this.helpBox = null;
	}

	/**
	 * Show the help modal
	 * @returns {Promise<void>}
	 */
	show() {
		return new Promise((resolve) => {
			const helpContent = [
				"{center}{bold}{cyan-fg}CLAWD Help{/cyan-fg}{/bold}{/center}",
				"",
				"{bold}Keyboard Shortcuts:{/bold}",
				"",
				"  {yellow-fg}p{/yellow-fg}           Queue a new prompt",
				"  {yellow-fg}SPACE{/yellow-fg}       Pause execution and show menu",
				"  {yellow-fg}ESC{/yellow-fg}         Cancel current task",
				"  {yellow-fg}m{/yellow-fg}           Toggle perpetual mode (auto-continue)",
				"  {yellow-fg}?{/yellow-fg}           Show this help modal",
				"  {yellow-fg}Ctrl+C{/yellow-fg}      Quit CLAWD",
				"",
				"{bold}Navigation:{/bold}",
				"",
				"  {yellow-fg}↑/↓{/yellow-fg}         Scroll console up/down",
				"  {yellow-fg}PgUp/PgDn{/yellow-fg}   Scroll console page up/down",
				"  {yellow-fg}Mouse Wheel{/yellow-fg} Scroll console",
				"",
				"{bold}About CLAWD:{/bold}",
				"",
				"  CLAWD is a Claude Code orchestrator that manages",
				"  multi-phase project execution with automated task",
				"  management and completion verification.",
				"",
				"{center}{gray-fg}Press any key to close this help...{/gray-fg}{/center}",
			].join("\n");

			this.helpBox = blessed.box({
				parent: this.screen,
				top: "center",
				left: "center",
				width: "70%",
				height: "80%",
				content: helpContent,
				tags: true,
				padding: {
					left: 2,
					right: 2,
					top: 1,
					bottom: 1,
				},
				style: {
					fg: "white",
					bg: "black",
					border: {
						fg: "cyan",
					},
				},
				border: {
					type: "line",
				},
			});

			// Close on any key press
			const closeHandler = () => {
				this.helpBox.detach();
				this.screen.render();
				resolve();
			};

			this.helpBox.key(["escape", "enter", "space", "q"], closeHandler);
			this.helpBox.onceKey(
				Object.keys(Array(26))
					.map((_, i) => String.fromCharCode(97 + i))
					.concat(
						Object.keys(Array(26)).map((_, i) => String.fromCharCode(65 + i)),
					),
				closeHandler,
			);

			// Fallback: close on any other key
			this.helpBox.on("keypress", closeHandler);

			this.helpBox.focus();
			this.screen.render();
		});
	}

	/**
	 * Destroy the component
	 */
	destroy() {
		if (this.helpBox) {
			this.helpBox.detach();
		}
	}
}
