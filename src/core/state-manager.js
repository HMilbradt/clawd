import logger from "./logger.js";

/**
 * State Manager - Centralized state for Clawd
 * Provides shared state access for TUI, MCP server, and core logic
 */
class StateManager {
	constructor() {
		// Execution state
		this.isRunning = false;
		this.isPaused = false;
		this.cancelRequested = false;

		// Project state
		this.currentPlan = null;
		this.currentTask = null;
		this.currentPhase = null;

		// TUI state
		this.perpetualMode = false;
		this.queuedPrompts = [];

		// Statistics
		this.iteration = 0;
		this.stepsComplete = 0;
		this.totalSteps = 0;
		this.runtime = 0;

		// Listeners for state changes
		this.listeners = new Map();
	}

	/**
	 * Register a listener for state changes
	 * @param {string} event - Event name
	 * @param {Function} callback - Callback function
	 */
	on(event, callback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event).push(callback);
	}

	/**
	 * Emit an event to all registered listeners
	 * @param {string} event - Event name
	 * @param {*} data - Event data
	 */
	emit(event, data) {
		if (this.listeners.has(event)) {
			for (const callback of this.listeners.get(event)) {
				try {
					callback(data);
				} catch (error) {
					logger.error(`Error in listener for ${event}: ${error.message}`);
				}
			}
		}
	}

	/**
	 * Update execution state
	 */
	setRunning(running) {
		this.isRunning = running;
		this.emit("execution:state", { isRunning: running });
	}

	setPaused(paused) {
		this.isPaused = paused;
		this.emit("execution:paused", { isPaused: paused });
	}

	requestCancel() {
		this.cancelRequested = true;
		this.emit("execution:cancel", { cancelRequested: true });
	}

	clearCancelRequest() {
		this.cancelRequested = false;
	}

	isCancelRequested() {
		return this.cancelRequested;
	}

	/**
	 * Update project state
	 */
	setPlan(plan) {
		this.currentPlan = plan;
		if (plan) {
			this.totalSteps = plan.tasks ? plan.tasks.length : 0;
			this.stepsComplete = plan.tasks
				? plan.tasks.filter((t) => t.done).length
				: 0;
		}
		this.emit("plan:updated", { plan });
	}

	setCurrentTask(task) {
		this.currentTask = task;
		if (task) {
			this.currentPhase = task.phase;
		}
		this.emit("task:updated", { task });
	}

	setIteration(iteration) {
		this.iteration = iteration;
		this.emit("iteration:updated", { iteration });
	}

	/**
	 * Update step progress
	 */
	updateStepProgress(stepsComplete, totalSteps) {
		this.stepsComplete = stepsComplete;
		this.totalSteps = totalSteps;
		this.emit("progress:updated", { stepsComplete, totalSteps });
	}

	/**
	 * Perpetual mode
	 */
	setPerpetualMode(enabled) {
		this.perpetualMode = enabled;
		this.emit("perpetual:toggled", { enabled });
	}

	togglePerpetualMode() {
		this.setPerpetualMode(!this.perpetualMode);
		return this.perpetualMode;
	}

	isPerpetualMode() {
		return this.perpetualMode;
	}

	/**
	 * Queued prompts
	 */
	queuePrompt(prompt) {
		this.queuedPrompts.push(prompt);
		this.emit("prompt:queued", { prompt, count: this.queuedPrompts.length });
	}

	getQueuedPrompts() {
		return [...this.queuedPrompts];
	}

	clearQueuedPrompts() {
		this.queuedPrompts = [];
		this.emit("prompts:cleared", { count: 0 });
	}

	/**
	 * Get current status snapshot
	 */
	getStatus() {
		return {
			execution: {
				isRunning: this.isRunning,
				isPaused: this.isPaused,
				cancelRequested: this.cancelRequested,
				runtime: this.runtime,
			},
			project: {
				brief: this.currentPlan?.brief,
				goal: this.currentPlan?.goal,
				currentTask: this.currentTask
					? {
							phase: this.currentTask.phase,
							description: this.currentTask.description,
							done: this.currentTask.done,
						}
					: null,
				currentPhase: this.currentPhase,
			},
			progress: {
				iteration: this.iteration,
				stepsComplete: this.stepsComplete,
				totalSteps: this.totalSteps,
			},
			settings: {
				perpetualMode: this.perpetualMode,
			},
			prompts: {
				queued: this.queuedPrompts.length,
				list: this.getQueuedPrompts(),
			},
		};
	}

	/**
	 * Clear all state (for testing)
	 */
	reset() {
		this.isRunning = false;
		this.isPaused = false;
		this.cancelRequested = false;
		this.currentPlan = null;
		this.currentTask = null;
		this.currentPhase = null;
		this.perpetualMode = false;
		this.queuedPrompts = [];
		this.iteration = 0;
		this.stepsComplete = 0;
		this.totalSteps = 0;
		this.runtime = 0;
		this.listeners.clear();
	}
}

// Singleton instance
const stateManager = new StateManager();

export default stateManager;
