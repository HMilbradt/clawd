import blessed from "blessed";

/**
 * Stats bar component for TUI
 * Displays runtime, iteration count, and step progress
 */
export class StatsBarComponent {
	constructor(screen) {
		this.screen = screen;
		this.statsBox = null;
		this.startTime = null;
		this.iterationCount = 0;
		this.stepsComplete = 0;
		this.totalSteps = 0;
		this.updateInterval = null;
	}

	/**
	 * Create the stats bar UI element
	 */
	create() {
		this.statsBox = blessed.box({
			parent: this.screen,
			top: 3,
			left: 0,
			width: "100%",
			height: 3,
			content: "",
			tags: true,
			padding: {
				left: 1,
			},
			style: {
				fg: "white",
				bg: "black",
			},
			border: {
				type: "line",
				fg: "white",
			},
		});

		this.updateDisplay();
	}

	/**
	 * Start the runtime tracking
	 */
	startRuntime() {
		this.startTime = Date.now();
		this.updateDisplay();

		// Update display every second
		this.updateInterval = setInterval(() => {
			this.updateDisplay();
		}, 1000);
	}

	/**
	 * Get elapsed runtime in formatted string
	 * @returns {string} - Formatted runtime (e.g., "1h 23m 45s")
	 */
	getRuntime() {
		if (!this.startTime) return "0s";

		const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
		const hours = Math.floor(elapsed / 3600);
		const minutes = Math.floor((elapsed % 3600) / 60);
		const seconds = elapsed % 60;

		const parts = [];
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
		parts.push(`${seconds}s`);

		return parts.join(" ");
	}

	/**
	 * Update iteration count
	 * @param {number} count - Current iteration
	 */
	setIteration(count) {
		this.iterationCount = count;
		this.updateDisplay();
	}

	/**
	 * Update step progress
	 * @param {number} complete - Steps completed
	 * @param {number} total - Total steps
	 */
	setStepProgress(complete, total) {
		this.stepsComplete = complete;
		this.totalSteps = total;
		this.updateDisplay();
	}

	/**
	 * Update the display with current stats
	 */
	updateDisplay() {
		const runtime = this.getRuntime();
		const content = `{bold}Runtime:{/bold} ${runtime}  {bold}│{/bold}  {bold}Iteration:{/bold} ${this.iterationCount}  {bold}│{/bold}  {bold}Steps:{/bold} ${this.stepsComplete}/${this.totalSteps}`;
		this.statsBox.setContent(content);
		this.screen.render();
	}

	/**
	 * Destroy the component
	 */
	destroy() {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
	}
}
