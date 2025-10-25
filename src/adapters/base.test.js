import { describe, it, expect } from "vitest";
import { LLMAdapter } from "./base.js";

describe("LLMAdapter", () => {
	describe("constructor", () => {
		it("should create an instance with empty config by default", () => {
			const adapter = new LLMAdapter();
			expect(adapter.config).toEqual({});
		});

		it("should store provided config", () => {
			const config = { apiKey: "test-key", model: "test-model" };
			const adapter = new LLMAdapter(config);
			expect(adapter.config).toEqual(config);
		});
	});

	describe("execute", () => {
		it("should throw error when not implemented", async () => {
			const adapter = new LLMAdapter();
			await expect(adapter.execute("test prompt")).rejects.toThrow(
				"execute() must be implemented by adapter",
			);
		});

		it("should throw error with captureOutput parameter", async () => {
			const adapter = new LLMAdapter();
			await expect(adapter.execute("test prompt", true)).rejects.toThrow(
				"execute() must be implemented by adapter",
			);
		});

		it("should throw error with captureOutput false", async () => {
			const adapter = new LLMAdapter();
			await expect(adapter.execute("test prompt", false)).rejects.toThrow(
				"execute() must be implemented by adapter",
			);
		});
	});

	describe("executeWithTUI", () => {
		it("should throw error when not implemented", async () => {
			const adapter = new LLMAdapter();
			const mockTUI = {};
			await expect(
				adapter.executeWithTUI("test prompt", mockTUI),
			).rejects.toThrow("executeWithTUI() must be implemented by adapter");
		});
	});

	describe("getName", () => {
		it("should return the constructor name", () => {
			const adapter = new LLMAdapter();
			expect(adapter.getName()).toBe("LLMAdapter");
		});

		it("should return custom class name when extended", () => {
			class CustomAdapter extends LLMAdapter {}
			const adapter = new CustomAdapter();
			expect(adapter.getName()).toBe("CustomAdapter");
		});
	});

	describe("validate", () => {
		it("should return true by default", () => {
			const adapter = new LLMAdapter();
			expect(adapter.validate()).toBe(true);
		});

		it("should be overridable in subclasses", () => {
			class CustomAdapter extends LLMAdapter {
				validate() {
					return false;
				}
			}
			const adapter = new CustomAdapter();
			expect(adapter.validate()).toBe(false);
		});
	});

	describe("inheritance", () => {
		it("should allow subclasses to implement execute", async () => {
			class CustomAdapter extends LLMAdapter {
				async execute(prompt, _captureOutput = true) {
					return `Response to: ${prompt}`;
				}
			}
			const adapter = new CustomAdapter();
			const result = await adapter.execute("test");
			expect(result).toBe("Response to: test");
		});

		it("should allow subclasses to implement executeWithTUI", async () => {
			class CustomAdapter extends LLMAdapter {
				async executeWithTUI(_prompt, _tui) {
					return { exitCode: 0, output: "success" };
				}
			}
			const adapter = new CustomAdapter();
			const result = await adapter.executeWithTUI("test", {});
			expect(result).toEqual({ exitCode: 0, output: "success" });
		});

		it("should pass config to subclass", () => {
			class CustomAdapter extends LLMAdapter {}
			const config = { test: "value" };
			const adapter = new CustomAdapter(config);
			expect(adapter.config).toEqual(config);
		});
	});
});
