import { jest } from "@jest/globals";

// Mock dependencies
const mockLogger = {
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};

const mockSpawnClaude = jest.fn();
const mockLoadPrompt = jest.fn();
const mockGetDiff = jest.fn();

jest.unstable_mockModule("./logger.js", () => ({
	default: mockLogger,
}));

jest.unstable_mockModule("./claude-helper.js", () => ({
	spawnClaude: mockSpawnClaude,
}));

jest.unstable_mockModule("./prompt-loader.js", () => ({
	loadPrompt: mockLoadPrompt,
}));

jest.unstable_mockModule("./git-setup.js", () => ({
	getDiff: mockGetDiff,
}));

const { evaluateStep, allStepsComplete } = await import("./step-evaluator.js");

describe("step-evaluator", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("evaluateStep", () => {
		test("returns complete when step is successfully implemented", async () => {
			const diff = `diff --git a/test.js b/test.js
+++ b/test.js
+function hello() {
+  console.log('Hello');
+}`;

			mockGetDiff.mockResolvedValue(diff);
			mockLoadPrompt.mockResolvedValue("Evaluate this step...");
			mockSpawnClaude.mockResolvedValue("STEP_COMPLETE");

			const result = await evaluateStep(
				"Implement hello function",
				"main",
				"feature-branch",
				"Build a greeting app",
				"Create hello function",
			);

			expect(result.complete).toBe(true);
			expect(result.feedback).toBe("");
			expect(mockLogger.info).toHaveBeenCalledWith(
				"Evaluating step completion: Implement hello function",
			);
			expect(mockLogger.info).toHaveBeenCalledWith(
				"✓ Step evaluation: COMPLETE",
			);
		});

		test("returns incomplete with feedback when step is not fully implemented", async () => {
			const diff = `diff --git a/test.js b/test.js
+++ b/test.js
+// TODO: implement this`;

			const claudeResponse = `STEP_INCOMPLETE
Feedback: The function is not implemented, only a TODO comment was added. Please implement the actual hello function.`;

			mockGetDiff.mockResolvedValue(diff);
			mockLoadPrompt.mockResolvedValue("Evaluate this step...");
			mockSpawnClaude.mockResolvedValue(claudeResponse);

			const result = await evaluateStep(
				"Implement hello function",
				"main",
				"feature-branch",
				"Build a greeting app",
				"Create hello function",
			);

			expect(result.complete).toBe(false);
			expect(result.feedback).toContain("The function is not implemented");
			expect(mockLogger.info).toHaveBeenCalledWith(
				"Step evaluation: INCOMPLETE",
			);
		});

		test("returns incomplete when no changes were made", async () => {
			mockGetDiff.mockResolvedValue("");

			const result = await evaluateStep(
				"Implement hello function",
				"main",
				"feature-branch",
				"Build a greeting app",
				"Create hello function",
			);

			expect(result.complete).toBe(false);
			expect(result.feedback).toBe(
				"No changes were made. Please implement the required functionality for this step.",
			);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"No changes detected in step branch",
			);
		});

		test("handles whitespace-only diff", async () => {
			mockGetDiff.mockResolvedValue("   \n  \t\n  ");

			const result = await evaluateStep(
				"Implement hello function",
				"main",
				"feature-branch",
				"Build a greeting app",
				"Create hello function",
			);

			expect(result.complete).toBe(false);
			expect(result.feedback).toBe(
				"No changes were made. Please implement the required functionality for this step.",
			);
		});

		test("uses default feedback when Claude response does not include Feedback section", async () => {
			const diff = "some changes";
			mockGetDiff.mockResolvedValue(diff);
			mockLoadPrompt.mockResolvedValue("Evaluate...");
			mockSpawnClaude.mockResolvedValue("STEP_INCOMPLETE");

			const result = await evaluateStep(
				"Implement hello function",
				"main",
				"feature-branch",
				"Build a greeting app",
				"Create hello function",
			);

			expect(result.complete).toBe(false);
			expect(result.feedback).toBe(
				"The step implementation is incomplete. Please review the requirements and ensure all functionality is implemented.",
			);
		});

		test("passes correct parameters to loadPrompt", async () => {
			const diff = "changes";
			mockGetDiff.mockResolvedValue(diff);
			mockLoadPrompt.mockResolvedValue("prompt");
			mockSpawnClaude.mockResolvedValue("STEP_COMPLETE");

			await evaluateStep(
				"Test step",
				"main",
				"feature",
				"Project brief",
				"Project goal",
			);

			expect(mockLoadPrompt).toHaveBeenCalledWith("step-evaluation", {
				stepDescription: "Test step",
				projectBrief: "Project brief",
				goal: "Project goal",
				gitDiff: diff,
			});
		});

		test("passes correct parameters to getDiff", async () => {
			mockGetDiff.mockResolvedValue("diff");
			mockLoadPrompt.mockResolvedValue("prompt");
			mockSpawnClaude.mockResolvedValue("STEP_COMPLETE");

			await evaluateStep(
				"Test step",
				"main-branch",
				"feature-branch",
				"Brief",
				"Goal",
				"/custom/path",
			);

			expect(mockGetDiff).toHaveBeenCalledWith(
				"main-branch",
				"feature-branch",
				"/custom/path",
			);
		});

		test("extracts multiline feedback correctly", async () => {
			const claudeResponse = `STEP_INCOMPLETE
Feedback: Line 1 of feedback
Line 2 of feedback
Line 3 of feedback`;

			mockGetDiff.mockResolvedValue("diff");
			mockLoadPrompt.mockResolvedValue("prompt");
			mockSpawnClaude.mockResolvedValue(claudeResponse);

			const result = await evaluateStep(
				"step",
				"main",
				"feature",
				"brief",
				"goal",
			);

			expect(result.feedback).toBe(
				"Line 1 of feedback\nLine 2 of feedback\nLine 3 of feedback",
			);
		});
	});

	describe("allStepsComplete", () => {
		test("returns true when all steps in all phases are done", () => {
			const phases = [
				{
					name: "Phase 1",
					steps: [
						{ done: true, description: "Step 1" },
						{ done: true, description: "Step 2" },
					],
				},
				{
					name: "Phase 2",
					steps: [{ done: true, description: "Step 3" }],
				},
			];

			const result = allStepsComplete(phases);

			expect(result).toBe(true);
		});

		test("returns false when any step is not done", () => {
			const phases = [
				{
					name: "Phase 1",
					steps: [
						{ done: true, description: "Step 1" },
						{ done: false, description: "Step 2" },
					],
				},
				{
					name: "Phase 2",
					steps: [{ done: true, description: "Step 3" }],
				},
			];

			const result = allStepsComplete(phases);

			expect(result).toBe(false);
		});

		test("returns true for empty phases array", () => {
			const result = allStepsComplete([]);

			expect(result).toBe(true);
		});

		test("returns true for phases with no steps", () => {
			const phases = [
				{ name: "Phase 1", steps: [] },
				{ name: "Phase 2", steps: [] },
			];

			const result = allStepsComplete(phases);

			expect(result).toBe(true);
		});

		test("returns false when last step is incomplete", () => {
			const phases = [
				{
					name: "Phase 1",
					steps: [
						{ done: true, description: "Step 1" },
						{ done: true, description: "Step 2" },
						{ done: false, description: "Step 3" },
					],
				},
			];

			const result = allStepsComplete(phases);

			expect(result).toBe(false);
		});

		test("returns false when first step is incomplete", () => {
			const phases = [
				{
					name: "Phase 1",
					steps: [
						{ done: false, description: "Step 1" },
						{ done: true, description: "Step 2" },
					],
				},
			];

			const result = allStepsComplete(phases);

			expect(result).toBe(false);
		});
	});
});
