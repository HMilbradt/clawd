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
const mockGetCommitsSince = jest.fn();
const mockGetCommitMessage = jest.fn();
const mockGetCommitDiff = jest.fn();

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
	getCommitsSince: mockGetCommitsSince,
	getCommitMessage: mockGetCommitMessage,
	getCommitDiff: mockGetCommitDiff,
}));

const { evaluatePhase } = await import("./phase-evaluator.js");

describe("phase-evaluator", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("evaluatePhase", () => {
		const mockPhase = {
			name: "Setup",
			steps: [
				{ done: false, description: "Initialize project" },
				{ done: false, description: "Create files" },
				{ done: false, description: "Run tests" },
			],
		};

		test("returns complete when all steps are successfully implemented", async () => {
			const mockCommits = ["abc123", "def456", "ghi789"];
			const mockDiff = "diff --git a/test.js...";

			mockGetCommitsSince.mockResolvedValue(mockCommits);
			mockGetCommitMessage.mockResolvedValueOnce("Initialize project");
			mockGetCommitMessage.mockResolvedValueOnce("Create files");
			mockGetCommitMessage.mockResolvedValueOnce("Run tests");
			mockGetCommitDiff.mockResolvedValue("diff content");
			mockGetDiff.mockResolvedValue(mockDiff);
			mockLoadPrompt.mockResolvedValue("Evaluate this phase...");
			mockSpawnClaude.mockResolvedValue("PHASE_COMPLETE");

			const result = await evaluatePhase(
				mockPhase,
				"main",
				"clawd/phase-0",
				"Build a test app",
				"Create working tests",
			);

			expect(result.complete).toBe(true);
			expect(result.incompleteSteps).toEqual([]);
			expect(mockLogger.info).toHaveBeenCalledWith(
				"✓ Phase evaluation: COMPLETE",
			);
		});

		test("returns incomplete steps with feedback when phase not fully complete", async () => {
			const mockCommits = ["abc123", "def456"];
			mockGetCommitsSince.mockResolvedValue(mockCommits);
			mockGetCommitMessage.mockResolvedValue("Some work");
			mockGetCommitDiff.mockResolvedValue("diff");
			mockGetDiff.mockResolvedValue("phase diff");
			mockLoadPrompt.mockResolvedValue("prompt");

			const claudeResponse = `PHASE_INCOMPLETE
Step 2: Create files
Feedback: The files were not created. Please implement file creation.

Step 3: Run tests
Feedback: Tests were not run. Please add and execute tests.`;

			mockSpawnClaude.mockResolvedValue(claudeResponse);

			const result = await evaluatePhase(
				mockPhase,
				"main",
				"clawd/phase-0",
				"Brief",
				"Goal",
			);

			expect(result.complete).toBe(false);
			expect(result.incompleteSteps).toEqual([
				{
					stepIndex: 1,
					description: "Create files",
					feedback:
						"The files were not created. Please implement file creation.",
				},
				{
					stepIndex: 2,
					description: "Run tests",
					feedback: "Tests were not run. Please add and execute tests.",
				},
			]);
		});

		test("handles no commits in phase branch", async () => {
			mockGetCommitsSince.mockResolvedValue([]);

			const result = await evaluatePhase(
				mockPhase,
				"main",
				"clawd/phase-0",
				"Brief",
				"Goal",
			);

			expect(result.complete).toBe(false);
			expect(result.incompleteSteps).toHaveLength(3);
			expect(result.incompleteSteps[0].feedback).toContain(
				"No changes were made",
			);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"No commits found in phase branch",
			);
		});

		test("properly parses multiline feedback", async () => {
			mockGetCommitsSince.mockResolvedValue(["abc123"]);
			mockGetCommitMessage.mockResolvedValue("Work");
			mockGetCommitDiff.mockResolvedValue("diff");
			mockGetDiff.mockResolvedValue("diff");
			mockLoadPrompt.mockResolvedValue("prompt");

			const claudeResponse = `PHASE_INCOMPLETE
Step 1: Initialize project
Feedback: Multiple issues found:
- Missing package.json
- No git repository initialized
- Dependencies not installed`;

			mockSpawnClaude.mockResolvedValue(claudeResponse);

			const result = await evaluatePhase(mockPhase, "main", "phase", "b", "g");

			expect(result.incompleteSteps[0].feedback).toBe(
				`Multiple issues found:
- Missing package.json
- No git repository initialized
- Dependencies not installed`,
			);
		});

		test("calls git functions with correct parameters", async () => {
			mockGetCommitsSince.mockResolvedValue(["abc123"]);
			mockGetCommitMessage.mockResolvedValue("msg");
			mockGetCommitDiff.mockResolvedValue("diff");
			mockGetDiff.mockResolvedValue("diff");
			mockLoadPrompt.mockResolvedValue("prompt");
			mockSpawnClaude.mockResolvedValue("PHASE_COMPLETE");

			await evaluatePhase(
				mockPhase,
				"main-branch",
				"phase-branch",
				"Brief",
				"Goal",
				"/custom/path",
			);

			expect(mockGetCommitsSince).toHaveBeenCalledWith(
				"main-branch",
				"/custom/path",
			);
			expect(mockGetDiff).toHaveBeenCalledWith(
				"main-branch",
				"phase-branch",
				"/custom/path",
			);
			expect(mockGetCommitMessage).toHaveBeenCalledWith(
				"abc123",
				"/custom/path",
			);
			expect(mockGetCommitDiff).toHaveBeenCalledWith("abc123", "/custom/path");
		});

		test("passes correct parameters to loadPrompt", async () => {
			mockGetCommitsSince.mockResolvedValue(["abc123"]);
			mockGetCommitMessage.mockResolvedValue("Test commit");
			mockGetCommitDiff.mockResolvedValue("commit diff");
			mockGetDiff.mockResolvedValue("phase diff");
			mockLoadPrompt.mockResolvedValue("prompt");
			mockSpawnClaude.mockResolvedValue("PHASE_COMPLETE");

			await evaluatePhase(
				mockPhase,
				"main",
				"phase",
				"Project Brief",
				"Project Goal",
			);

			expect(mockLoadPrompt).toHaveBeenCalledWith("phase-evaluation", {
				phaseName: "Setup",
				stepDescriptions:
					"1. Initialize project\n2. Create files\n3. Run tests",
				commitSummary: "Commit 1: Test commit",
				phaseDiff: "phase diff",
				projectBrief: "Project Brief",
				goal: "Project Goal",
			});
		});

		test("handles multiple commits with proper indexing", async () => {
			mockGetCommitsSince.mockResolvedValue(["aaa", "bbb", "ccc"]);
			mockGetCommitMessage
				.mockResolvedValueOnce("First")
				.mockResolvedValueOnce("Second")
				.mockResolvedValueOnce("Third");
			mockGetCommitDiff.mockResolvedValue("diff");
			mockGetDiff.mockResolvedValue("diff");
			mockLoadPrompt.mockResolvedValue("prompt");
			mockSpawnClaude.mockResolvedValue("PHASE_COMPLETE");

			await evaluatePhase(mockPhase, "main", "phase", "b", "g");

			const promptCall = mockLoadPrompt.mock.calls[0][1];
			expect(promptCall.commitSummary).toBe(
				"Commit 1: First\nCommit 2: Second\nCommit 3: Third",
			);
		});

		test("handles phase with single incomplete step", async () => {
			mockGetCommitsSince.mockResolvedValue(["abc"]);
			mockGetCommitMessage.mockResolvedValue("msg");
			mockGetCommitDiff.mockResolvedValue("diff");
			mockGetDiff.mockResolvedValue("diff");
			mockLoadPrompt.mockResolvedValue("prompt");

			const claudeResponse = `PHASE_INCOMPLETE
Step 1: Initialize project
Feedback: Project initialization is incomplete.`;

			mockSpawnClaude.mockResolvedValue(claudeResponse);

			const result = await evaluatePhase(mockPhase, "main", "phase", "b", "g");

			expect(result.incompleteSteps).toHaveLength(1);
			expect(result.incompleteSteps[0].stepIndex).toBe(0);
		});

		test("logs phase evaluation progress", async () => {
			mockGetCommitsSince.mockResolvedValue(["abc"]);
			mockGetCommitMessage.mockResolvedValue("msg");
			mockGetCommitDiff.mockResolvedValue("diff");
			mockGetDiff.mockResolvedValue("diff");
			mockLoadPrompt.mockResolvedValue("prompt");
			mockSpawnClaude.mockResolvedValue("PHASE_COMPLETE");

			await evaluatePhase(mockPhase, "main", "phase", "b", "g");

			expect(mockLogger.info).toHaveBeenCalledWith(
				"Evaluating phase completion: Setup",
			);
			expect(mockLogger.info).toHaveBeenCalledWith(
				"✓ Phase evaluation: COMPLETE",
			);
		});

		test("logs incomplete steps count", async () => {
			mockGetCommitsSince.mockResolvedValue(["abc"]);
			mockGetCommitMessage.mockResolvedValue("msg");
			mockGetCommitDiff.mockResolvedValue("diff");
			mockGetDiff.mockResolvedValue("diff");
			mockLoadPrompt.mockResolvedValue("prompt");

			const claudeResponse = `PHASE_INCOMPLETE
Step 1: Test
Feedback: Not done

Step 2: Test
Feedback: Not done`;

			mockSpawnClaude.mockResolvedValue(claudeResponse);

			await evaluatePhase(mockPhase, "main", "phase", "b", "g");

			expect(mockLogger.info).toHaveBeenCalledWith(
				"Phase evaluation: INCOMPLETE",
			);
			expect(mockLogger.info).toHaveBeenCalledWith("Incomplete steps: 2");
		});
	});
});
