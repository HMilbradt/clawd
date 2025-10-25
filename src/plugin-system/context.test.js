import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	buildPlanContext,
	buildExecContext,
	buildEvalContext,
	buildCompleteContext,
} from "./context.js";
import logger from "../core/logger.js";

vi.mock("../core/logger.js", () => ({
	default: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}));

describe("context builders", () => {
	let mockDate;

	beforeEach(() => {
		// Mock Date to have consistent timestamps
		mockDate = new Date("2024-01-15T12:00:00.000Z");
		vi.useFakeTimers();
		vi.setSystemTime(mockDate);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("buildPlanContext", () => {
		it("should build context with required fields", () => {
			const userPrompt = "Build a web app";
			const options = { verbose: true };

			const context = buildPlanContext(userPrompt, options);

			expect(context).toMatchObject({
				userPrompt: "Build a web app",
				options: { verbose: true },
				planContent: null,
				timestamp: "2024-01-15T12:00:00.000Z",
			});
			expect(context.logger).toBe(logger);
			expect(context.runPrompt).toBeTypeOf("function");
		});

		it("should include planContent when provided", () => {
			const userPrompt = "Build a web app";
			const options = {};
			const planContent = "1. Setup project\n2. Build features";

			const context = buildPlanContext(userPrompt, options, planContent);

			expect(context.planContent).toBe("1. Setup project\n2. Build features");
		});

		it("should set planContent to null by default", () => {
			const context = buildPlanContext("test", {});

			expect(context.planContent).toBeNull();
		});

		it("should include timestamp in ISO format", () => {
			const context = buildPlanContext("test", {});

			expect(context.timestamp).toBe("2024-01-15T12:00:00.000Z");
		});

		it("should include logger instance", () => {
			const context = buildPlanContext("test", {});

			expect(context.logger).toBe(logger);
		});

		it("should include runPrompt function", () => {
			const context = buildPlanContext("test", {});

			expect(context.runPrompt).toBeTypeOf("function");
		});
	});

	describe("buildExecContext", () => {
		it("should build context with required fields", () => {
			const task = { id: 1, description: "Setup project" };
			const prompt = "Execute task 1";
			const options = { tui: true };

			const context = buildExecContext(task, prompt, options);

			expect(context).toMatchObject({
				task: { id: 1, description: "Setup project" },
				prompt: "Execute task 1",
				options: { tui: true },
				output: null,
				exitCode: null,
				timestamp: "2024-01-15T12:00:00.000Z",
			});
			expect(context.logger).toBe(logger);
			expect(context.runPrompt).toBeTypeOf("function");
		});

		it("should include output and exitCode when provided", () => {
			const task = { id: 1 };
			const prompt = "test";
			const options = {};
			const output = "Task completed successfully";
			const exitCode = 0;

			const context = buildExecContext(task, prompt, options, output, exitCode);

			expect(context.output).toBe("Task completed successfully");
			expect(context.exitCode).toBe(0);
		});

		it("should set output and exitCode to null by default", () => {
			const context = buildExecContext({ id: 1 }, "test", {});

			expect(context.output).toBeNull();
			expect(context.exitCode).toBeNull();
		});

		it("should handle non-zero exit codes", () => {
			const context = buildExecContext(
				{ id: 1 },
				"test",
				{},
				"Error occurred",
				1,
			);

			expect(context.exitCode).toBe(1);
			expect(context.output).toBe("Error occurred");
		});

		it("should include timestamp in ISO format", () => {
			const context = buildExecContext({ id: 1 }, "test", {});

			expect(context.timestamp).toBe("2024-01-15T12:00:00.000Z");
		});

		it("should include logger and runPrompt", () => {
			const context = buildExecContext({ id: 1 }, "test", {});

			expect(context.logger).toBe(logger);
			expect(context.runPrompt).toBeTypeOf("function");
		});
	});

	describe("buildEvalContext", () => {
		it("should build context with required fields", () => {
			const task = { id: 1, description: "Setup project" };

			const context = buildEvalContext(task);

			expect(context).toMatchObject({
				task: { id: 1, description: "Setup project" },
				result: null,
				timestamp: "2024-01-15T12:00:00.000Z",
			});
			expect(context.logger).toBe(logger);
			expect(context.runPrompt).toBeTypeOf("function");
		});

		it("should include result when provided", () => {
			const task = { id: 1 };
			const result = {
				complete: true,
				feedback: "Task completed successfully",
			};

			const context = buildEvalContext(task, result);

			expect(context.result).toEqual({
				complete: true,
				feedback: "Task completed successfully",
			});
		});

		it("should set result to null by default", () => {
			const context = buildEvalContext({ id: 1 });

			expect(context.result).toBeNull();
		});

		it("should handle incomplete task results", () => {
			const task = { id: 1 };
			const result = {
				complete: false,
				feedback: "Need to add more tests",
			};

			const context = buildEvalContext(task, result);

			expect(context.result.complete).toBe(false);
			expect(context.result.feedback).toBe("Need to add more tests");
		});

		it("should include timestamp in ISO format", () => {
			const context = buildEvalContext({ id: 1 });

			expect(context.timestamp).toBe("2024-01-15T12:00:00.000Z");
		});

		it("should include logger and runPrompt", () => {
			const context = buildEvalContext({ id: 1 });

			expect(context.logger).toBe(logger);
			expect(context.runPrompt).toBeTypeOf("function");
		});
	});

	describe("buildCompleteContext", () => {
		it("should build context with required fields", () => {
			const projectBrief = "E-commerce website";
			const goal = "Build a fully functional online store";
			const plan = { tasks: [{ id: 1 }, { id: 2 }] };
			const allTasksMarkedComplete = true;

			const context = buildCompleteContext(
				projectBrief,
				goal,
				plan,
				allTasksMarkedComplete,
			);

			expect(context).toMatchObject({
				projectBrief: "E-commerce website",
				goal: "Build a fully functional online store",
				plan: { tasks: [{ id: 1 }, { id: 2 }] },
				allTasksMarkedComplete: true,
				isComplete: null,
				timestamp: "2024-01-15T12:00:00.000Z",
			});
			expect(context.logger).toBe(logger);
			expect(context.runPrompt).toBeTypeOf("function");
		});

		it("should include isComplete when provided", () => {
			const context = buildCompleteContext("Project", "Goal", {}, true, true);

			expect(context.isComplete).toBe(true);
		});

		it("should set isComplete to null by default", () => {
			const context = buildCompleteContext("Project", "Goal", {}, true);

			expect(context.isComplete).toBeNull();
		});

		it("should handle incomplete projects", () => {
			const context = buildCompleteContext("Project", "Goal", {}, false, false);

			expect(context.allTasksMarkedComplete).toBe(false);
			expect(context.isComplete).toBe(false);
		});

		it("should include timestamp in ISO format", () => {
			const context = buildCompleteContext("Project", "Goal", {}, true);

			expect(context.timestamp).toBe("2024-01-15T12:00:00.000Z");
		});

		it("should include logger and runPrompt", () => {
			const context = buildCompleteContext("Project", "Goal", {}, true);

			expect(context.logger).toBe(logger);
			expect(context.runPrompt).toBeTypeOf("function");
		});
	});

	describe("runPrompt function", () => {
		it("should be accessible in all contexts", () => {
			const planContext = buildPlanContext("test", {});
			const execContext = buildExecContext({}, "test", {});
			const evalContext = buildEvalContext({});
			const completeContext = buildCompleteContext("", "", {}, true);

			expect(planContext.runPrompt).toBeTypeOf("function");
			expect(execContext.runPrompt).toBeTypeOf("function");
			expect(evalContext.runPrompt).toBeTypeOf("function");
			expect(completeContext.runPrompt).toBeTypeOf("function");
		});

		it("should be the same function across contexts", () => {
			const planContext = buildPlanContext("test", {});
			const execContext = buildExecContext({}, "test", {});

			expect(planContext.runPrompt).toBe(execContext.runPrompt);
		});
	});

	describe("timestamp generation", () => {
		it("should generate different timestamps for contexts created at different times", () => {
			const context1 = buildPlanContext("test", {});

			// Advance time by 1 second
			vi.advanceTimersByTime(1000);

			const context2 = buildPlanContext("test", {});

			expect(context1.timestamp).not.toBe(context2.timestamp);
			expect(context1.timestamp).toBe("2024-01-15T12:00:00.000Z");
			expect(context2.timestamp).toBe("2024-01-15T12:00:01.000Z");
		});
	});

	describe("context immutability", () => {
		it("should create independent context objects", () => {
			const options1 = { verbose: true };
			const context1 = buildPlanContext("test1", options1);

			const options2 = { verbose: false };
			const context2 = buildPlanContext("test2", options2);

			expect(context1.userPrompt).toBe("test1");
			expect(context2.userPrompt).toBe("test2");
			expect(context1.options.verbose).toBe(true);
			expect(context2.options.verbose).toBe(false);
		});
	});
});
