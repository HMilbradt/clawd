import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

// Mock chalk
vi.mock("chalk", () => ({
	default: {
		green: vi.fn((text) => text),
		white: vi.fn((text) => text),
		red: vi.fn((text) => text),
	},
}));

describe("initAction", () => {
	let initAction;
	let chalk;
	let originalConsoleLog;
	let originalConsoleError;
	let originalProcessExit;
	let consoleLogOutput;
	let consoleErrorOutput;
	let processExitCode;

	beforeEach(async () => {
		// Clear module cache to get fresh imports
		vi.clearAllMocks();

		// Import modules
		chalk = (await import("chalk")).default;
		({ initAction } = await import("./init.js"));

		// Mock console methods
		consoleLogOutput = [];
		consoleErrorOutput = [];
		originalConsoleLog = console.log;
		originalConsoleError = console.error;
		console.log = vi.fn((...args) => consoleLogOutput.push(args.join(" ")));
		console.error = vi.fn((...args) => consoleErrorOutput.push(args.join(" ")));

		// Mock process.exit
		originalProcessExit = process.exit;
		processExitCode = null;
		process.exit = vi.fn((code) => {
			processExitCode = code;
			throw new Error(`Process exited with code ${code}`);
		});
	});

	afterEach(() => {
		// Restore original functions
		console.log = originalConsoleLog;
		console.error = originalConsoleError;
		process.exit = originalProcessExit;
	});

	describe("Directory Creation", () => {
		test("should create .clawd directory structure", async () => {
			const testDir = path.join(process.cwd(), "test-init-action");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				await initAction();

				// Verify directories were created
				const clawdDir = path.join(testDir, ".clawd");
				const promptsDir = path.join(clawdDir, "prompts");
				const pluginsDir = path.join(clawdDir, "plugins");
				const logsDir = path.join(clawdDir, "logs");

				const clawdExists = await fs
					.access(clawdDir)
					.then(() => true)
					.catch(() => false);
				const promptsExists = await fs
					.access(promptsDir)
					.then(() => true)
					.catch(() => false);
				const pluginsExists = await fs
					.access(pluginsDir)
					.then(() => true)
					.catch(() => false);
				const logsExists = await fs
					.access(logsDir)
					.then(() => true)
					.catch(() => false);

				expect(clawdExists).toBe(true);
				expect(promptsExists).toBe(true);
				expect(pluginsExists).toBe(true);
				expect(logsExists).toBe(true);

				// Clean up
				await fs.rm(clawdDir, { recursive: true, force: true });
			} finally {
				process.cwd = originalCwd;
			}
		});

		test("should work when directories already exist", async () => {
			const testDir = path.join(process.cwd(), "test-init-action-existing");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				const clawdDir = path.join(testDir, ".clawd");

				// Pre-create directories
				await fs.mkdir(path.join(clawdDir, "prompts"), { recursive: true });
				await fs.mkdir(path.join(clawdDir, "plugins"), { recursive: true });

				// Should not throw
				await initAction();

				// Verify all directories exist
				const promptsExists = await fs
					.access(path.join(clawdDir, "prompts"))
					.then(() => true)
					.catch(() => false);
				const pluginsExists = await fs
					.access(path.join(clawdDir, "plugins"))
					.then(() => true)
					.catch(() => false);
				const logsExists = await fs
					.access(path.join(clawdDir, "logs"))
					.then(() => true)
					.catch(() => false);

				expect(promptsExists).toBe(true);
				expect(pluginsExists).toBe(true);
				expect(logsExists).toBe(true);

				// Clean up
				await fs.rm(clawdDir, { recursive: true, force: true });
			} finally {
				process.cwd = originalCwd;
			}
		});
	});

	describe("Console Output", () => {
		test("should display success message", async () => {
			const testDir = path.join(process.cwd(), "test-init-action-output");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				await initAction();

				// Check success message
				expect(consoleLogOutput).toContain("\n✓ Initialized .clawd/ directory\n");
				expect(consoleLogOutput).toContain("  Created:");
				expect(consoleLogOutput).toContain("    .clawd/prompts/");
				expect(consoleLogOutput).toContain("    .clawd/plugins/");
				expect(consoleLogOutput).toContain("    .clawd/logs/\n");

				// Verify chalk.green was called
				expect(chalk.green).toHaveBeenCalledWith(
					"\n✓ Initialized .clawd/ directory\n",
				);

				// Verify chalk.white was called for each directory
				expect(chalk.white).toHaveBeenCalledWith("  Created:");
				expect(chalk.white).toHaveBeenCalledWith("    .clawd/prompts/");
				expect(chalk.white).toHaveBeenCalledWith("    .clawd/plugins/");
				expect(chalk.white).toHaveBeenCalledWith("    .clawd/logs/\n");

				// Clean up
				await fs.rm(path.join(testDir, ".clawd"), {
					recursive: true,
					force: true,
				});
			} finally {
				process.cwd = originalCwd;
			}
		});
	});

	describe("Error Handling", () => {
		test("should handle errors and exit with code 1", async () => {
			// Mock fs.mkdir to throw an error
			const originalMkdir = fs.mkdir;
			fs.mkdir = vi.fn().mockRejectedValue(new Error("Permission denied"));

			const testDir = path.join(process.cwd(), "test-init-action-error");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				await expect(initAction()).rejects.toThrow("Process exited with code 1");

				// Verify error was logged
				expect(consoleErrorOutput.length).toBeGreaterThan(0);
				expect(consoleErrorOutput[0]).toContain("✗ Error: Permission denied");

				// Verify chalk.red was called
				expect(chalk.red).toHaveBeenCalledWith(
					"\n✗ Error: Permission denied\n",
				);

				// Verify process.exit was called with 1
				expect(processExitCode).toBe(1);
			} finally {
				fs.mkdir = originalMkdir;
				process.cwd = originalCwd;
			}
		});

		test("should display error message with chalk.red", async () => {
			// Mock fs.mkdir to throw an error
			const originalMkdir = fs.mkdir;
			const testError = new Error("Disk full");
			fs.mkdir = vi.fn().mockRejectedValue(testError);

			const testDir = path.join(process.cwd(), "test-init-action-error2");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				await expect(initAction()).rejects.toThrow("Process exited with code 1");

				// Verify chalk.red was used for error message
				expect(chalk.red).toHaveBeenCalledWith("\n✗ Error: Disk full\n");
			} finally {
				fs.mkdir = originalMkdir;
				process.cwd = originalCwd;
			}
		});
	});

	describe("Path Construction", () => {
		test("should create directories relative to current working directory", async () => {
			const testDir = path.join(process.cwd(), "test-init-action-paths");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				await initAction();

				// Verify paths are relative to testDir
				const clawdPath = path.join(testDir, ".clawd");
				const promptsPath = path.join(clawdPath, "prompts");
				const pluginsPath = path.join(clawdPath, "plugins");
				const logsPath = path.join(clawdPath, "logs");

				// Check all paths exist
				await expect(fs.access(clawdPath)).resolves.toBeUndefined();
				await expect(fs.access(promptsPath)).resolves.toBeUndefined();
				await expect(fs.access(pluginsPath)).resolves.toBeUndefined();
				await expect(fs.access(logsPath)).resolves.toBeUndefined();

				// Clean up
				await fs.rm(clawdPath, { recursive: true, force: true });
			} finally {
				process.cwd = originalCwd;
			}
		});
	});
});
