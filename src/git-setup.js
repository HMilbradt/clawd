import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import logger from "./logger.js";

/**
 * Execute a git command and return the result
 * @param {string[]} args - Git command arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
async function execGit(args, cwd = process.cwd()) {
	return new Promise((resolve) => {
		const git = spawn("git", args, { cwd });

		let stdout = "";
		let stderr = "";

		git.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		git.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		git.on("close", (code) => {
			resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
		});
	});
}

/**
 * Check if the current directory is a git repository
 * @param {string} cwd - Working directory
 * @returns {Promise<boolean>}
 */
export async function isGitRepo(cwd = process.cwd()) {
	const result = await execGit(["rev-parse", "--git-dir"], cwd);
	return result.code === 0;
}

/**
 * Initialize a git repository
 * @param {string} cwd - Working directory
 * @returns {Promise<void>}
 */
export async function initGitRepo(cwd = process.cwd()) {
	logger.info("Initializing git repository...");
	const result = await execGit(["init"], cwd);

	if (result.code !== 0) {
		throw new Error(`Failed to initialize git repository: ${result.stderr}`);
	}

	logger.info("✓ Git repository initialized");
}

/**
 * Create a .gitignore file with basic entries if it doesn't exist
 * @param {string} cwd - Working directory
 * @returns {Promise<void>}
 */
export async function createGitignore(cwd = process.cwd()) {
	const gitignorePath = path.join(cwd, ".gitignore");

	try {
		await fs.access(gitignorePath);
		logger.info(".gitignore already exists");
		return;
	} catch {
		// File doesn't exist, create it
		const defaultGitignore = `# Logs
node_modules/
*.log

# Environment files
.env
.env.local

# OS files
.DS_Store
Thumbs.db
`;

		await fs.writeFile(gitignorePath, defaultGitignore);
		logger.info("✓ Created .gitignore");
	}
}

/**
 * Check if there are any commits in the repository
 * @param {string} cwd - Working directory
 * @returns {Promise<boolean>}
 */
export async function hasCommits(cwd = process.cwd()) {
	const result = await execGit(["rev-list", "--all", "--count"], cwd);
	return result.code === 0 && parseInt(result.stdout) > 0;
}

/**
 * Create an initial commit if the repository is empty
 * @param {string} cwd - Working directory
 * @returns {Promise<void>}
 */
export async function createInitialCommit(cwd = process.cwd()) {
	const hasAnyCommits = await hasCommits(cwd);

	if (hasAnyCommits) {
		logger.info("Repository already has commits");
		return;
	}

	logger.info("Creating initial commit...");

	// Stage .gitignore if it exists
	const gitignorePath = path.join(cwd, ".gitignore");
	try {
		await fs.access(gitignorePath);
		await execGit(["add", ".gitignore"], cwd);
	} catch {
		// .gitignore doesn't exist, that's okay
	}

	// Create initial commit (may be empty)
	const result = await execGit(
		["commit", "--allow-empty", "-m", "chore: initial commit"],
		cwd,
	);

	if (result.code !== 0) {
		throw new Error(`Failed to create initial commit: ${result.stderr}`);
	}

	logger.info("✓ Initial commit created");
}

/**
 * Get the current branch name
 * @param {string} cwd - Working directory
 * @returns {Promise<string>}
 */
export async function getCurrentBranch(cwd = process.cwd()) {
	const result = await execGit(["branch", "--show-current"], cwd);

	if (result.code !== 0) {
		throw new Error(`Failed to get current branch: ${result.stderr}`);
	}

	return result.stdout;
}

/**
 * Create a new branch
 * @param {string} branchName - Name of the branch to create
 * @param {string} cwd - Working directory
 * @returns {Promise<void>}
 */
export async function createBranch(branchName, cwd = process.cwd()) {
	logger.info(`Creating branch: ${branchName}`);
	const result = await execGit(["checkout", "-b", branchName], cwd);

	if (result.code !== 0) {
		throw new Error(`Failed to create branch ${branchName}: ${result.stderr}`);
	}

	logger.info(`✓ Branch ${branchName} created`);
}

/**
 * Switch to an existing branch or create it if it doesn't exist
 * @param {string} branchName - Name of the branch
 * @param {string} cwd - Working directory
 * @returns {Promise<void>}
 */
export async function checkoutBranch(branchName, cwd = process.cwd()) {
	logger.info(`Switching to branch: ${branchName}`);

	// Try to checkout existing branch first
	let result = await execGit(["checkout", branchName], cwd);

	if (result.code !== 0) {
		// Branch doesn't exist, create it
		result = await execGit(["checkout", "-b", branchName], cwd);

		if (result.code !== 0) {
			throw new Error(
				`Failed to checkout/create branch ${branchName}: ${result.stderr}`,
			);
		}
	}

	logger.info(`✓ On branch ${branchName}`);
}

/**
 * Stage all changes
 * @param {string} cwd - Working directory
 * @returns {Promise<void>}
 */
export async function stageAll(cwd = process.cwd()) {
	const result = await execGit(["add", "-A"], cwd);

	if (result.code !== 0) {
		throw new Error(`Failed to stage changes: ${result.stderr}`);
	}
}

/**
 * Commit staged changes
 * @param {string} message - Commit message
 * @param {string} cwd - Working directory
 * @returns {Promise<void>}
 */
export async function commit(message, cwd = process.cwd()) {
	logger.info(`Creating commit: ${message}`);
	const result = await execGit(["commit", "-m", message], cwd);

	if (result.code !== 0) {
		// Check if it's just "nothing to commit"
		if (result.stdout.includes("nothing to commit")) {
			logger.info("No changes to commit");
			return;
		}
		throw new Error(`Failed to commit: ${result.stderr}`);
	}

	logger.info("✓ Commit created");
}

/**
 * Rebase current branch onto target branch
 * @param {string} targetBranch - Branch to rebase onto
 * @param {string} cwd - Working directory
 * @returns {Promise<void>}
 */
export async function rebase(targetBranch, cwd = process.cwd()) {
	logger.info(`Rebasing onto ${targetBranch}...`);
	const result = await execGit(["rebase", targetBranch], cwd);

	if (result.code !== 0) {
		throw new Error(`Failed to rebase onto ${targetBranch}: ${result.stderr}`);
	}

	logger.info(`✓ Rebased onto ${targetBranch}`);
}

/**
 * Merge a branch into the current branch
 * @param {string} branchName - Branch to merge
 * @param {string} cwd - Working directory
 * @returns {Promise<void>}
 */
export async function merge(branchName, cwd = process.cwd()) {
	logger.info(`Merging ${branchName}...`);
	const result = await execGit(["merge", branchName, "--no-ff"], cwd);

	if (result.code !== 0) {
		throw new Error(`Failed to merge ${branchName}: ${result.stderr}`);
	}

	logger.info(`✓ Merged ${branchName}`);
}

/**
 * Get diff between two branches
 * @param {string} baseBranch - Base branch
 * @param {string} compareBranch - Branch to compare
 * @param {string} cwd - Working directory
 * @returns {Promise<string>}
 */
export async function getDiff(baseBranch, compareBranch, cwd = process.cwd()) {
	const result = await execGit(
		["diff", `${baseBranch}...${compareBranch}`],
		cwd,
	);

	if (result.code !== 0) {
		throw new Error(`Failed to get diff: ${result.stderr}`);
	}

	return result.stdout;
}

/**
 * Get the latest commit hash
 * @param {string} cwd - Working directory
 * @returns {Promise<string>}
 */
export async function getLatestCommit(cwd = process.cwd()) {
	const result = await execGit(["rev-parse", "HEAD"], cwd);

	if (result.code !== 0) {
		throw new Error(`Failed to get latest commit: ${result.stderr}`);
	}

	return result.stdout;
}

/**
 * Get diff for a specific commit
 * @param {string} commitHash - Commit hash
 * @param {string} cwd - Working directory
 * @returns {Promise<string>}
 */
export async function getCommitDiff(commitHash, cwd = process.cwd()) {
	const result = await execGit(["show", commitHash], cwd);

	if (result.code !== 0) {
		throw new Error(`Failed to get commit diff: ${result.stderr}`);
	}

	return result.stdout;
}

/**
 * Get list of commits in current branch since branching from base
 * @param {string} baseBranch - Base branch to compare against
 * @param {string} cwd - Working directory
 * @returns {Promise<string[]>} Array of commit hashes
 */
export async function getCommitsSince(baseBranch, cwd = process.cwd()) {
	const result = await execGit(["rev-list", `${baseBranch}..HEAD`], cwd);

	if (result.code !== 0) {
		throw new Error(`Failed to get commits: ${result.stderr}`);
	}

	return result.stdout ? result.stdout.split("\n").filter(Boolean) : [];
}

/**
 * Get commit message for a specific commit
 * @param {string} commitHash - Commit hash
 * @param {string} cwd - Working directory
 * @returns {Promise<string>}
 */
export async function getCommitMessage(commitHash, cwd = process.cwd()) {
	const result = await execGit(["log", "-1", "--pretty=%B", commitHash], cwd);

	if (result.code !== 0) {
		throw new Error(`Failed to get commit message: ${result.stderr}`);
	}

	return result.stdout;
}

/**
 * Set up project git repository (initialize if needed)
 * @param {string} cwd - Working directory
 * @returns {Promise<void>}
 */
export async function setupProjectGit(cwd = process.cwd()) {
	logger.info("Setting up project git repository...");

	// Check if git repo exists
	const isRepo = await isGitRepo(cwd);

	if (!isRepo) {
		// Initialize git repository
		await initGitRepo(cwd);

		// Create .gitignore
		await createGitignore(cwd);

		// Create initial commit
		await createInitialCommit(cwd);
	} else {
		logger.info("Git repository already exists");

		// Ensure there's at least one commit
		const hasAnyCommits = await hasCommits(cwd);
		if (!hasAnyCommits) {
			await createInitialCommit(cwd);
		}
	}

	logger.info("✓ Git setup complete");
}
