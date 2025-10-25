import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock all dependencies
const mockChalk = {
	bold: {
		blue: vi.fn((text) => text),
	},
	green: Object.assign(
		vi.fn((text) => text),
		{
			bold: vi.fn((text) => text),
		},
	),
	yellow: vi.fn((text) => text),
	cyan: vi.fn((text) => text),
	red: vi.fn((text) => text),
	magenta: vi.fn((text) => text),
};

const mockLoadAdapter = vi.fn();
const mockEvaluateComplete = vi.fn();
const mockEvaluateTask = vi.fn();
const mockExecuteTask = vi.fn();
const mockLogger = {
	info: vi.fn(),
	error: vi.fn(),
};
const mockSetLoggerTUI = vi.fn();
const mockPlanInit = vi.fn();
const mockPlanGetNextTask = vi.fn();
const mockPlanMarkComplete = vi.fn();
const mockPlanSave = vi.fn();
const mockPlanLoad = vi.fn();
const mockPlanAddFeedback = vi.fn();
const mockInitTUI = vi.fn();
const mockLoadPlugins = vi.fn();

vi.mock("chalk", () => ({
	default: mockChalk,
}));

vi.mock("../adapters/loader.js", () => ({
	loadAdapter: mockLoadAdapter,
}));

vi.mock("../core/complete.js", () => ({
	evaluate: mockEvaluateComplete,
}));

vi.mock("../core/eval.js", () => ({
	evaluateTask: mockEvaluateTask,
}));

vi.mock("../core/exec.js", () => ({
	executeTask: mockExecuteTask,
}));

vi.mock("../core/logger.js", () => ({
	default: mockLogger,
	setLoggerTUI: mockSetLoggerTUI,
}));

vi.mock("../core/plan.js", () => ({
	init: mockPlanInit,
	getNextTask: mockPlanGetNextTask,
	markComplete: mockPlanMarkComplete,
	save: mockPlanSave,
	load: mockPlanLoad,
	addFeedback: mockPlanAddFeedback,
}));

vi.mock("../core/tui.js", () => ({
	initTUI: mockInitTUI,
}));

vi.mock("../plugin-system/loader.js", () => ({
	loadPlugins: mockLoadPlugins,
}));

describe("runAction", () => {
	let runAction;
	let originalConsoleLog;
	let originalConsoleError;
	let originalProcessExit;
	let consoleLogOutput;
	let consoleErrorOutput;
	let processExitCode;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Import the function
		({ runAction } = await import("./run.js"));

		// Mock console
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

		// Default mock implementations
		mockLoadAdapter.mockResolvedValue({
			getName: () => "test-adapter",
		});
		mockLoadPlugins.mockResolvedValue([]);
		mockPlanInit.mockResolvedValue({
			brief: "Test Project",
			goal: "Build something",
			tasks: [],
		});
		mockPlanGetNextTask.mockReturnValue(null); // No tasks by default
		mockEvaluateComplete.mockResolvedValue(true); // Project complete by default
	});

	afterEach(() => {
		console.log = originalConsoleLog;
		console.error = originalConsoleError;
		process.exit = originalProcessExit;
	});

	describe("Basic Functionality", () => {
		test("should be a function", () => {
			expect(typeof runAction).toBe("function");
		});

		test("should accept userPrompt and options", async () => {
			process.exit = vi.fn(); // Don't throw on exit

			await expect(
				runAction("test prompt", { nonInteractive: true }),
			).resolves.toBeUndefined();
		});
	});

	describe("Non-interactive mode", () => {
		test("should not initialize TUI when nonInteractive is true", async () => {
			process.exit = vi.fn();

			await runAction("Build a web app", { nonInteractive: true });

			expect(mockInitTUI).not.toHaveBeenCalled();
			expect(consoleLogOutput).toContain(
				"\n🤖 Clawd - Claude Code Orchestrator\n",
			);
		});

		test("should require prompt in non-interactive mode", async () => {
			await expect(
				runAction(undefined, { nonInteractive: true }),
			).rejects.toThrow("Process exited with code 1");

			expect(consoleErrorOutput).toContain("\n❌ Error: Prompt is required\n");
			expect(processExitCode).toBe(1);
		});

		test("should display adapter name", async () => {
			process.exit = vi.fn();
			mockLoadAdapter.mockResolvedValue({
				getName: () => "claude-adapter",
			});

			await runAction("test", { nonInteractive: true });

			expect(consoleLogOutput).toContain("✓ Using adapter: claude-adapter");
		});

		test("should display plugin count when plugins loaded", async () => {
			process.exit = vi.fn();
			mockLoadPlugins.mockResolvedValue([{}, {}, {}]);

			await runAction("test", { nonInteractive: true });

			expect(consoleLogOutput).toContain("✓ Loaded 3 plugin(s)");
		});
	});

	describe("Interactive mode", () => {
		test("should initialize TUI", async () => {
			process.exit = vi.fn();
			const mockTUI = {
				showBanner: vi.fn(),
				log: vi.fn(),
				updateStatus: vi.fn(),
				destroy: vi.fn(),
			};
			mockInitTUI.mockReturnValue(mockTUI);

			await runAction("test", { nonInteractive: false });

			expect(mockInitTUI).toHaveBeenCalled();
			expect(mockSetLoggerTUI).toHaveBeenCalledWith(mockTUI);
			expect(mockTUI.showBanner).toHaveBeenCalledWith(
				"🤖 Clawd - Claude Code Orchestrator",
				"info",
			);
			expect(mockTUI.destroy).toHaveBeenCalled();
		});

		test("should prompt for user input if no prompt provided", async () => {
			process.exit = vi.fn();
			const mockTUI = {
				showBanner: vi.fn(),
				log: vi.fn(),
				prompt: vi.fn().mockResolvedValue("User input"),
				updateStatus: vi.fn(),
				destroy: vi.fn(),
			};
			mockInitTUI.mockReturnValue(mockTUI);

			await runAction(undefined, { nonInteractive: false });

			expect(mockTUI.prompt).toHaveBeenCalledWith(
				"What would you like to build?",
			);
			expect(mockPlanInit).toHaveBeenCalledWith(
				"User input",
				expect.any(Object),
			);
		});

		test("should exit if user provides empty prompt", async () => {
			const mockTUI = {
				showBanner: vi.fn(),
				log: vi.fn(),
				prompt: vi.fn().mockResolvedValue(""),
				updateStatus: vi.fn(),
				destroy: vi.fn(),
			};
			mockInitTUI.mockReturnValue(mockTUI);

			await expect(
				runAction(undefined, { nonInteractive: false }),
			).rejects.toThrow("Process exited with code 1");

			expect(mockTUI.log).toHaveBeenCalledWith(
				"No prompt provided. Exiting.",
				"error",
			);
			expect(processExitCode).toBe(1);
		});
	});

	describe("Dependencies", () => {
		test("should load LLM adapter", async () => {
			process.exit = vi.fn();

			await runAction("test", { nonInteractive: true });

			expect(mockLoadAdapter).toHaveBeenCalled();
		});

		test("should load plugins", async () => {
			process.exit = vi.fn();

			await runAction("test", { nonInteractive: true });

			expect(mockLoadPlugins).toHaveBeenCalled();
		});

		test("should initialize plan with user prompt", async () => {
			process.exit = vi.fn();
			const userPrompt = "Build something";
			const options = { nonInteractive: true };

			await runAction(userPrompt, options);

			expect(mockPlanInit).toHaveBeenCalledWith(userPrompt, options);
		});
	});

	describe("Error handling", () => {
		test("should handle errors and exit", async () => {
			const error = new Error("Test error");
			mockLoadAdapter.mockRejectedValue(error);

			await expect(runAction("test", { nonInteractive: true })).rejects.toThrow(
				"Process exited with code 1",
			);

			expect(mockLogger.error).toHaveBeenCalledWith("Error: Test error");
			expect(consoleErrorOutput).toContain("\n❌ Error: Test error\n");
			expect(processExitCode).toBe(1);
		});

		test("should log stack trace on error", async () => {
			const error = new Error("Test error");
			error.stack = "Error stack trace";
			mockLoadAdapter.mockRejectedValue(error);

			await expect(runAction("test", { nonInteractive: true })).rejects.toThrow(
				"Process exited with code 1",
			);

			expect(mockLogger.error).toHaveBeenCalledWith("Error stack trace");
		});
	});
});
