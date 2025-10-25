import { jest } from "@jest/globals";
import { spawn } from "child_process";
import { EventEmitter } from "events";

// Mock child_process
jest.unstable_mockModule("child_process", () => ({
	spawn: jest.fn(),
}));

// Mock fs/promises
const mockAccess = jest.fn();
const mockWriteFile = jest.fn();

jest.unstable_mockModule("fs/promises", () => ({
	default: {
		access: mockAccess,
		writeFile: mockWriteFile,
	},
}));

// Mock logger
const mockLogger = {
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
};

jest.unstable_mockModule("./logger.js", () => ({
	default: mockLogger,
}));

const {
	isGitRepo,
	initGitRepo,
	createGitignore,
	hasCommits,
	createInitialCommit,
	getCurrentBranch,
	createBranch,
	checkoutBranch,
	stageAll,
	commit,
	rebase,
	merge,
	getDiff,
	setupProjectGit,
} = await import("./git-setup.js");

// Helper to create mock spawn process
function createMockProcess(stdout = "", stderr = "", exitCode = 0) {
	const process = new EventEmitter();
	process.stdout = new EventEmitter();
	process.stderr = new EventEmitter();

	// Simulate async execution
	setImmediate(() => {
		if (stdout) process.stdout.emit("data", Buffer.from(stdout));
		if (stderr) process.stderr.emit("data", Buffer.from(stderr));
		process.emit("close", exitCode);
	});

	return process;
}

describe("git-setup", () => {
	let spawnMock;

	beforeEach(async () => {
		jest.clearAllMocks();
		// Import the mocked spawn
		const childProcess = await import("child_process");
		spawnMock = childProcess.spawn;
	});

	describe("isGitRepo", () => {
		test("returns true when directory is a git repo", async () => {
			spawnMock.mockReturnValue(createMockProcess(".git", "", 0));

			const result = await isGitRepo();

			expect(result).toBe(true);
			expect(spawnMock).toHaveBeenCalledWith(
				"git",
				["rev-parse", "--git-dir"],
				{ cwd: process.cwd() },
			);
		});

		test("returns false when directory is not a git repo", async () => {
			spawnMock.mockReturnValue(
				createMockProcess("", "not a git repository", 128),
			);

			const result = await isGitRepo();

			expect(result).toBe(false);
		});

		test("accepts custom working directory", async () => {
			spawnMock.mockReturnValue(createMockProcess(".git", "", 0));

			await isGitRepo("/custom/path");

			expect(spawnMock).toHaveBeenCalledWith(
				"git",
				["rev-parse", "--git-dir"],
				{ cwd: "/custom/path" },
			);
		});
	});

	describe("initGitRepo", () => {
		test("initializes git repository successfully", async () => {
			spawnMock.mockReturnValue(
				createMockProcess("Initialized empty Git repository", "", 0),
			);

			await initGitRepo();

			expect(mockLogger.info).toHaveBeenCalledWith(
				"Initializing git repository...",
			);
			expect(spawnMock).toHaveBeenCalledWith("git", ["init"], {
				cwd: process.cwd(),
			});
			expect(mockLogger.info).toHaveBeenCalledWith(
				"✓ Git repository initialized",
			);
		});

		test("throws error when git init fails", async () => {
			spawnMock.mockReturnValue(createMockProcess("", "Permission denied", 1));

			await expect(initGitRepo()).rejects.toThrow(
				"Failed to initialize git repository: Permission denied",
			);
		});
	});

	describe("createGitignore", () => {
		test("skips creation if .gitignore already exists", async () => {
			mockAccess.mockResolvedValue();

			await createGitignore();

			expect(mockLogger.info).toHaveBeenCalledWith(".gitignore already exists");
			expect(mockWriteFile).not.toHaveBeenCalled();
		});

		test("creates .gitignore if it does not exist", async () => {
			mockAccess.mockRejectedValue(new Error("ENOENT"));
			mockWriteFile.mockResolvedValue();

			await createGitignore();

			expect(mockWriteFile).toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith("✓ Created .gitignore");
		});
	});

	describe("hasCommits", () => {
		test("returns true when repository has commits", async () => {
			spawnMock.mockReturnValue(createMockProcess("5", "", 0));

			const result = await hasCommits();

			expect(result).toBe(true);
			expect(spawnMock).toHaveBeenCalledWith(
				"git",
				["rev-list", "--all", "--count"],
				{ cwd: process.cwd() },
			);
		});

		test("returns false when repository has no commits", async () => {
			spawnMock.mockReturnValue(createMockProcess("0", "", 0));

			const result = await hasCommits();

			expect(result).toBe(false);
		});

		test("returns false when command fails", async () => {
			spawnMock.mockReturnValue(
				createMockProcess(
					"",
					"fatal: your current branch does not have any commits",
					128,
				),
			);

			const result = await hasCommits();

			expect(result).toBe(false);
		});
	});

	describe("createInitialCommit", () => {
		test("skips if repository already has commits", async () => {
			spawnMock.mockReturnValue(createMockProcess("5", "", 0));

			await createInitialCommit();

			expect(mockLogger.info).toHaveBeenCalledWith(
				"Repository already has commits",
			);
		});

		test("creates initial commit when repository is empty", async () => {
			// First call: hasCommits returns 0
			// Second call: git add
			// Third call: git commit
			spawnMock
				.mockReturnValueOnce(createMockProcess("0", "", 0))
				.mockReturnValueOnce(createMockProcess("", "", 0))
				.mockReturnValueOnce(
					createMockProcess("[main (root-commit)] initial commit", "", 0),
				);

			mockAccess.mockResolvedValue();

			await createInitialCommit();

			expect(mockLogger.info).toHaveBeenCalledWith(
				"Creating initial commit...",
			);
			expect(mockLogger.info).toHaveBeenCalledWith("✓ Initial commit created");
		});

		test("throws error when commit fails", async () => {
			spawnMock
				.mockReturnValueOnce(createMockProcess("0", "", 0))
				.mockReturnValueOnce(createMockProcess("", "", 0))
				.mockReturnValueOnce(createMockProcess("", "error", 1));

			mockAccess.mockResolvedValue();

			await expect(createInitialCommit()).rejects.toThrow(
				"Failed to create initial commit",
			);
		});
	});

	describe("getCurrentBranch", () => {
		test("returns current branch name", async () => {
			spawnMock.mockReturnValue(createMockProcess("main", "", 0));

			const result = await getCurrentBranch();

			expect(result).toBe("main");
			expect(spawnMock).toHaveBeenCalledWith(
				"git",
				["branch", "--show-current"],
				{ cwd: process.cwd() },
			);
		});

		test("throws error when command fails", async () => {
			spawnMock.mockReturnValue(createMockProcess("", "error", 1));

			await expect(getCurrentBranch()).rejects.toThrow(
				"Failed to get current branch",
			);
		});
	});

	describe("createBranch", () => {
		test("creates a new branch successfully", async () => {
			spawnMock.mockReturnValue(
				createMockProcess("Switched to a new branch", "", 0),
			);

			await createBranch("feature-branch");

			expect(mockLogger.info).toHaveBeenCalledWith(
				"Creating branch: feature-branch",
			);
			expect(spawnMock).toHaveBeenCalledWith(
				"git",
				["checkout", "-b", "feature-branch"],
				{ cwd: process.cwd() },
			);
			expect(mockLogger.info).toHaveBeenCalledWith(
				"✓ Branch feature-branch created",
			);
		});

		test("throws error when branch creation fails", async () => {
			spawnMock.mockReturnValue(
				createMockProcess("", "branch already exists", 128),
			);

			await expect(createBranch("existing-branch")).rejects.toThrow(
				"Failed to create branch existing-branch",
			);
		});
	});

	describe("checkoutBranch", () => {
		test("checks out existing branch", async () => {
			spawnMock.mockReturnValue(
				createMockProcess("Switched to branch main", "", 0),
			);

			await checkoutBranch("main");

			expect(mockLogger.info).toHaveBeenCalledWith("Switching to branch: main");
			expect(spawnMock).toHaveBeenCalledWith("git", ["checkout", "main"], {
				cwd: process.cwd(),
			});
			expect(mockLogger.info).toHaveBeenCalledWith("✓ On branch main");
		});

		test("creates branch if it does not exist", async () => {
			spawnMock
				.mockReturnValueOnce(createMockProcess("", "branch not found", 1))
				.mockReturnValueOnce(
					createMockProcess("Switched to a new branch", "", 0),
				);

			await checkoutBranch("new-branch");

			expect(spawnMock).toHaveBeenNthCalledWith(
				1,
				"git",
				["checkout", "new-branch"],
				{ cwd: process.cwd() },
			);
			expect(spawnMock).toHaveBeenNthCalledWith(
				2,
				"git",
				["checkout", "-b", "new-branch"],
				{ cwd: process.cwd() },
			);
		});
	});

	describe("stageAll", () => {
		test("stages all changes successfully", async () => {
			spawnMock.mockReturnValue(createMockProcess("", "", 0));

			await stageAll();

			expect(spawnMock).toHaveBeenCalledWith("git", ["add", "-A"], {
				cwd: process.cwd(),
			});
		});

		test("throws error when staging fails", async () => {
			spawnMock.mockReturnValue(createMockProcess("", "error", 1));

			await expect(stageAll()).rejects.toThrow("Failed to stage changes");
		});
	});

	describe("commit", () => {
		test("creates commit successfully", async () => {
			spawnMock.mockReturnValue(
				createMockProcess("[main abc123] test commit", "", 0),
			);

			await commit("test commit");

			expect(mockLogger.info).toHaveBeenCalledWith(
				"Creating commit: test commit",
			);
			expect(spawnMock).toHaveBeenCalledWith(
				"git",
				["commit", "-m", "test commit"],
				{ cwd: process.cwd() },
			);
			expect(mockLogger.info).toHaveBeenCalledWith("✓ Commit created");
		});

		test("handles nothing to commit gracefully", async () => {
			spawnMock.mockReturnValue(
				createMockProcess("nothing to commit, working tree clean", "", 1),
			);

			await commit("test commit");

			expect(mockLogger.info).toHaveBeenCalledWith("No changes to commit");
		});

		test("throws error for other commit failures", async () => {
			spawnMock.mockReturnValue(
				createMockProcess("", "error: pathspec did not match", 1),
			);

			await expect(commit("test commit")).rejects.toThrow("Failed to commit");
		});
	});

	describe("merge", () => {
		test("merges branch successfully", async () => {
			spawnMock.mockReturnValue(createMockProcess("Merge made", "", 0));

			await merge("feature-branch");

			expect(mockLogger.info).toHaveBeenCalledWith("Merging feature-branch...");
			expect(spawnMock).toHaveBeenCalledWith(
				"git",
				["merge", "feature-branch", "--no-ff"],
				{ cwd: process.cwd() },
			);
			expect(mockLogger.info).toHaveBeenCalledWith("✓ Merged feature-branch");
		});

		test("throws error when merge fails", async () => {
			spawnMock.mockReturnValue(createMockProcess("", "CONFLICT", 1));

			await expect(merge("feature-branch")).rejects.toThrow(
				"Failed to merge feature-branch",
			);
		});
	});

	describe("getDiff", () => {
		test("returns diff between branches", async () => {
			const mockDiff = "diff --git a/file.js b/file.js\n+added line";
			spawnMock.mockReturnValue(createMockProcess(mockDiff, "", 0));

			const result = await getDiff("main", "feature");

			expect(result).toBe(mockDiff);
			expect(spawnMock).toHaveBeenCalledWith(
				"git",
				["diff", "main...feature"],
				{ cwd: process.cwd() },
			);
		});

		test("throws error when diff fails", async () => {
			spawnMock.mockReturnValue(createMockProcess("", "error", 1));

			await expect(getDiff("main", "feature")).rejects.toThrow(
				"Failed to get diff",
			);
		});
	});

	describe("setupProjectGit", () => {
		test("initializes repo when it does not exist", async () => {
			// isGitRepo: false
			// initGitRepo
			// createGitignore (doesn't exist)
			// createInitialCommit (no commits)
			spawnMock
				.mockReturnValueOnce(createMockProcess("", "not a git repo", 128)) // isGitRepo
				.mockReturnValueOnce(createMockProcess("Initialized", "", 0)) // initGitRepo
				.mockReturnValueOnce(createMockProcess("0", "", 0)) // hasCommits
				.mockReturnValueOnce(createMockProcess("", "", 0)) // git add
				.mockReturnValueOnce(createMockProcess("[main] initial", "", 0)); // git commit

			mockAccess.mockRejectedValueOnce(new Error("ENOENT")); // .gitignore doesn't exist
			mockAccess.mockResolvedValueOnce(); // .gitignore exists for commit
			mockWriteFile.mockResolvedValue();

			await setupProjectGit();

			expect(mockLogger.info).toHaveBeenCalledWith(
				"Setting up project git repository...",
			);
			expect(mockLogger.info).toHaveBeenCalledWith("✓ Git setup complete");
		});

		test("skips initialization when repo exists with commits", async () => {
			spawnMock
				.mockReturnValueOnce(createMockProcess(".git", "", 0)) // isGitRepo
				.mockReturnValueOnce(createMockProcess("10", "", 0)); // hasCommits

			await setupProjectGit();

			expect(mockLogger.info).toHaveBeenCalledWith(
				"Git repository already exists",
			);
			expect(mockLogger.info).toHaveBeenCalledWith("✓ Git setup complete");
		});
	});
});
