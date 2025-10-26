import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import logger from "../core/logger.js";
import { ClaudeCodeAdapter } from "./claude-code.js";

// Mock dependencies
vi.mock("node:child_process");
vi.mock("../core/logger.js", () => ({
	default: {
		debug: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	},
}));

describe("ClaudeCodeAdapter", () => {
	let mockProcess;

	beforeEach(() => {
		// Create a mock child process
		mockProcess = new EventEmitter();
		mockProcess.stdout = new EventEmitter();
		mockProcess.stderr = new EventEmitter();
		mockProcess.stdin = {
			end: vi.fn(),
		};

		vi.mocked(spawn).mockReturnValue(mockProcess);
		logger.debug.mockClear();
		logger.error.mockClear();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("constructor", () => {
		it("should use default command and args", () => {
			const adapter = new ClaudeCodeAdapter();

			expect(adapter.command).toBe("claude");
			expect(adapter.args).toEqual(["--dangerously-skip-permissions"]);
		});

		it("should accept custom command", () => {
			const adapter = new ClaudeCodeAdapter({ command: "custom-claude" });

			expect(adapter.command).toBe("custom-claude");
		});

		it("should accept custom args", () => {
			const adapter = new ClaudeCodeAdapter({ args: ["--custom-flag"] });

			expect(adapter.args).toEqual(["--custom-flag"]);
		});

		it("should accept both custom command and args", () => {
			const adapter = new ClaudeCodeAdapter({
				command: "my-claude",
				args: ["--flag1", "--flag2"],
			});

			expect(adapter.command).toBe("my-claude");
			expect(adapter.args).toEqual(["--flag1", "--flag2"]);
		});

		it("should extend LLMAdapter", () => {
			const adapter = new ClaudeCodeAdapter();

			expect(adapter.config).toBeDefined();
		});
	});

	describe("execute", () => {
		it("should spawn claude process with correct arguments", async () => {
			const adapter = new ClaudeCodeAdapter();
			const prompt = "Test prompt";

			const executePromise = adapter.execute(prompt);

			expect(spawn).toHaveBeenCalledWith(
				"claude",
				["--dangerously-skip-permissions", "-p", "Test prompt"],
				{ stdio: ["pipe", "pipe", "pipe"] },
			);

			// Complete the process
			mockProcess.stdout.emit("data", Buffer.from("Response"));
			mockProcess.emit("close", 0);

			await executePromise;
		});

		it("should close stdin immediately", async () => {
			const adapter = new ClaudeCodeAdapter();

			const executePromise = adapter.execute("test");

			expect(mockProcess.stdin.end).toHaveBeenCalled();

			mockProcess.stdout.emit("data", Buffer.from("Response"));
			mockProcess.emit("close", 0);

			await executePromise;
		});

		it("should capture and return stdout output", async () => {
			const adapter = new ClaudeCodeAdapter();

			const executePromise = adapter.execute("test");

			mockProcess.stdout.emit("data", Buffer.from("Part 1 "));
			mockProcess.stdout.emit("data", Buffer.from("Part 2"));
			mockProcess.emit("close", 0);

			const result = await executePromise;

			expect(result).toBe("Part 1 Part 2");
		});

		it("should log debug information on success", async () => {
			const adapter = new ClaudeCodeAdapter();
			const prompt = "Test prompt";

			const executePromise = adapter.execute(prompt);

			expect(logger.debug).toHaveBeenCalledWith("LLM Input (execute):", {
				prompt,
			});

			mockProcess.stdout.emit("data", Buffer.from("Success"));
			mockProcess.emit("close", 0);

			await executePromise;

			expect(logger.debug).toHaveBeenCalledWith(
				"LLM Output (execute - success):",
				{ output: "Success" },
			);
		});

		it("should reject on non-zero exit code", async () => {
			const adapter = new ClaudeCodeAdapter();

			const executePromise = adapter.execute("test");

			mockProcess.stderr.emit("data", Buffer.from("Error occurred"));
			mockProcess.emit("close", 1);

			await expect(executePromise).rejects.toThrow(
				"Claude failed (exit code 1)",
			);
		});

		it("should include stdout and stderr in error message", async () => {
			const adapter = new ClaudeCodeAdapter();

			const executePromise = adapter.execute("test");

			mockProcess.stdout.emit("data", Buffer.from("stdout output"));
			mockProcess.stderr.emit("data", Buffer.from("stderr output"));
			mockProcess.emit("close", 1);

			await expect(executePromise).rejects.toThrow("stdout: stdout output");
			await expect(executePromise).rejects.toThrow("stderr: stderr output");
		});

		it("should log error details on failure", async () => {
			const adapter = new ClaudeCodeAdapter();

			const executePromise = adapter.execute("test");

			mockProcess.stderr.emit("data", Buffer.from("Error"));
			mockProcess.emit("close", 1);

			await expect(executePromise).rejects.toThrow();

			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining("Claude process failed with exit code 1"),
				expect.objectContaining({
					exitCode: 1,
					stderr: "Error",
				}),
			);
		});

		it("should reject on spawn error", async () => {
			const adapter = new ClaudeCodeAdapter();

			const executePromise = adapter.execute("test");

			const spawnError = new Error("Command not found");
			mockProcess.emit("error", spawnError);

			await expect(executePromise).rejects.toThrow(
				"Failed to spawn Claude: Command not found",
			);
		});

		it("should log spawn errors", async () => {
			const adapter = new ClaudeCodeAdapter();

			const executePromise = adapter.execute("test");

			const spawnError = new Error("Command not found");
			mockProcess.emit("error", spawnError);

			await expect(executePromise).rejects.toThrow();

			expect(logger.error).toHaveBeenCalledWith(
				"Failed to spawn Claude: Command not found",
			);
		});

		it("should handle empty output on error", async () => {
			const adapter = new ClaudeCodeAdapter();

			const executePromise = adapter.execute("test");

			mockProcess.emit("close", 1);

			await expect(executePromise).rejects.toThrow("No output captured");
		});

		it("should use custom command and args", async () => {
			const adapter = new ClaudeCodeAdapter({
				command: "custom-claude",
				args: ["--custom-flag"],
			});

			const executePromise = adapter.execute("test");

			expect(spawn).toHaveBeenCalledWith(
				"custom-claude",
				["--custom-flag", "-p", "test"],
				expect.any(Object),
			);

			mockProcess.stdout.emit("data", Buffer.from("Response"));
			mockProcess.emit("close", 0);

			await executePromise;
		});
	});

	describe("executeWithTUI", () => {
		it("should spawn claude process with TUI", async () => {
			const adapter = new ClaudeCodeAdapter();
			const prompt = "Test prompt";
			const mockTUI = { writeOutput: vi.fn() };

			const executePromise = adapter.executeWithTUI(prompt, mockTUI);

			expect(spawn).toHaveBeenCalledWith(
				"claude",
				["--dangerously-skip-permissions", "-p", "Test prompt"],
				{ stdio: ["pipe", "pipe", "pipe"] },
			);

			mockProcess.stdout.emit("data", Buffer.from("Response"));
			mockProcess.emit("close", 0);

			await executePromise;
		});

		it("should stream stdout to TUI", async () => {
			const adapter = new ClaudeCodeAdapter();
			const mockTUI = { writeOutput: vi.fn() };

			const executePromise = adapter.executeWithTUI("test", mockTUI);

			const data1 = Buffer.from("Part 1");
			const data2 = Buffer.from("Part 2");

			mockProcess.stdout.emit("data", data1);
			mockProcess.stdout.emit("data", data2);
			mockProcess.emit("close", 0);

			await executePromise;

			expect(mockTUI.writeOutput).toHaveBeenCalledWith(data1);
			expect(mockTUI.writeOutput).toHaveBeenCalledWith(data2);
		});

		it("should stream stderr to TUI", async () => {
			const adapter = new ClaudeCodeAdapter();
			const mockTUI = { writeOutput: vi.fn() };

			const executePromise = adapter.executeWithTUI("test", mockTUI);

			const errorData = Buffer.from("Error message");

			mockProcess.stderr.emit("data", errorData);
			mockProcess.emit("close", 0);

			await executePromise;

			expect(mockTUI.writeOutput).toHaveBeenCalledWith(errorData);
		});

		it("should return exit code and output", async () => {
			const adapter = new ClaudeCodeAdapter();
			const mockTUI = { writeOutput: vi.fn() };

			const executePromise = adapter.executeWithTUI("test", mockTUI);

			mockProcess.stdout.emit("data", Buffer.from("Output"));
			mockProcess.emit("close", 0);

			const result = await executePromise;

			expect(result).toEqual({
				exitCode: 0,
				output: "Output",
			});
		});

		it("should return non-zero exit code on failure", async () => {
			const adapter = new ClaudeCodeAdapter();
			const mockTUI = { writeOutput: vi.fn() };

			const executePromise = adapter.executeWithTUI("test", mockTUI);

			mockProcess.stderr.emit("data", Buffer.from("Error"));
			mockProcess.emit("close", 1);

			const result = await executePromise;

			expect(result).toEqual({
				exitCode: 1,
				output: "Error",
			});
		});

		it("should log error on non-zero exit code", async () => {
			const adapter = new ClaudeCodeAdapter();
			const mockTUI = { writeOutput: vi.fn() };

			const executePromise = adapter.executeWithTUI("test", mockTUI);

			mockProcess.emit("close", 1);

			await executePromise;

			expect(logger.error).toHaveBeenCalledWith(
				"Claude process exited with code 1",
			);
		});

		it("should handle spawn errors", async () => {
			const adapter = new ClaudeCodeAdapter();
			const mockTUI = { writeOutput: vi.fn() };

			const executePromise = adapter.executeWithTUI("test", mockTUI);

			const spawnError = new Error("Command not found");
			mockProcess.emit("error", spawnError);

			const result = await executePromise;

			expect(result).toEqual({
				exitCode: 1,
				output: "Command not found",
			});
		});

		it("should log spawn errors", async () => {
			const adapter = new ClaudeCodeAdapter();
			const mockTUI = { writeOutput: vi.fn() };

			const executePromise = adapter.executeWithTUI("test", mockTUI);

			const spawnError = new Error("Command not found");
			mockProcess.emit("error", spawnError);

			await executePromise;

			expect(logger.error).toHaveBeenCalledWith(
				"Failed to spawn Claude: Command not found",
			);
		});

		it("should close stdin when TUI is provided", async () => {
			const adapter = new ClaudeCodeAdapter();
			const mockTUI = { writeOutput: vi.fn() };

			const executePromise = adapter.executeWithTUI("test", mockTUI);

			expect(mockProcess.stdin.end).toHaveBeenCalled();

			mockProcess.stdout.emit("data", Buffer.from("Response"));
			mockProcess.emit("close", 0);

			await executePromise;
		});

		it("should use inherit stdio when no TUI provided", async () => {
			const adapter = new ClaudeCodeAdapter();

			const executePromise = adapter.executeWithTUI("test", null);

			expect(spawn).toHaveBeenCalledWith("claude", expect.any(Array), {
				stdio: "inherit",
			});

			mockProcess.emit("close", 0);

			await executePromise;
		});

		it("should not close stdin when no TUI provided", async () => {
			const adapter = new ClaudeCodeAdapter();

			const executePromise = adapter.executeWithTUI("test", null);

			expect(mockProcess.stdin.end).not.toHaveBeenCalled();

			mockProcess.emit("close", 0);

			await executePromise;
		});

		it("should log debug information", async () => {
			const adapter = new ClaudeCodeAdapter();
			const prompt = "Test prompt";
			const mockTUI = { writeOutput: vi.fn() };

			const executePromise = adapter.executeWithTUI(prompt, mockTUI);

			expect(logger.debug).toHaveBeenCalledWith("LLM Input (executeWithTUI):", {
				prompt,
			});

			mockProcess.stdout.emit("data", Buffer.from("Output"));
			mockProcess.emit("close", 0);

			await executePromise;

			expect(logger.debug).toHaveBeenCalledWith(
				"LLM Output (executeWithTUI):",
				{ exitCode: 0, output: "Output" },
			);
		});

		it("should combine stdout and stderr in output", async () => {
			const adapter = new ClaudeCodeAdapter();
			const mockTUI = { writeOutput: vi.fn() };

			const executePromise = adapter.executeWithTUI("test", mockTUI);

			mockProcess.stdout.emit("data", Buffer.from("stdout "));
			mockProcess.stderr.emit("data", Buffer.from("stderr"));
			mockProcess.emit("close", 0);

			const result = await executePromise;

			expect(result.output).toBe("stdout stderr");
		});
	});

	describe("validate", () => {
		it("should return true", () => {
			const adapter = new ClaudeCodeAdapter();

			expect(adapter.validate()).toBe(true);
		});
	});

	describe("getName", () => {
		it("should return 'Claude Code'", () => {
			const adapter = new ClaudeCodeAdapter();

			expect(adapter.getName()).toBe("Claude Code");
		});
	});
});
