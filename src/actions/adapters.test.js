import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import { showAdapterAction, createAdapterAction } from "./adapters.js";
import * as adapterLoader from "../adapters/loader.js";

// Mock dependencies
vi.mock("node:fs/promises");
vi.mock("../adapters/loader.js");

describe("adapters actions", () => {
	let consoleLogSpy;
	let consoleErrorSpy;
	let processExitSpy;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});
		vi.clearAllMocks();
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		processExitSpy.mockRestore();
	});

	describe("showAdapterAction", () => {
		it("should display the current adapter name", () => {
			const mockAdapter = {
				getName: vi.fn().mockReturnValue("Claude Code"),
			};
			vi.mocked(adapterLoader.getAdapter).mockReturnValue(mockAdapter);

			showAdapterAction();

			expect(adapterLoader.getAdapter).toHaveBeenCalled();
			expect(mockAdapter.getName).toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Current Adapter"),
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Claude Code"),
			);
		});

		it("should call getAdapter exactly once", () => {
			const mockAdapter = {
				getName: vi.fn().mockReturnValue("Custom Adapter"),
			};
			vi.mocked(adapterLoader.getAdapter).mockReturnValue(mockAdapter);

			showAdapterAction();

			expect(adapterLoader.getAdapter).toHaveBeenCalledTimes(1);
		});
	});

	describe("createAdapterAction", () => {
		const adapterName = "TestAdapter";
		const templateContent = "export default class {{ADAPTER_NAME}}Adapter {}";
		const expectedContent = "export default class TestAdapterAdapter {}";

		beforeEach(() => {
			vi.spyOn(process, "cwd").mockReturnValue("/mock/project");
		});

		it("should create a new adapter from template", async () => {
			vi.mocked(fs.readFile).mockResolvedValue(templateContent);
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await createAdapterAction(adapterName);

			// Verify template was read
			expect(fs.readFile).toHaveBeenCalledWith(
				expect.stringContaining("adapter-template.js"),
				"utf-8",
			);

			// Verify .clawd directory was created
			expect(fs.mkdir).toHaveBeenCalledWith("/mock/project/.clawd", {
				recursive: true,
			});

			// Verify adapter file was written with replaced content
			expect(fs.writeFile).toHaveBeenCalledWith(
				"/mock/project/.clawd/TestAdapter.js",
				expectedContent,
			);

			// Verify success message
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Created adapter"),
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("TestAdapter.js"),
			);
		});

		it("should replace all occurrences of {{ADAPTER_NAME}}", async () => {
			const multiPlaceholderTemplate =
				"class {{ADAPTER_NAME}} extends {{ADAPTER_NAME}}Base {}";
			const expectedMultiReplacement =
				"class TestAdapter extends TestAdapterBase {}";

			vi.mocked(fs.readFile).mockResolvedValue(multiPlaceholderTemplate);
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await createAdapterAction(adapterName);

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.any(String),
				expectedMultiReplacement,
			);
		});

		it("should create .clawd directory if it doesn't exist", async () => {
			vi.mocked(fs.readFile).mockResolvedValue(templateContent);
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await createAdapterAction(adapterName);

			expect(fs.mkdir).toHaveBeenCalledWith("/mock/project/.clawd", {
				recursive: true,
			});
		});

		it("should display usage instructions after creation", async () => {
			vi.mocked(fs.readFile).mockResolvedValue(templateContent);
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await createAdapterAction(adapterName);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Edit the file to customize"),
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("rename it to 'adapter.js'"),
			);
		});

		it("should handle errors when reading template fails", async () => {
			const error = new Error("Template not found");
			vi.mocked(fs.readFile).mockRejectedValue(error);

			await createAdapterAction(adapterName);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Error: Template not found"),
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);
		});

		it("should handle errors when creating directory fails", async () => {
			const error = new Error("Permission denied");
			vi.mocked(fs.readFile).mockResolvedValue(templateContent);
			vi.mocked(fs.mkdir).mockRejectedValue(error);

			await createAdapterAction(adapterName);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Error: Permission denied"),
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);
		});

		it("should handle errors when writing file fails", async () => {
			const error = new Error("Disk full");
			vi.mocked(fs.readFile).mockResolvedValue(templateContent);
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockRejectedValue(error);

			await createAdapterAction(adapterName);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Error: Disk full"),
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);
		});

		it("should construct correct template path", async () => {
			vi.mocked(fs.readFile).mockResolvedValue(templateContent);
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await createAdapterAction(adapterName);

			const readFileCall = vi.mocked(fs.readFile).mock.calls[0][0];
			expect(readFileCall).toContain("templates");
			expect(readFileCall).toContain("adapter-template.js");
		});

		it("should create adapter file with correct name", async () => {
			vi.mocked(fs.readFile).mockResolvedValue(templateContent);
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await createAdapterAction("MyCustomAdapter");

			expect(fs.writeFile).toHaveBeenCalledWith(
				"/mock/project/.clawd/MyCustomAdapter.js",
				expect.any(String),
			);
		});

		it("should handle special characters in adapter name", async () => {
			const specialName = "My-Custom_Adapter123";
			vi.mocked(fs.readFile).mockResolvedValue(templateContent);
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await createAdapterAction(specialName);

			expect(fs.writeFile).toHaveBeenCalledWith(
				"/mock/project/.clawd/My-Custom_Adapter123.js",
				expect.any(String),
			);
		});
	});
});
