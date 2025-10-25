import { describe, it, expect, vi, beforeEach } from "vitest";
import hookManager from "./hooks.js";
import logger from "../core/logger.js";

vi.mock("../core/logger.js", () => ({
	default: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}));

describe("HookManager", () => {
	beforeEach(() => {
		// Clear all hooks before each test
		hookManager.clear();
		vi.clearAllMocks();
	});

	describe("register", () => {
		it("should register a hook with valid hook name", () => {
			const hookFn = vi.fn();
			const pluginName = "test-plugin";

			hookManager.register("pre:plan", hookFn, pluginName);

			expect(hookManager.count("pre:plan")).toBe(1);
			expect(logger.debug).toHaveBeenCalledWith(
				"Registered pre:plan hook from plugin: test-plugin",
			);
		});

		it("should throw error for invalid hook name", () => {
			const hookFn = vi.fn();

			expect(() => {
				hookManager.register("invalid:hook", hookFn, "test-plugin");
			}).toThrow(
				"Invalid hook name: invalid:hook. Valid hooks: pre:plan, post:plan, pre:exec, post:exec, pre:eval, post:eval, pre:complete, post:complete",
			);
		});

		it("should throw error if hook function is not a function", () => {
			expect(() => {
				hookManager.register("pre:plan", "not-a-function", "test-plugin");
			}).toThrow("Hook function must be a function, got string");

			expect(() => {
				hookManager.register("pre:plan", null, "test-plugin");
			}).toThrow("Hook function must be a function, got object");

			expect(() => {
				hookManager.register("pre:plan", undefined, "test-plugin");
			}).toThrow("Hook function must be a function, got undefined");
		});

		it("should register multiple hooks for the same hook point", () => {
			const hookFn1 = vi.fn();
			const hookFn2 = vi.fn();

			hookManager.register("pre:exec", hookFn1, "plugin-1");
			hookManager.register("pre:exec", hookFn2, "plugin-2");

			expect(hookManager.count("pre:exec")).toBe(2);
		});

		it("should register hooks for different hook points", () => {
			const hookFn1 = vi.fn();
			const hookFn2 = vi.fn();

			hookManager.register("pre:plan", hookFn1, "plugin-1");
			hookManager.register("post:plan", hookFn2, "plugin-2");

			expect(hookManager.count("pre:plan")).toBe(1);
			expect(hookManager.count("post:plan")).toBe(1);
		});

		it("should register all valid hook types", () => {
			const hookFn = vi.fn();
			const validHooks = [
				"pre:plan",
				"post:plan",
				"pre:exec",
				"post:exec",
				"pre:eval",
				"post:eval",
				"pre:complete",
				"post:complete",
			];

			validHooks.forEach((hookName) => {
				expect(() => {
					hookManager.register(hookName, hookFn, "test-plugin");
				}).not.toThrow();
			});
		});
	});

	describe("execute", () => {
		it("should return context unchanged when no hooks registered", async () => {
			const context = { foo: "bar" };

			const result = await hookManager.execute("pre:plan", context);

			expect(result).toEqual(context);
		});

		it("should execute a single hook and return modified context", async () => {
			const hookFn = vi.fn(async (ctx) => ({
				...ctx,
				modified: true,
			}));

			hookManager.register("pre:plan", hookFn, "test-plugin");

			const context = { foo: "bar" };
			const result = await hookManager.execute("pre:plan", context);

			expect(hookFn).toHaveBeenCalledWith(context);
			expect(result).toEqual({ foo: "bar", modified: true });
			expect(logger.debug).toHaveBeenCalledWith(
				"Executing 1 hook(s) for pre:plan",
			);
		});

		it("should execute multiple hooks in order", async () => {
			const executionOrder = [];

			const hookFn1 = vi.fn(async (ctx) => {
				executionOrder.push(1);
				return { ...ctx, step1: true };
			});

			const hookFn2 = vi.fn(async (ctx) => {
				executionOrder.push(2);
				return { ...ctx, step2: true };
			});

			const hookFn3 = vi.fn(async (ctx) => {
				executionOrder.push(3);
				return { ...ctx, step3: true };
			});

			hookManager.register("pre:exec", hookFn1, "plugin-1");
			hookManager.register("pre:exec", hookFn2, "plugin-2");
			hookManager.register("pre:exec", hookFn3, "plugin-3");

			const context = { initial: true };
			const result = await hookManager.execute("pre:exec", context);

			expect(executionOrder).toEqual([1, 2, 3]);
			expect(result).toEqual({
				initial: true,
				step1: true,
				step2: true,
				step3: true,
			});
		});

		it("should pass modified context through the chain", async () => {
			const hookFn1 = vi.fn(async (ctx) => ({
				...ctx,
				count: (ctx.count || 0) + 1,
			}));

			const hookFn2 = vi.fn(async (ctx) => ({
				...ctx,
				count: ctx.count + 10,
			}));

			hookManager.register("pre:eval", hookFn1, "plugin-1");
			hookManager.register("pre:eval", hookFn2, "plugin-2");

			const result = await hookManager.execute("pre:eval", { count: 0 });

			expect(result.count).toBe(11); // 0 + 1 + 10
		});

		it("should handle async hooks properly", async () => {
			const hookFn = vi.fn(async (ctx) => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return { ...ctx, async: true };
			});

			hookManager.register("post:complete", hookFn, "test-plugin");

			const result = await hookManager.execute("post:complete", {});

			expect(result).toEqual({ async: true });
		});

		it("should continue with previous context if hook returns non-object", async () => {
			const hookFn1 = vi.fn(async (ctx) => ({ ...ctx, step1: true }));
			const hookFn2 = vi.fn(async () => null); // Invalid return
			const hookFn3 = vi.fn(async (ctx) => ({ ...ctx, step3: true }));

			hookManager.register("pre:plan", hookFn1, "plugin-1");
			hookManager.register("pre:plan", hookFn2, "plugin-2");
			hookManager.register("pre:plan", hookFn3, "plugin-3");

			const result = await hookManager.execute("pre:plan", {});

			expect(result).toEqual({ step1: true, step3: true });
			expect(logger.warn).toHaveBeenCalledWith(
				"Hook pre:plan from plugin-2 did not return an object, using previous context",
			);
		});

		it("should warn when hook returns string instead of object", async () => {
			const hookFn = vi.fn(async () => "string return");

			hookManager.register("pre:exec", hookFn, "bad-plugin");

			const context = { foo: "bar" };
			const result = await hookManager.execute("pre:exec", context);

			expect(result).toEqual(context);
			expect(logger.warn).toHaveBeenCalledWith(
				"Hook pre:exec from bad-plugin did not return an object, using previous context",
			);
		});

		it("should warn when hook returns undefined", async () => {
			const hookFn = vi.fn(async () => undefined);

			hookManager.register("post:eval", hookFn, "undefined-plugin");

			const context = { test: true };
			const result = await hookManager.execute("post:eval", context);

			expect(result).toEqual(context);
			expect(logger.warn).toHaveBeenCalled();
		});

		it("should continue executing remaining hooks when one hook throws error", async () => {
			const hookFn1 = vi.fn(async (ctx) => ({ ...ctx, step1: true }));
			const hookFn2 = vi.fn(async () => {
				throw new Error("Hook failed");
			});
			const hookFn3 = vi.fn(async (ctx) => ({ ...ctx, step3: true }));

			hookManager.register("post:exec", hookFn1, "plugin-1");
			hookManager.register("post:exec", hookFn2, "plugin-2");
			hookManager.register("post:exec", hookFn3, "plugin-3");

			const result = await hookManager.execute("post:exec", {});

			expect(hookFn1).toHaveBeenCalled();
			expect(hookFn2).toHaveBeenCalled();
			expect(hookFn3).toHaveBeenCalled();
			expect(result).toEqual({ step1: true, step3: true });
			expect(logger.error).toHaveBeenCalledWith(
				"Error executing post:exec hook from plugin-2: Hook failed",
			);
		});

		it("should handle multiple errors in different hooks", async () => {
			const hookFn1 = vi.fn(async () => {
				throw new Error("Error 1");
			});
			const hookFn2 = vi.fn(async (ctx) => ({ ...ctx, step2: true }));
			const hookFn3 = vi.fn(async () => {
				throw new Error("Error 2");
			});

			hookManager.register("pre:complete", hookFn1, "plugin-1");
			hookManager.register("pre:complete", hookFn2, "plugin-2");
			hookManager.register("pre:complete", hookFn3, "plugin-3");

			const result = await hookManager.execute("pre:complete", {});

			expect(result).toEqual({ step2: true });
			expect(logger.error).toHaveBeenCalledTimes(2);
		});
	});

	describe("count", () => {
		it("should return 0 for hook with no registered hooks", () => {
			expect(hookManager.count("pre:plan")).toBe(0);
		});

		it("should return correct count for hook with registered hooks", () => {
			hookManager.register("post:plan", vi.fn(), "plugin-1");
			hookManager.register("post:plan", vi.fn(), "plugin-2");
			hookManager.register("post:plan", vi.fn(), "plugin-3");

			expect(hookManager.count("post:plan")).toBe(3);
		});

		it("should return different counts for different hooks", () => {
			hookManager.register("pre:exec", vi.fn(), "plugin-1");
			hookManager.register("post:exec", vi.fn(), "plugin-2");
			hookManager.register("post:exec", vi.fn(), "plugin-3");

			expect(hookManager.count("pre:exec")).toBe(1);
			expect(hookManager.count("post:exec")).toBe(2);
		});
	});

	describe("clear", () => {
		it("should clear all registered hooks", () => {
			hookManager.register("pre:plan", vi.fn(), "plugin-1");
			hookManager.register("post:plan", vi.fn(), "plugin-2");
			hookManager.register("pre:exec", vi.fn(), "plugin-3");

			expect(hookManager.count("pre:plan")).toBe(1);
			expect(hookManager.count("post:plan")).toBe(1);
			expect(hookManager.count("pre:exec")).toBe(1);

			hookManager.clear();

			expect(hookManager.count("pre:plan")).toBe(0);
			expect(hookManager.count("post:plan")).toBe(0);
			expect(hookManager.count("pre:exec")).toBe(0);
		});

		it("should allow registration after clearing", () => {
			hookManager.register("pre:eval", vi.fn(), "plugin-1");
			hookManager.clear();
			hookManager.register("pre:eval", vi.fn(), "plugin-2");

			expect(hookManager.count("pre:eval")).toBe(1);
		});
	});

	describe("getAll", () => {
		it("should return empty object when no hooks registered", () => {
			expect(hookManager.getAll()).toEqual({});
		});

		it("should return all registered hooks with plugin names", () => {
			hookManager.register("pre:plan", vi.fn(), "plugin-1");
			hookManager.register("pre:plan", vi.fn(), "plugin-2");
			hookManager.register("post:exec", vi.fn(), "plugin-3");

			const result = hookManager.getAll();

			expect(result).toEqual({
				"pre:plan": ["plugin-1", "plugin-2"],
				"post:exec": ["plugin-3"],
			});
		});

		it("should return all hooks across multiple hook points", () => {
			hookManager.register("pre:plan", vi.fn(), "plugin-1");
			hookManager.register("post:plan", vi.fn(), "plugin-2");
			hookManager.register("pre:exec", vi.fn(), "plugin-3");
			hookManager.register("post:exec", vi.fn(), "plugin-4");

			const result = hookManager.getAll();

			expect(result).toEqual({
				"pre:plan": ["plugin-1"],
				"post:plan": ["plugin-2"],
				"pre:exec": ["plugin-3"],
				"post:exec": ["plugin-4"],
			});
		});

		it("should preserve order of plugin registration", () => {
			hookManager.register("pre:complete", vi.fn(), "first");
			hookManager.register("pre:complete", vi.fn(), "second");
			hookManager.register("pre:complete", vi.fn(), "third");

			const result = hookManager.getAll();

			expect(result["pre:complete"]).toEqual(["first", "second", "third"]);
		});
	});

	describe("singleton instance", () => {
		it("should maintain state across multiple imports", () => {
			hookManager.register("pre:plan", vi.fn(), "test-plugin");

			// The same instance should be used
			expect(hookManager.count("pre:plan")).toBe(1);
		});
	});

	describe("edge cases", () => {
		it("should handle context being replaced completely", async () => {
			const hookFn = vi.fn(async () => ({
				completely: "different",
				context: true,
			}));

			hookManager.register("pre:exec", hookFn, "replace-plugin");

			const result = await hookManager.execute("pre:exec", {
				original: "data",
			});

			expect(result).toEqual({
				completely: "different",
				context: true,
			});
		});

		it("should handle empty context objects", async () => {
			const hookFn = vi.fn(async (ctx) => ({ ...ctx, added: true }));

			hookManager.register("post:plan", hookFn, "test-plugin");

			const result = await hookManager.execute("post:plan", {});

			expect(result).toEqual({ added: true });
		});

		it("should handle complex nested context objects", async () => {
			const hookFn = vi.fn(async (ctx) => ({
				...ctx,
				nested: {
					...ctx.nested,
					modified: true,
				},
			}));

			hookManager.register("pre:eval", hookFn, "test-plugin");

			const context = {
				nested: { original: true },
				other: "data",
			};

			const result = await hookManager.execute("pre:eval", context);

			expect(result).toEqual({
				nested: { original: true, modified: true },
				other: "data",
			});
		});

		it("should handle hook that returns array (technically valid object)", async () => {
			const hookFn = vi.fn(async () => [1, 2, 3]);

			hookManager.register("post:complete", hookFn, "array-plugin");

			const context = { original: true };
			const result = await hookManager.execute("post:complete", context);

			// Arrays are objects in JavaScript, so they pass the typeof check
			expect(result).toEqual([1, 2, 3]);
			expect(logger.warn).not.toHaveBeenCalled();
		});

		it("should handle synchronous functions wrapped in async", async () => {
			const hookFn = vi.fn(async (ctx) => {
				// Synchronous code in async function
				return { ...ctx, sync: true };
			});

			hookManager.register("pre:plan", hookFn, "sync-plugin");

			const result = await hookManager.execute("pre:plan", {});

			expect(result).toEqual({ sync: true });
		});
	});

	describe("integration scenarios", () => {
		it("should support plugin modifying context for next plugin", async () => {
			const plugin1 = vi.fn(async (ctx) => ({
				...ctx,
				plugins: [...(ctx.plugins || []), "plugin1"],
			}));

			const plugin2 = vi.fn(async (ctx) => ({
				...ctx,
				plugins: [...ctx.plugins, "plugin2"],
			}));

			hookManager.register("pre:exec", plugin1, "plugin-1");
			hookManager.register("pre:exec", plugin2, "plugin-2");

			const result = await hookManager.execute("pre:exec", {});

			expect(result.plugins).toEqual(["plugin1", "plugin2"]);
		});

		it("should handle plugins adding metadata to context", async () => {
			const timingPlugin = vi.fn(async (ctx) => ({
				...ctx,
				metadata: {
					...ctx.metadata,
					startTime: Date.now(),
				},
			}));

			const loggingPlugin = vi.fn(async (ctx) => ({
				...ctx,
				metadata: {
					...ctx.metadata,
					logged: true,
				},
			}));

			hookManager.register("post:eval", timingPlugin, "timing-plugin");
			hookManager.register("post:eval", loggingPlugin, "logging-plugin");

			const result = await hookManager.execute("post:eval", { metadata: {} });

			expect(result.metadata).toHaveProperty("startTime");
			expect(result.metadata.logged).toBe(true);
		});
	});
});
