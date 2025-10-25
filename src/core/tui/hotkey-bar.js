import blessed from "blessed";

/**
 * Hotkey bar component for TUI
 * Displays available keyboard shortcuts and handles help modal
 */
export class HotkeyBarComponent {
	constructor(screen) {
		this.screen = screen;
		this.hotkeyBox = null;
		this.interactive = false;
		this.visible = true;
	}

	/**
	 * Create the hotkey bar UI element
	 */
	create() {
		this.hotkeyBox = blessed.box({
			parent: this.screen,
			bottom: 0,
			left: 0,
			width: "100%",
			height: 3,
			content: "",
			tags: true,
			padding: {
				left: 1,
			},
			style: {
				fg: "black",
				bg: "magenta",
				bold: true,
			},
			border: {
				type: "line",
				fg: "magenta",
			},
		});

		this.updateDisplay();
	}

	/**
	 * Set interactive mode
	 * @param {boolean} interactive - Whether interactive mode is enabled
	 */
	setInteractive(interactive) {
		this.interactive = interactive;
		this.updateDisplay();
	}

	/**
	 * Set visibility of hotkey bar
	 * @param {boolean} visible - Whether to show the hotkey bar
	 */
	setVisible(visible) {
		this.visible = visible;
		this.updateDisplay();
	}

	/**
	 * Update the hotkey display
	 */
	updateDisplay() {
		if (!this.visible) {
			this.hotkeyBox.setContent("");
			this.screen.render();
			return;
		}

		if (this.interactive) {
			const hotkeyText =
				"{bold}[ESC]{/bold} cancel  {bold}[?]{/bold} help  {bold}[Ctrl+C]{/bold} quit";
			this.hotkeyBox.setContent(hotkeyText);
		} else {
			this.hotkeyBox.setContent("{bold}[Ctrl+C]{/bold} quit");
		}
		this.screen.render();
	}

	/**
	 * Destroy the component
	 */
	destroy() {
		// No cleanup needed
	}
}
