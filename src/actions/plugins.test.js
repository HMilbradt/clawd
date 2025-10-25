import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock fs/promises
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockAccess = vi.fn().mockResolvedValue(undefined);
const mockRm = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn().mockResolvedValue(undefined);

vi.mock("node:fs/promises", () => ({
	default: {
		mkdir: mockMkdir,
		access: mockAccess,
		rm: mockRm,
		readFile: mockReadFile,
		writeFile: mockWriteFile,
	},
}));

// Mock chalk
const mockChalk = {
	yellow: vi.fn((text) => text),
	bold: { blue: vi.fn((text) => text) },
	cyan: vi.fn((text) => text),
	white: vi.fn((text) => text),
	green: vi.fn((text) => text),
	red: vi.fn((text) => text),
};

vi.mock("chalk", () => ({
	default: mockChalk,
}));

// Mock plugin-system/loader
const mockListPlugins = vi.fn();

vi.mock("../plugin-system/loader.js", () => ({
	listPlugins: mockListPlugins,
}));

describe("Plugin Actions", () => {
	let listPluginsAction;
	let createPluginAction;
	let chalk;
	let originalConsoleLog;
	let originalConsoleError;
	let originalProcessExit;
	let consoleLogOutput;
	let consoleErrorOutput;
	let processExitCode;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Reset mock implementations
		mockMkdir.mockResolvedValue(undefined);
		mockAccess.mockResolvedValue(undefined);
		mockRm.mockResolvedValue(undefined);
		mockReadFile.mockResolvedValue(
			"export default { name: '{{PLUGIN_NAME}}' }",
		);
		mockWriteFile.mockResolvedValue(undefined);

		// Import modules
		chalk = (await import("chalk")).default;
		({ listPluginsAction, createPluginAction } = await import("./plugins.js"));

		// Mock console methods
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
	});

	afterEach(() => {
		console.log = originalConsoleLog;
		console.error = originalConsoleError;
		process.exit = originalProcessExit;
	});

	describe("listPluginsAction", () => {
		test("should display message when no plugins are loaded", () => {
			mockListPlugins.mockReturnValue({});

			listPluginsAction();

			expect(mockListPlugins).toHaveBeenCalledTimes(1);
			expect(consoleLogOutput).toContain("\nNo plugins loaded\n");
			expect(chalk.yellow).toHaveBeenCalledWith("\nNo plugins loaded\n");
		});

		test("should list plugins grouped by hooks", () => {
			mockListPlugins.mockReturnValue({
				"pre:plan": ["logger-plugin", "validator-plugin"],
				"post:exec": ["notifier-plugin"],
			});

			listPluginsAction();

			expect(mockListPlugins).toHaveBeenCalledTimes(1);
			expect(consoleLogOutput).toContain("\n🔌 Loaded Plugins:\n");
			expect(consoleLogOutput).toContain("  pre:plan:");
			expect(consoleLogOutput).toContain("    • logger-plugin");
			expect(consoleLogOutput).toContain("    • validator-plugin");
			expect(consoleLogOutput).toContain("  post:exec:");
			expect(consoleLogOutput).toContain("    • notifier-plugin");

			expect(chalk.bold.blue).toHaveBeenCalledWith("\n🔌 Loaded Plugins:\n");
			expect(chalk.cyan).toHaveBeenCalledWith("  pre:plan:");
			expect(chalk.cyan).toHaveBeenCalledWith("  post:exec:");
			expect(chalk.white).toHaveBeenCalledWith("    • logger-plugin");
			expect(chalk.white).toHaveBeenCalledWith("    • validator-plugin");
			expect(chalk.white).toHaveBeenCalledWith("    • notifier-plugin");
		});

		test("should handle single plugin", () => {
			mockListPlugins.mockReturnValue({
				"pre:plan": ["single-plugin"],
			});

			listPluginsAction();

			expect(consoleLogOutput).toContain("\n🔌 Loaded Plugins:\n");
			expect(consoleLogOutput).toContain("  pre:plan:");
			expect(consoleLogOutput).toContain("    • single-plugin");
		});

		test("should print empty line at the end", () => {
			mockListPlugins.mockReturnValue({
				"pre:plan": ["test-plugin"],
			});

			listPluginsAction();

			expect(console.log).toHaveBeenCalledWith();
		});
	});

	describe("createPluginAction", () => {
		test("should create plugin from template", async () => {
			const testDir = path.join(process.cwd(), "test-create-plugin");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				const pluginName = "test-plugin";
				const templateContent =
					"export default { name: '{{PLUGIN_NAME}}', hooks: { 'pre:plan': () => console.log('[{{PLUGIN_NAME}}]') } }";
				mockReadFile.mockResolvedValue(templateContent);

				await createPluginAction(pluginName);

				// Verify plugin file path
				const pluginPath = path.join(
					testDir,
					".clawd",
					"plugins",
					`${pluginName}.js`,
				);

				// Verify writeFile was called with replaced content
				expect(mockWriteFile).toHaveBeenCalled();
				const writtenContent = mockWriteFile.mock.calls[0][1];
				expect(writtenContent).toContain(`name: '${pluginName}'`);
				expect(writtenContent).toContain(`[${pluginName}]`);
				expect(writtenContent).not.toContain("{{PLUGIN_NAME}}");

				// Verify success messages
				expect(consoleLogOutput).toContain(
					`\n✓ Created plugin: ${pluginPath}\n`,
				);
				expect(consoleLogOutput).toContain(
					"Edit the file to customize hook behavior.\n",
				);

				expect(chalk.green).toHaveBeenCalledWith(
					`\n✓ Created plugin: ${pluginPath}\n`,
				);
				expect(chalk.white).toHaveBeenCalledWith(
					"Edit the file to customize hook behavior.\n",
				);
			} finally {
				process.cwd = originalCwd;
			}
		});

		test("should create .clawd/plugins directory if it does not exist", async () => {
			const testDir = path.join(process.cwd(), "test-create-plugin-nodir");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				const pluginName = "new-plugin";
				const pluginsDir = path.join(testDir, ".clawd", "plugins");

				await createPluginAction(pluginName);

				// Verify mkdir was called to create directory
				expect(mockMkdir).toHaveBeenCalledWith(pluginsDir, { recursive: true });
			} finally {
				process.cwd = originalCwd;
			}
		});

		test("should replace all occurrences of {{PLUGIN_NAME}}", async () => {
			const testDir = path.join(process.cwd(), "test-create-plugin-replace");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				const pluginName = "my-awesome-plugin";
				// Template with multiple occurrences
				const templateContent = `export default {
					name: '{{PLUGIN_NAME}}',
					hooks: {
						'pre:plan': () => console.log('[{{PLUGIN_NAME}}] Starting'),
						'post:plan': () => console.log('[{{PLUGIN_NAME}}] Done'),
						'pre:exec': () => console.log('[{{PLUGIN_NAME}}] Executing'),
						'post:exec': () => console.log('[{{PLUGIN_NAME}}] Complete'),
						'pre:eval': () => console.log('[{{PLUGIN_NAME}}] Evaluating'),
						'post:eval': () => console.log('[{{PLUGIN_NAME}}] Evaluated')
					}
				}`;
				mockReadFile.mockResolvedValue(templateContent);

				await createPluginAction(pluginName);

				const content = mockWriteFile.mock.calls[0][1];

				// Count occurrences - should have multiple replacements
				const occurrences = (content.match(/my-awesome-plugin/g) || []).length;
				expect(occurrences).toBeGreaterThan(5);

				// Should have no template placeholders left
				expect(content).not.toContain("{{PLUGIN_NAME}}");
			} finally {
				process.cwd = originalCwd;
			}
		});

		test("should handle errors and exit with code 1", async () => {
			mockReadFile.mockRejectedValue(new Error("Template not found"));

			const testDir = path.join(process.cwd(), "test-create-plugin-error");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				await expect(createPluginAction("test-plugin")).rejects.toThrow(
					"Process exited with code 1",
				);

				expect(consoleErrorOutput.length).toBeGreaterThan(0);
				expect(consoleErrorOutput[0]).toContain("✗ Error: Template not found");

				expect(chalk.red).toHaveBeenCalledWith(
					"\n✗ Error: Template not found\n",
				);
				expect(processExitCode).toBe(1);
			} finally {
				process.cwd = originalCwd;
			}
		});

		test("should handle file write errors", async () => {
			mockWriteFile.mockRejectedValue(new Error("Permission denied"));

			const testDir = path.join(
				process.cwd(),
				"test-create-plugin-write-error",
			);
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				await expect(createPluginAction("test-plugin")).rejects.toThrow(
					"Process exited with code 1",
				);

				expect(consoleErrorOutput[0]).toContain("✗ Error: Permission denied");
				expect(chalk.red).toHaveBeenCalledWith(
					"\n✗ Error: Permission denied\n",
				);
				expect(processExitCode).toBe(1);
			} finally {
				process.cwd = originalCwd;
			}
		});

		test("should create plugin with correct file extension", async () => {
			const testDir = path.join(process.cwd(), "test-create-plugin-ext");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				const pluginName = "test-plugin";

				await createPluginAction(pluginName);

				const pluginPath = path.join(
					testDir,
					".clawd",
					"plugins",
					`${pluginName}.js`,
				);

				// Verify writeFile was called with .js extension
				expect(mockWriteFile).toHaveBeenCalled();
				expect(mockWriteFile.mock.calls[0][0]).toBe(pluginPath);
				expect(pluginPath).toMatch(/\.js$/);
			} finally {
				process.cwd = originalCwd;
			}
		});

		test("should create valid JavaScript file", async () => {
			const testDir = path.join(process.cwd(), "test-create-plugin-valid");
			const originalCwd = process.cwd;
			process.cwd = vi.fn(() => testDir);

			try {
				const pluginName = "valid-plugin";
				const templateContent =
					"export default { name: '{{PLUGIN_NAME}}', hooks: {} }";
				mockReadFile.mockResolvedValue(templateContent);

				await createPluginAction(pluginName);

				const content = mockWriteFile.mock.calls[0][1];

				// Should be valid JS with export default
				expect(content).toContain("export default");
				expect(content).toContain("name:");
				expect(content).toContain("hooks:");
			} finally {
				process.cwd = originalCwd;
			}
		});
	});
});
