import {
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from "vitest";

// Mock chalk
const mockChalk = {
	bold: { blue: vi.fn((text) => text) },
	yellow: vi.fn((text) => text),
	white: vi.fn((text) => text),
	green: vi.fn((text) => text),
	blue: vi.fn((text) => text),
	red: vi.fn((text) => text),
};

vi.mock("chalk", () => ({
	default: mockChalk,
}));

// Mock prompt-loader
const mockListPrompts = vi.fn();
const mockCopyPromptToUser = vi.fn();

vi.mock("../core/prompt-loader.js", () => ({
	listPrompts: mockListPrompts,
	copyPromptToUser: mockCopyPromptToUser,
}));

describe("Prompt Actions", () => {
	let listPromptsAction;
	let copyPromptAction;
	let chalk;
	let originalConsoleLog;
	let originalConsoleError;
	let originalProcessExit;
	let consoleLogOutput;
	let consoleErrorOutput;
	let processExitCode;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Import modules
		chalk = (await import("chalk")).default;
		({ listPromptsAction, copyPromptAction } = await import("./prompts.js"));

		// Mock console methods
		consoleLogOutput = [];
		consoleErrorOutput = [];
		originalConsoleLog = console.log;
		originalConsoleError = console.error;
		console.log = vi.fn((...args) => consoleLogOutput.push(args.join(" ")));
		console.error = vi.fn((...args) =>
			consoleErrorOutput.push(args.join(" ")),
		);

		// Mock process.exit
		originalProcessExit = process.exit;
		processExitCode = null;
		process.exit = vi.fn((code) => {
			processExitCode = code;
			throw new Error(`Process exited with code ${code}`);
		});
	});

	afterEach(() => {
		console.log = originalConsoleLog;
		console.error = originalConsoleError;
		process.exit = originalProcessExit;
	});

	describe("listPromptsAction", () => {
		test("should list built-in prompts without overrides", async () => {
			mockListPrompts.mockResolvedValue({
				builtIn: ["plan-init", "exec-task", "eval-task"],
				userOverrides: [],
			});

			await listPromptsAction();

			expect(mockListPrompts).toHaveBeenCalledTimes(1);
			expect(consoleLogOutput).toContain("\n📝 Built-in Prompts:");
			expect(consoleLogOutput).toContain("  • plan-init");
			expect(consoleLogOutput).toContain("  • exec-task");
			expect(consoleLogOutput).toContain("  • eval-task");

			expect(chalk.bold.blue).toHaveBeenCalledWith("\n📝 Built-in Prompts:");
			expect(chalk.white).toHaveBeenCalledWith("  • plan-init");
			expect(chalk.white).toHaveBeenCalledWith("  • exec-task");
			expect(chalk.white).toHaveBeenCalledWith("  • eval-task");
		});

		test("should mark overridden built-in prompts with yellow", async () => {
			mockListPrompts.mockResolvedValue({
				builtIn: ["plan-init", "exec-task", "eval-task"],
				userOverrides: ["plan-init", "eval-task"],
			});

			await listPromptsAction();

			expect(consoleLogOutput).toContain(
				"  • plan-init (overridden in .clawd/prompts/)",
			);
			expect(consoleLogOutput).toContain("  • exec-task");
			expect(consoleLogOutput).toContain(
				"  • eval-task (overridden in .clawd/prompts/)",
			);

			expect(chalk.yellow).toHaveBeenCalledWith(
				"  • plan-init (overridden in .clawd/prompts/)",
			);
			expect(chalk.white).toHaveBeenCalledWith("  • exec-task");
			expect(chalk.yellow).toHaveBeenCalledWith(
				"  • eval-task (overridden in .clawd/prompts/)",
			);
		});

		test("should display custom user prompts", async () => {
			mockListPrompts.mockResolvedValue({
				builtIn: ["plan-init"],
				userOverrides: ["plan-init", "custom-prompt", "another-custom"],
			});

			await listPromptsAction();

			expect(consoleLogOutput).toContain("\n✏️  User Override Prompts:");
			expect(consoleLogOutput).toContain("  • custom-prompt (custom)");
			expect(consoleLogOutput).toContain("  • another-custom (custom)");

			expect(chalk.bold.blue).toHaveBeenCalledWith(
				"\n✏️  User Override Prompts:",
			);
			expect(chalk.green).toHaveBeenCalledWith("  • custom-prompt (custom)");
			expect(chalk.green).toHaveBeenCalledWith("  • another-custom (custom)");
		});

		test("should not display user override section if no custom prompts", async () => {
			mockListPrompts.mockResolvedValue({
				builtIn: ["plan-init", "exec-task"],
				userOverrides: ["plan-init"], // Only overrides, no custom
			});

			await listPromptsAction();

			// Should not show the custom prompts section
			const hasCustomSection = consoleLogOutput.some((line) =>
				line.includes("(custom)"),
			);
			expect(hasCustomSection).toBe(false);
		});

		test("should print empty line at the end", async () => {
			mockListPrompts.mockResolvedValue({
				builtIn: ["plan-init"],
				userOverrides: [],
			});

			await listPromptsAction();

			expect(console.log).toHaveBeenCalledWith();
		});

		test("should handle empty prompt lists", async () => {
			mockListPrompts.mockResolvedValue({
				builtIn: [],
				userOverrides: [],
			});

			await listPromptsAction();

			expect(consoleLogOutput).toContain("\n📝 Built-in Prompts:");
			expect(console.log).toHaveBeenCalledWith();
		});
	});

	describe("copyPromptAction", () => {
		describe("single prompt copy", () => {
			test("should copy a single prompt successfully", async () => {
				const promptName = "plan-init";
				const filePath = "/path/to/.clawd/prompts/plan-init.md";
				mockCopyPromptToUser.mockResolvedValue(filePath);

				await copyPromptAction(promptName, { all: false });

				expect(mockCopyPromptToUser).toHaveBeenCalledWith(promptName);
				expect(consoleLogOutput).toContain(
					`\n✓ Copied ${promptName} to ${filePath}\n`,
				);
				expect(chalk.green).toHaveBeenCalledWith(
					`\n✓ Copied ${promptName} to ${filePath}\n`,
				);
			});

			test("should handle errors and exit with code 1", async () => {
				const promptName = "invalid-prompt";
				const error = new Error("Prompt not found");
				mockCopyPromptToUser.mockRejectedValue(error);

				await expect(
					copyPromptAction(promptName, { all: false }),
				).rejects.toThrow("Process exited with code 1");

				expect(consoleErrorOutput).toContain("\n✗ Error: Prompt not found\n");
				expect(chalk.red).toHaveBeenCalledWith("\n✗ Error: Prompt not found\n");
				expect(processExitCode).toBe(1);
			});

			test("should handle file write errors", async () => {
				const promptName = "plan-init";
				const error = new Error("Permission denied");
				mockCopyPromptToUser.mockRejectedValue(error);

				await expect(
					copyPromptAction(promptName, { all: false }),
				).rejects.toThrow("Process exited with code 1");

				expect(consoleErrorOutput).toContain("\n✗ Error: Permission denied\n");
				expect(chalk.red).toHaveBeenCalledWith(
					"\n✗ Error: Permission denied\n",
				);
				expect(processExitCode).toBe(1);
			});
		});

		describe("copy all prompts", () => {
			test("should copy all prompts successfully", async () => {
				mockListPrompts.mockResolvedValue({
					builtIn: ["plan-init", "exec-task", "eval-task"],
					userOverrides: [],
				});
				mockCopyPromptToUser.mockResolvedValue("/path/to/file");

				await copyPromptAction("ignored", { all: true });

				expect(mockListPrompts).toHaveBeenCalledTimes(1);
				expect(mockCopyPromptToUser).toHaveBeenCalledTimes(3);
				expect(mockCopyPromptToUser).toHaveBeenCalledWith("plan-init");
				expect(mockCopyPromptToUser).toHaveBeenCalledWith("exec-task");
				expect(mockCopyPromptToUser).toHaveBeenCalledWith("eval-task");

				expect(consoleLogOutput).toContain("\nCopying 3 prompts...\n");
				expect(consoleLogOutput).toContain("✓ Copied plan-init");
				expect(consoleLogOutput).toContain("✓ Copied exec-task");
				expect(consoleLogOutput).toContain("✓ Copied eval-task");
				expect(consoleLogOutput).toContain(
					"\n✓ All prompts copied to .clawd/prompts/\n",
				);

				expect(chalk.blue).toHaveBeenCalledWith("\nCopying 3 prompts...\n");
				expect(chalk.green).toHaveBeenCalledWith("✓ Copied plan-init");
				expect(chalk.green).toHaveBeenCalledWith("✓ Copied exec-task");
				expect(chalk.green).toHaveBeenCalledWith("✓ Copied eval-task");
			});

			test("should handle individual copy failures gracefully", async () => {
				mockListPrompts.mockResolvedValue({
					builtIn: ["plan-init", "exec-task", "eval-task"],
					userOverrides: [],
				});

				mockCopyPromptToUser
					.mockResolvedValueOnce("/path/to/plan-init")
					.mockRejectedValueOnce(new Error("File exists"))
					.mockResolvedValueOnce("/path/to/eval-task");

				await copyPromptAction("ignored", { all: true });

				expect(consoleLogOutput).toContain("✓ Copied plan-init");
				expect(consoleLogOutput).toContain(
					"✗ Failed to copy exec-task: File exists",
				);
				expect(consoleLogOutput).toContain("✓ Copied eval-task");
				expect(consoleLogOutput).toContain(
					"\n✓ All prompts copied to .clawd/prompts/\n",
				);

				expect(chalk.green).toHaveBeenCalledWith("✓ Copied plan-init");
				expect(chalk.red).toHaveBeenCalledWith(
					"✗ Failed to copy exec-task: File exists",
				);
				expect(chalk.green).toHaveBeenCalledWith("✓ Copied eval-task");

				// Should NOT call process.exit for individual failures
				expect(processExitCode).toBeNull();
			});

			test("should display completion message even if some fail", async () => {
				mockListPrompts.mockResolvedValue({
					builtIn: ["prompt1", "prompt2"],
					userOverrides: [],
				});

				mockCopyPromptToUser
					.mockRejectedValueOnce(new Error("Error 1"))
					.mockRejectedValueOnce(new Error("Error 2"));

				await copyPromptAction("ignored", { all: true });

				expect(consoleLogOutput).toContain(
					"\n✓ All prompts copied to .clawd/prompts/\n",
				);
			});

			test("should handle empty built-in prompts list", async () => {
				mockListPrompts.mockResolvedValue({
					builtIn: [],
					userOverrides: [],
				});

				await copyPromptAction("ignored", { all: true });

				expect(consoleLogOutput).toContain("\nCopying 0 prompts...\n");
				expect(mockCopyPromptToUser).not.toHaveBeenCalled();
				expect(consoleLogOutput).toContain(
					"\n✓ All prompts copied to .clawd/prompts/\n",
				);
			});
		});

		describe("options handling", () => {
			test("should respect all: false option", async () => {
				mockCopyPromptToUser.mockResolvedValue("/path/to/prompt");

				await copyPromptAction("single-prompt", { all: false });

				expect(mockListPrompts).not.toHaveBeenCalled();
				expect(mockCopyPromptToUser).toHaveBeenCalledTimes(1);
				expect(mockCopyPromptToUser).toHaveBeenCalledWith("single-prompt");
			});

			test("should respect all: true option", async () => {
				mockListPrompts.mockResolvedValue({
					builtIn: ["prompt1"],
					userOverrides: [],
				});
				mockCopyPromptToUser.mockResolvedValue("/path/to/prompt");

				await copyPromptAction("ignored-name", { all: true });

				expect(mockListPrompts).toHaveBeenCalledTimes(1);
				expect(mockCopyPromptToUser).toHaveBeenCalledTimes(1);
				expect(mockCopyPromptToUser).toHaveBeenCalledWith("prompt1");
			});
		});
	});
});
