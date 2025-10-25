import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock fs/promises
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockAccess = vi.fn().mockResolvedValue(undefined);
const mockRm = vi.fn().mockResolvedValue(undefined);

vi.mock("node:fs/promises", () => ({
	default: {
		mkdir: mockMkdir,
		access: mockAccess,
		rm: mockRm,
	},
}));

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

		// Reset mock implementations
		mockMkdir.mockResolvedValue(undefined);
		mockAccess.mockResolvedValue(undefined);
		mockRm.mockResolvedValue(undefined);

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

				// Verify mkdir was called for each directory
				const clawdDir = path.join(testDir, ".clawd");
				const promptsDir = path.join(clawdDir, "prompts");
				const pluginsDir = path.join(clawdDir, "plugins");
				const logsDir = path.join(clawdDir, "logs");

				expect(mockMkdir).toHaveBeenCalledWith(promptsDir, { recursive: true });
				expect(mockMkdir).toHaveBeenCalledWith(pluginsDir, { recursive: true });
				expect(mockMkdir).toHaveBeenCalledWith(logsDir, { recursive: true });
			} finally {
				process.cwd = originalCwd;
			}
		});

		test("should work when directories already exist", async () => {
			const testDir = path.join(process.cwd(), "test-init-action-existing");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				// Should not throw when directories already exist
				await initAction();

				// Verify mkdir was called (recursive: true handles existing dirs)
				expect(mockMkdir).toHaveBeenCalled();
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
				expect(consoleLogOutput).toContain(
					"\n✓ Initialized .clawd/ directory\n",
				);
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
			} finally {
				process.cwd = originalCwd;
			}
		});
	});

	describe("Error Handling", () => {
		test("should handle errors and exit with code 1", async () => {
			// Mock fs.mkdir to throw an error
			mockMkdir.mockRejectedValue(new Error("Permission denied"));

			const testDir = path.join(process.cwd(), "test-init-action-error");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				await expect(initAction()).rejects.toThrow(
					"Process exited with code 1",
				);

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
				process.cwd = originalCwd;
			}
		});

		test("should display error message with chalk.red", async () => {
			// Mock fs.mkdir to throw an error
			const testError = new Error("Disk full");
			mockMkdir.mockRejectedValue(testError);

			const testDir = path.join(process.cwd(), "test-init-action-error2");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				await expect(initAction()).rejects.toThrow(
					"Process exited with code 1",
				);

				// Verify chalk.red was used for error message
				expect(chalk.red).toHaveBeenCalledWith("\n✗ Error: Disk full\n");
			} finally {
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

				// Verify mkdir was called with correct paths
				expect(mockMkdir).toHaveBeenCalledWith(promptsPath, {
					recursive: true,
				});
				expect(mockMkdir).toHaveBeenCalledWith(pluginsPath, {
					recursive: true,
				});
				expect(mockMkdir).toHaveBeenCalledWith(logsPath, { recursive: true });
			} finally {
				process.cwd = originalCwd;
			}
		});
	});
});
