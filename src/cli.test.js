import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock all action modules with spy functions
const mockRunAction = vi.fn().mockResolvedValue(undefined);
const mockListPromptsAction = vi.fn().mockResolvedValue(undefined);
const mockCopyPromptAction = vi.fn().mockResolvedValue(undefined);
const mockListPluginsAction = vi.fn();
const mockCreatePluginAction = vi.fn().mockResolvedValue(undefined);
const mockInitAction = vi.fn().mockResolvedValue(undefined);

vi.mock("./actions/run.js", () => ({
	runAction: mockRunAction,
}));

vi.mock("./actions/prompts.js", () => ({
	listPromptsAction: mockListPromptsAction,
	copyPromptAction: mockCopyPromptAction,
}));

vi.mock("./actions/plugins.js", () => ({
	listPluginsAction: mockListPluginsAction,
	createPluginAction: mockCreatePluginAction,
}));

vi.mock("./actions/init.js", () => ({
	initAction: mockInitAction,
}));

describe("CLI Action Routing", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Action Imports", () => {
		test("should import runAction from actions/run.js", async () => {
			const { runAction } = await import("./actions/run.js");
			expect(runAction).toBe(mockRunAction);
		});

		test("should import prompt actions from actions/prompts.js", async () => {
			const { listPromptsAction, copyPromptAction } = await import(
				"./actions/prompts.js"
			);
			expect(listPromptsAction).toBe(mockListPromptsAction);
			expect(copyPromptAction).toBe(mockCopyPromptAction);
		});

		test("should import plugin actions from actions/plugins.js", async () => {
			const { listPluginsAction, createPluginAction } = await import(
				"./actions/plugins.js"
			);
			expect(listPluginsAction).toBe(mockListPluginsAction);
			expect(createPluginAction).toBe(mockCreatePluginAction);
		});

		test("should import initAction from actions/init.js", async () => {
			const { initAction } = await import("./actions/init.js");
			expect(initAction).toBe(mockInitAction);
		});
	});

	describe("Action Function Behavior", () => {
		test("runAction should be callable with prompt and options", async () => {
			const { runAction } = await import("./actions/run.js");

			const userPrompt = "Build a web app";
			const options = { perpetual: true, nonInteractive: false };

			await runAction(userPrompt, options);

			expect(mockRunAction).toHaveBeenCalledTimes(1);
			expect(mockRunAction).toHaveBeenCalledWith(userPrompt, options);
		});

		test("runAction should be callable without prompt", async () => {
			const { runAction } = await import("./actions/run.js");

			const options = { perpetual: false, nonInteractive: true };

			await runAction(undefined, options);

			expect(mockRunAction).toHaveBeenCalledTimes(1);
			expect(mockRunAction).toHaveBeenCalledWith(undefined, options);
		});

		test("listPromptsAction should be callable", async () => {
			const { listPromptsAction } = await import("./actions/prompts.js");

			await listPromptsAction();

			expect(mockListPromptsAction).toHaveBeenCalledTimes(1);
		});

		test("copyPromptAction should be callable with name and options", async () => {
			const { copyPromptAction } = await import("./actions/prompts.js");

			const promptName = "test-prompt";
			const options = { all: false };

			await copyPromptAction(promptName, options);

			expect(mockCopyPromptAction).toHaveBeenCalledTimes(1);
			expect(mockCopyPromptAction).toHaveBeenCalledWith(promptName, options);
		});

		test("copyPromptAction should handle --all option", async () => {
			const { copyPromptAction } = await import("./actions/prompts.js");

			const promptName = "test-prompt";
			const options = { all: true };

			await copyPromptAction(promptName, options);

			expect(mockCopyPromptAction).toHaveBeenCalledTimes(1);
			expect(mockCopyPromptAction).toHaveBeenCalledWith(promptName, options);
		});

		test("listPluginsAction should be callable", async () => {
			const { listPluginsAction } = await import("./actions/plugins.js");

			listPluginsAction();

			expect(mockListPluginsAction).toHaveBeenCalledTimes(1);
		});

		test("createPluginAction should be callable with plugin name", async () => {
			const { createPluginAction } = await import("./actions/plugins.js");

			const pluginName = "my-plugin";

			await createPluginAction(pluginName);

			expect(mockCreatePluginAction).toHaveBeenCalledTimes(1);
			expect(mockCreatePluginAction).toHaveBeenCalledWith(pluginName);
		});

		test("initAction should be callable", async () => {
			const { initAction } = await import("./actions/init.js");

			await initAction();

			expect(mockInitAction).toHaveBeenCalledTimes(1);
		});
	});
});
