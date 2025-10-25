import blessed from "blessed";

/**
 * Header component for TUI
 * Displays "CLAWD - {current phase}" with an animated spinner
 */
export class HeaderComponent {
	constructor(screen) {
		this.screen = screen;
		this.headerBox = null;
		this.spinnerBox = null;
		this.currentPhase = "Initializing";
		this.spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
		this.spinnerIndex = 0;
		this.spinnerInterval = null;
	}

	/**
	 * Create the header UI elements
	 */
	create() {
		// Main header box with title
		this.headerBox = blessed.box({
			parent: this.screen,
			top: 0,
			left: 0,
			width: "100%-12",
			height: 3,
			content: `{center}{bold}{cyan-fg}CLAWD - ${this.currentPhase}{/cyan-fg}{/bold}{/center}`,
			tags: true,
			style: {
				fg: "cyan",
				bg: "black",
			},
			border: {
				type: "line",
				fg: "cyan",
			},
		});

		// Animated spinner box (top right)
		this.spinnerBox = blessed.box({
			parent: this.screen,
			top: 0,
			right: 0,
			width: 12,
			height: 3,
			content: "",
			tags: true,
			align: "center",
			valign: "middle",
			style: {
				fg: "green",
				bg: "black",
				bold: true,
			},
			border: {
				type: "line",
				fg: "green",
			},
		});

		this.startSpinner();
	}

	/**
	 * Update the header text with current phase
	 * @param {string} phase - The current phase name
	 */
	updatePhase(phase) {
		this.currentPhase = phase;
		this.headerBox.setContent(
			`{center}{bold}{cyan-fg}CLAWD - ${phase}{/cyan-fg}{/bold}{/center}`,
		);
		this.screen.render();
	}

	/**
	 * Start the animated spinner
	 */
	startSpinner() {
		this.spinnerInterval = setInterval(() => {
			const frame = this.spinnerFrames[this.spinnerIndex];
			this.spinnerBox.setContent(`{green-fg}{bold}${frame}{/bold}{/green-fg}`);
			this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
			this.screen.render();
		}, 80);
	}

	/**
	 * Stop the animated spinner
	 */
	stopSpinner() {
		if (this.spinnerInterval) {
			clearInterval(this.spinnerInterval);
			this.spinnerInterval = null;
		}
	}

	/**
	 * Destroy the component
	 */
	destroy() {
		this.stopSpinner();
	}
}
