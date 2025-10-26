import logger from "./logger.js";

/**
 * Process Manager - Tracks and manages child processes
 * Ensures all child processes are cleaned up when clawd exits
 */

const activeProcesses = new Set();
let cleanupHandlersRegistered = false;

/**
 * Register a child process for tracking
 * @param {ChildProcess} childProcess - The child process to track
 */
export function registerProcess(childProcess) {
	activeProcesses.add(childProcess);

	// Remove from tracking when it exits naturally
	childProcess.on("exit", () => {
		activeProcesses.delete(childProcess);
	});

	// Ensure cleanup handlers are registered
	if (!cleanupHandlersRegistered) {
		registerCleanupHandlers();
	}
}

/**
 * Kill all active child processes
 */
export function killAllProcesses() {
	for (const proc of activeProcesses) {
		try {
			if (!proc.killed) {
				proc.kill("SIGTERM");
			}
		} catch (error) {
			// Process may have already exited, ignore errors
		}
	}
	activeProcesses.clear();
}

/**
 * Register cleanup handlers for process exit
 */
function registerCleanupHandlers() {
	cleanupHandlersRegistered = true;

	// Handle normal exit
	process.on("exit", () => {
		killAllProcesses();
	});

	// Handle SIGINT (Ctrl+C)
	process.on("SIGINT", () => {
		killAllProcesses();
		process.exit(130); // Standard exit code for SIGINT
	});

	// Handle SIGTERM
	process.on("SIGTERM", () => {
		killAllProcesses();
		process.exit(143); // Standard exit code for SIGTERM
	});

	// Handle uncaught exceptions
	process.on("uncaughtException", (error) => {
		logger.error("Uncaught exception:", error);
		killAllProcesses();
		process.exit(1);
	});

	// Handle unhandled promise rejections
	process.on("unhandledRejection", (reason, promise) => {
		logger.error("Unhandled rejection at:", promise, "reason:", reason);
		killAllProcesses();
		process.exit(1);
	});
}

/**
 * Get count of active processes
 * @returns {number}
 */
export function getActiveProcessCount() {
	return activeProcesses.size;
}
