import { spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getActiveProcessCount,
	killAllProcesses,
	registerProcess,
} from "./process-manager.js";

describe("Process Manager", () => {
	let mockProcess;

	beforeEach(() => {
		// Create a mock child process
		mockProcess = {
			killed: false,
			kill: vi.fn(),
			on: vi.fn(),
		};
	});

	afterEach(() => {
		// Clean up any processes after each test
		killAllProcesses();
	});

	describe("registerProcess", () => {
		it("should track a registered process", () => {
			const initialCount = getActiveProcessCount();
			registerProcess(mockProcess);
			expect(getActiveProcessCount()).toBe(initialCount + 1);
		});

		it("should set up exit listener to remove process when it exits", () => {
			registerProcess(mockProcess);
			expect(mockProcess.on).toHaveBeenCalledWith("exit", expect.any(Function));

			// Simulate process exit
			const exitHandler = mockProcess.on.mock.calls.find(
				(call) => call[0] === "exit",
			)[1];
			exitHandler();

			// Process should be removed from tracking
			expect(getActiveProcessCount()).toBe(0);
		});
	});

	describe("killAllProcesses", () => {
		it("should kill all registered processes", () => {
			const mockProcess1 = {
				killed: false,
				kill: vi.fn(),
				on: vi.fn(),
			};
			const mockProcess2 = {
				killed: false,
				kill: vi.fn(),
				on: vi.fn(),
			};

			registerProcess(mockProcess1);
			registerProcess(mockProcess2);

			killAllProcesses();

			expect(mockProcess1.kill).toHaveBeenCalledWith("SIGTERM");
			expect(mockProcess2.kill).toHaveBeenCalledWith("SIGTERM");
			expect(getActiveProcessCount()).toBe(0);
		});

		it("should not attempt to kill already killed processes", () => {
			const mockProcess = {
				killed: true,
				kill: vi.fn(),
				on: vi.fn(),
			};

			registerProcess(mockProcess);
			killAllProcesses();

			expect(mockProcess.kill).not.toHaveBeenCalled();
		});

		it("should handle errors when killing processes", () => {
			const mockProcess = {
				killed: false,
				kill: vi.fn().mockImplementation(() => {
					throw new Error("Process already exited");
				}),
				on: vi.fn(),
			};

			registerProcess(mockProcess);

			// Should not throw
			expect(() => killAllProcesses()).not.toThrow();
		});
	});

	describe("integration with real child process", () => {
		it("should track and kill a real child process", async () => {
			// Spawn a long-running process
			const childProcess = spawn("sleep", ["10"], { stdio: "ignore" });

			registerProcess(childProcess);
			expect(getActiveProcessCount()).toBe(1);

			// Kill all processes
			killAllProcesses();

			// Wait a bit for the process to be killed
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Process should be killed
			expect(childProcess.killed).toBe(true);
		}, 1000);
	});
});
