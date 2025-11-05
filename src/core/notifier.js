import notifier from "node-notifier";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Notification service for desktop alerts
 */
class Notifier {
	constructor(options = {}) {
		this.enabled = options.enabled ?? true;
		this.sound = options.sound ?? true;
	}

	/**
	 * Send a desktop notification
	 * @param {Object} options - Notification options
	 * @param {string} options.title - Notification title
	 * @param {string} options.message - Notification message
	 * @param {string} [options.icon] - Path to icon
	 * @param {boolean} [options.sound] - Whether to play sound
	 */
	notify({ title, message, icon, sound }) {
		if (!this.enabled) {
			return;
		}

		const notificationOptions = {
			title: title || "Clawd",
			message: message || "Task completed",
			sound: sound ?? this.sound,
			wait: false,
		};

		// Add icon if provided
		if (icon) {
			notificationOptions.icon = icon;
		}

		notifier.notify(notificationOptions);
	}

	/**
	 * Notify task completion
	 * @param {Object} task - The task that was completed
	 * @param {boolean} success - Whether the task completed successfully
	 */
	notifyTaskComplete(task, success = true) {
		const title = success ? "Task Completed" : "Task Failed";
		const message = task?.description || task?.name || "A task has completed";

		this.notify({
			title: `Clawd - ${title}`,
			message,
			sound: true,
		});
	}

	/**
	 * Notify project completion
	 * @param {boolean} complete - Whether project is fully complete
	 * @param {Array} [newTasks] - New tasks added if project not complete
	 */
	notifyProjectCompletion(complete, newTasks = []) {
		if (complete) {
			this.notify({
				title: "Clawd - Project Complete",
				message: "All tasks have been completed successfully!",
				sound: true,
			});
		} else if (newTasks.length > 0) {
			this.notify({
				title: "Clawd - New Tasks Added",
				message: `Added ${newTasks.length} new task${newTasks.length > 1 ? "s" : ""} to the plan`,
				sound: true,
			});
		}
	}

	/**
	 * Notify execution error
	 * @param {Error} error - The error that occurred
	 * @param {string} [context] - Context where error occurred
	 */
	notifyError(error, context) {
		const message = context
			? `Error in ${context}: ${error.message}`
			: error.message;

		this.notify({
			title: "Clawd - Execution Error",
			message,
			sound: true,
		});
	}

	/**
	 * Notify execution paused
	 * @param {string} reason - Reason for pause
	 */
	notifyPaused(reason = "Execution paused") {
		this.notify({
			title: "Clawd - Paused",
			message: reason,
			sound: false,
		});
	}

	/**
	 * Notify execution cancelled
	 */
	notifyCancelled() {
		this.notify({
			title: "Clawd - Cancelled",
			message: "Execution has been cancelled",
			sound: false,
		});
	}

	/**
	 * Enable notifications
	 */
	enable() {
		this.enabled = true;
	}

	/**
	 * Disable notifications
	 */
	disable() {
		this.enabled = false;
	}

	/**
	 * Check if notifications are enabled
	 * @returns {boolean}
	 */
	isEnabled() {
		return this.enabled;
	}
}

// Singleton instance
let instance = null;

/**
 * Get the singleton notifier instance
 * @param {Object} [options] - Configuration options (only used on first call)
 * @returns {Notifier}
 */
export function getNotifier(options) {
	if (!instance) {
		instance = new Notifier(options);
	}
	return instance;
}

/**
 * Reset the notifier instance (mainly for testing)
 */
export function resetNotifier() {
	instance = null;
}

export default Notifier;
