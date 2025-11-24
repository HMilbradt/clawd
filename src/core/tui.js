import blessed from "blessed";
import { killAllProcesses } from "./process-manager.js";
import stateManager from "./state-manager.js";
import { ConsoleComponent } from "./tui/console.js";
import { HeaderComponent } from "./tui/header.js";
import { HelpModalComponent } from "./tui/help-modal.js";
import { HotkeyBarComponent } from "./tui/hotkey-bar.js";
import { StatsBarComponent } from "./tui/stats-bar.js";

/**
 * Terminal UI manager for clawd
 * Provides a split-pane interface with scrollable logs and status bar
 */
export class TUI {
	constructor() {
		this.screen = null;
		this.header = null;
		this.statsBar = null;
		this.console = null;
		this.hotkeyBar = null;
		this.helpModal = null;
		this.statusBar = null;
		this.promptCountBox = null;
		this.loadingIndicator = null;
		this.isInitialized = false;

		// Listen to state manager updates
		stateManager.on("prompt:queued", (data) => {
			this.updatePromptCount(data.count);
		});
		stateManager.on("prompts:cleared", (data) => {
			this.updatePromptCount(data.count);
		});
		stateManager.on("perpetual:toggled", (data) => {
			const status = data.enabled ? "enabled" : "disabled";
			this.log(`🔄 Perpetual mode ${status}`, "info");
		});
	}

	/**
	 * Initialize the TUI
	 */
	init() {
		if (this.isInitialized) return;

		// Create screen
		this.screen = blessed.screen({
			smartCSR: true,
			title: "Clawd - Claude Code Orchestrator",
			fullUnicode: true,
		});

		// Create components
		this.header = new HeaderComponent(this.screen);
		this.header.create();

		this.statsBar = new StatsBarComponent(this.screen);
		this.statsBar.create();

		this.console = new ConsoleComponent(this.screen);
		this.console.create();

		// Status bar at bottom (showing current step) - positioned above hotkey bar
		this.statusBar = blessed.box({
			parent: this.screen,
			bottom: 3,
			left: 0,
			width: "100%-12",
			height: 3,
			content: "",
			tags: true,
			padding: {
				left: 1,
			},
			style: {
				fg: "white",
				bg: "blue",
			},
			border: {
				type: "line",
				fg: "blue",
			},
		});

		// Prompt counter box (next to status bar) - smaller
		this.promptCountBox = blessed.box({
			parent: this.screen,
			bottom: 3,
			right: 0,
			width: 11,
			height: 3,
			content: "📬 0",
			tags: true,
			valign: "middle",
			padding: {
				left: 1,
			},
			style: {
				fg: "white",
				bg: "green",
			},
			border: {
				type: "line",
				fg: "green",
			},
		});

		this.hotkeyBar = new HotkeyBarComponent(this.screen);
		this.hotkeyBar.create();

		this.helpModal = new HelpModalComponent(this.screen);

		// Handle Ctrl+C
		this.screen.key(["C-c"], () => {
			this.destroy();
			killAllProcesses();
			process.exit(0);
		});

		// Handle ? for help
		this.screen.key(["?"], async () => {
			await this.helpModal.show();
		});

		// Handle p for prompt
		this.screen.key(["p"], async () => {
			await this.showPromptModal();
		});

		// Handle space for pause
		this.screen.key(["space"], async () => {
			await this.handlePause();
		});

		// Handle escape for cancel
		this.screen.key(["escape"], () => {
			this.requestCancel();
			this.log("⚠️  Cancel requested", "warn");
		});

		// Handle m for perpetual mode toggle
		this.screen.key(["m"], () => {
			this.togglePerpetualMode();
		});

		this.isInitialized = true;
		this.screen.render();
	}

	/**
	 * Start runtime tracking
	 */
	startRuntime() {
		if (this.statsBar) {
			this.statsBar.startRuntime();
		}
	}

	/**
	 * Update the header with current phase
	 * @param {string} phase - Current phase name
	 */
	updateHeader(phase) {
		if (this.header) {
			this.header.updatePhase(phase);
		}
	}

	/**
	 * Update stats bar
	 * @param {Object} stats - Stats object with iteration, stepsComplete, totalSteps
	 */
	updateStats(stats) {
		if (this.statsBar) {
			if (stats.iteration !== undefined) {
				this.statsBar.setIteration(stats.iteration);
			}
			if (stats.stepsComplete !== undefined && stats.totalSteps !== undefined) {
				this.statsBar.setStepProgress(stats.stepsComplete, stats.totalSteps);
			}
			this.statsBar.updateDisplay();
		}
	}

	/**
	 * Log a message to the scrollable log area
	 * @param {string} message - The message to log
	 * @param {string} level - Log level (info, warn, error, success)
	 */
	log(message, level = "info") {
		if (!this.isInitialized) {
			console.log(message);
			return;
		}

		this.console.log(message, level);
	}

	/**
	 * Update the status bar and hotkey bar
	 * @param {Object} status - Status information
	 */
	updateStatus(status) {
		if (!this.isInitialized) return;

		const { phase, step, iteration, interactive } = status;

		// Update header if phase is provided
		if (phase) {
			this.updateHeader(phase);
		}

		// Update stats if iteration is provided
		if (iteration !== undefined) {
			this.updateStats({ iteration });
		}

		// Update status bar with step (no iteration)
		let statusText = "";
		if (step) {
			statusText = `{bold}Step:{/bold} ${step}`;
		}
		this.statusBar.setContent(statusText);

		// Update hotkey bar with interactive mode
		if (interactive !== undefined) {
			this.hotkeyBar.setInteractive(interactive);
		}

		this.screen.render();
	}

	/**
	 * Update the prompt counter
	 * @param {number} count - Number of queued prompts
	 */
	updatePromptCount(count) {
		if (!this.isInitialized) return;

		if (count > 0) {
			this.promptCountBox.setContent(`📬 ${count}`);
			this.promptCountBox.style.bg = "yellow";
			this.promptCountBox.border.fg = "yellow";
		} else {
			this.promptCountBox.setContent("📬 0");
			this.promptCountBox.style.bg = "green";
			this.promptCountBox.border.fg = "green";
		}

		this.screen.render();
	}

	/**
	 * Set hotkey bar visibility
	 * @param {boolean} visible - Whether to show hotkeys
	 */
	setHotkeysVisible(visible) {
		if (this.hotkeyBar) {
			this.hotkeyBar.setVisible(visible);
		}
	}

	/**
	 * Toggle perpetual mode
	 */
	togglePerpetualMode() {
		stateManager.togglePerpetualMode();
		this.screen.emit("perpetual-mode-toggled", stateManager.isPerpetualMode());
	}

	/**
	 * Get perpetual mode status
	 * @returns {boolean} - Whether perpetual mode is enabled
	 */
	isPerpetualMode() {
		return stateManager.isPerpetualMode();
	}

	/**
	 * Set perpetual mode
	 * @param {boolean} enabled - Enable or disable perpetual mode
	 */
	setPerpetualMode(enabled) {
		stateManager.setPerpetualMode(enabled);
	}

	/**
	 * Show prompt modal to queue a new prompt
	 */
	async showPromptModal() {
		if (!this.isInitialized) return;

		const promptText = await this.prompt("Enter a prompt to queue:");
		if (promptText?.trim()) {
			stateManager.queuePrompt(promptText.trim());
			this.log(`✓ Queued prompt: "${promptText.trim()}"`, "success");
		}
	}

	/**
	 * Handle pause - show pause status
	 */
	async handlePause() {
		if (!this.isInitialized) return;

		stateManager.setPaused(true);
		this.log("⏸️  Paused - Press SPACE to resume", "warn");

		// Wait for another space key to resume
		await new Promise((resolve) => {
			const resumeHandler = () => {
				stateManager.setPaused(false);
				this.log("▶️  Resumed", "success");
				this.screen.unkey(["space"], resumeHandler);
				resolve();
			};
			this.screen.key(["space"], resumeHandler);
		});
	}

	/**
	 * Get queued prompts
	 * @returns {Array<string>} - Array of queued prompt strings
	 */
	getQueuedPrompts() {
		return stateManager.getQueuedPrompts();
	}

	/**
	 * Clear queued prompts
	 */
	clearQueuedPrompts() {
		stateManager.clearQueuedPrompts();
	}

	/**
	 * Show a banner message
	 * @param {string} message - Banner message
	 * @param {string} style - Style (info, success, warning)
	 */
	showBanner(message, style = "info") {
		if (!this.isInitialized) {
			console.log(message);
			return;
		}

		this.console.showBanner(message, style);
	}

	/**
	 * Write raw output (for child process stdout/stderr)
	 * @param {string} data - Raw data to write
	 */
	writeOutput(data) {
		if (!this.isInitialized) {
			process.stdout.write(data);
			return;
		}

		this.console.writeOutput(data);
	}

	/**
	 * Get the blessed screen for custom key bindings
	 * @returns {Object} - Blessed screen
	 */
	getScreen() {
		return this.screen;
	}

	/**
	 * Show a prompt using blessed's built-in prompt
	 * @param {string} message - The prompt message
	 * @returns {Promise<string>} - The user's input
	 */
	async prompt(message) {
		if (!this.isInitialized) return "";

		return new Promise((resolve) => {
			// Create a prompt box
			const promptBox = blessed.prompt({
				parent: this.screen,
				border: "line",
				height: "shrink",
				width: "half",
				top: "center",
				left: "center",
				label: " {blue-fg}Prompt{/blue-fg} ",
				tags: true,
				keys: true,
				vi: true,
			});

			promptBox.input(message, "", (_err, value) => {
				resolve(value || "");
			});

			this.screen.render();
		});
	}

	/**
	 * Show a list selection using blessed
	 * @param {string} message - The prompt message
	 * @param {Array} choices - Array of choice objects {name, value}
	 * @returns {Promise<string>} - The selected value
	 */
	async select(message, choices) {
		if (!this.isInitialized) return "";

		return new Promise((resolve) => {
			// Create a list box
			const list = blessed.list({
				parent: this.screen,
				label: ` {blue-fg}${message}{/blue-fg} `,
				tags: true,
				border: "line",
				width: "60%",
				height: "50%",
				top: "center",
				left: "center",
				keys: true,
				vi: true,
				mouse: true,
				style: {
					selected: {
						bg: "blue",
						fg: "white",
						bold: true,
					},
					border: {
						fg: "blue",
					},
				},
			});

			// Add choices to list
			const items = choices.map((c) => c.name);
			list.setItems(items);

			// Handle selection
			list.on("select", (_item, index) => {
				const selectedValue = choices[index].value;
				list.detach();
				this.screen.render();
				resolve(selectedValue);
			});

			// Handle cancel
			list.key(["escape", "q"], () => {
				list.detach();
				this.screen.render();
				resolve("cancel");
			});

			this.screen.append(list);
			list.focus();
			this.screen.render();
		});
	}

	/**
	 * Show a loading indicator
	 * @param {string} message - Loading message
	 */
	showLoadingIndicator(message = "Loading") {
		if (!this.isInitialized) return;

		if (this.loadingIndicator) {
			this.loadingIndicator.destroy();
		}

		this.loadingIndicator = blessed.loading({
			parent: this.screen,
			top: "center",
			left: "center",
			width: "50%",
			height: 5,
			border: "line",
			label: " {blue-fg}Please Wait{/blue-fg} ",
			tags: true,
			style: {
				border: {
					fg: "blue",
				},
			},
		});

		this.loadingIndicator.load(message);
		this.screen.render();
	}

	/**
	 * Show rate limit waiting indicator with countdown
	 * @param {number} waitTimeMs - Total wait time in milliseconds
	 * @param {string} resetTime - Reset time string (e.g., "10pm")
	 * @returns {Object} - Object with update() and hide() methods
	 */
	showRateLimitWaiting(waitTimeMs, resetTime) {
		if (!this.isInitialized) {
			console.log(
				`⏳ Rate limited - waiting ${Math.ceil(waitTimeMs / 60000)} minutes...`,
			);
			return { update: () => {}, hide: () => {} };
		}

		// Hide loading indicator if present
		if (this.loadingIndicator) {
			this.loadingIndicator.destroy();
			this.loadingIndicator = null;
		}

		// Create waiting box
		const waitBox = blessed.box({
			parent: this.screen,
			top: "center",
			left: "center",
			width: "70%",
			height: 9,
			border: "line",
			label: " {yellow-fg}⏳ Rate Limit{/yellow-fg} ",
			tags: true,
			padding: {
				left: 2,
				right: 2,
				top: 1,
				bottom: 1,
			},
			style: {
				border: {
					fg: "yellow",
				},
			},
		});

		const startTime = Date.now();
		const endTime = startTime + waitTimeMs;

		// Update function to refresh the countdown
		const update = () => {
			const now = Date.now();
			const remaining = Math.max(0, endTime - now);
			const remainingMinutes = Math.ceil(remaining / 60000);

			const resetInfo = resetTime ? `Resets at: {bold}${resetTime}{/bold}` : "";

			const content = [
				"{yellow-fg}Session limit reached{/yellow-fg}",
				"",
				`Time remaining: {bold}{green-fg}${remainingMinutes} minute${
					remainingMinutes !== 1 ? "s" : ""
				}{/green-fg}{/bold}`,
				resetInfo,
				"",
				"{gray-fg}Clawd will automatically retry when the limit resets{/gray-fg}",
			]
				.filter(Boolean)
				.join("\n");

			waitBox.setContent(content);
			this.screen.render();

			return remaining > 0;
		};

		// Initial update
		update();

		// Hide function
		const hide = () => {
			waitBox.destroy();
			this.screen.render();
		};

		return { update, hide };
	}

	/**
	 * Hide the loading indicator
	 */
	hideLoadingIndicator() {
		if (this.loadingIndicator) {
			this.loadingIndicator.stop();
			this.loadingIndicator.destroy();
			this.loadingIndicator = null;
			this.screen.render();
		}
	}

	/**
	 * Pause execution and show pause menu
	 * @returns {Promise<string>} - User choice: 'continue', 'quit', or 'prompt'
	 */
	async showPauseMenu() {
		if (!this.isInitialized) return "continue";

		stateManager.setPaused(true);
		this.log("⏸️  Execution paused", "warn");

		const choice = await this.select("What would you like to do?", [
			{ name: "Continue execution", value: "continue" },
			{ name: "Queue a prompt", value: "prompt" },
			{ name: "Quit", value: "quit" },
		]);

		stateManager.setPaused(false);
		return choice;
	}

	/**
	 * Request cancellation of current task
	 */
	requestCancel() {
		stateManager.requestCancel();
	}

	/**
	 * Check if cancellation was requested
	 * @returns {boolean}
	 */
	isCancelRequested() {
		return stateManager.isCancelRequested();
	}

	/**
	 * Clear cancel request
	 */
	clearCancelRequest() {
		stateManager.clearCancelRequest();
	}

	/**
	 * Check if paused
	 * @returns {boolean}
	 */
	isPausedState() {
		return stateManager.isPaused;
	}

	/**
	 * Show confirmation dialog
	 * @param {string} message - Confirmation message
	 * @returns {Promise<boolean>} - True if confirmed
	 */
	async confirm(message) {
		if (!this.isInitialized) return false;

		const answer = await this.prompt(`${message} (type 'yes' to confirm)`);
		return answer && answer.toLowerCase() === "yes";
	}

	/**
	 * Wait for plan review decision using hotkeys
	 * Shows a temporary hotkey bar and waits for user to press a, f, or c
	 * @returns {Promise<string>} - 'accept', 'feedback', or 'cancel'
	 */
	async waitForPlanReview() {
		if (!this.isInitialized) return "accept";

		return new Promise((resolve) => {
			// Create temporary hotkey instruction box
			const hotkeyBox = blessed.box({
				parent: this.screen,
				bottom: 0,
				left: 0,
				width: "100%",
				height: 3,
				content:
					"{bold}Plan Review:{/bold} [A]ccept and proceed  |  [F]eedback  |  [C]ancel / [ESC]",
				tags: true,
				align: "center",
				valign: "middle",
				style: {
					fg: "white",
					bg: "blue",
					bold: true,
				},
			});

			// Handler for accept
			const acceptHandler = () => {
				cleanup();
				resolve("accept");
			};

			// Handler for feedback
			const feedbackHandler = () => {
				cleanup();
				resolve("feedback");
			};

			// Handler for cancel
			const cancelHandler = () => {
				cleanup();
				resolve("cancel");
			};

			// Cleanup function to remove handlers and box
			const cleanup = () => {
				this.screen.unkey(["a", "A"], acceptHandler);
				this.screen.unkey(["f", "F"], feedbackHandler);
				this.screen.unkey(["c", "C"], cancelHandler);
				this.screen.unkey(["escape"], cancelHandler);
				hotkeyBox.destroy();
				this.screen.render();
			};

			// Register key handlers
			this.screen.key(["a", "A"], acceptHandler);
			this.screen.key(["f", "F"], feedbackHandler);
			this.screen.key(["c", "C"], cancelHandler);
			this.screen.key(["escape"], cancelHandler);

			this.screen.render();
		});
	}

	/**
	 * Destroy the TUI and restore terminal
	 */
	destroy() {
		// Kill all child processes before destroying TUI
		killAllProcesses();

		if (this.header) {
			this.header.destroy();
		}
		if (this.statsBar) {
			this.statsBar.destroy();
		}
		if (this.console) {
			this.console.destroy();
		}
		if (this.hotkeyBar) {
			this.hotkeyBar.destroy();
		}
		if (this.helpModal) {
			this.helpModal.destroy();
		}
		if (this.loadingIndicator) {
			this.loadingIndicator.destroy();
		}
		if (this.screen) {
			this.screen.destroy();
		}
		this.isInitialized = false;
	}

	/**
	 * Render the screen
	 */
	render() {
		if (this.screen) {
			this.screen.render();
		}
	}
}

// Singleton instance
let tuiInstance = null;

/**
 * Get or create the TUI instance
 * @returns {TUI}
 */
export function getTUI() {
	if (!tuiInstance) {
		tuiInstance = new TUI();
	}
	return tuiInstance;
}

/**
 * Initialize the global TUI
 */
export function initTUI() {
	const tui = getTUI();
	tui.init();
	return tui;
}
