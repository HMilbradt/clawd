import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import logger from "../core/logger.js";
import { loadAdapter, setAdapter } from "./loader.js";

vi.mock("../core/logger.js", () => ({
	default: {
		debug: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	},
}));

const baseUrl = new URL("./base.js", import.meta.url).href;

describe("loadAdapter", () => {
	/** @type {string[]} */
	const directories = [];

	beforeEach(() => {
		vi.clearAllMocks();
		setAdapter(null);
	});

	afterEach(async () => {
		setAdapter(null);
		await Promise.all(
			directories
				.splice(0)
				.map((dir) => fs.rm(dir, { recursive: true, force: true })),
		);
	});

	async function writeAdapter(source) {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "clawd-adapter-"));
		directories.push(dir);
		await fs.mkdir(path.join(dir, ".clawd"));
		await fs.writeFile(path.join(dir, ".clawd", "adapter.js"), source);
		return dir;
	}

	it("constructs a default-exported class with new", async () => {
		const dir = await writeAdapter(`
			import { LLMAdapter } from ${JSON.stringify(baseUrl)};
			export default class AnthropicAdapter extends LLMAdapter {
				async execute(prompt) {
					return \`response:\${prompt}\`;
				}
				async executeWithTUI(prompt) {
					return { exitCode: 0, output: prompt };
				}
			}
		`);

		const adapter = await loadAdapter(dir);

		expect(adapter.getName()).toBe("AnthropicAdapter");
		await expect(adapter.execute("ping")).resolves.toBe("response:ping");
		expect(logger.error).not.toHaveBeenCalled();
		expect(logger.info).toHaveBeenCalledWith(
			"✓ Loaded custom adapter: AnthropicAdapter",
		);
	});

	it("calls a default-exported factory function", async () => {
		const dir = await writeAdapter(`
			export default function createAdapter() {
				return {
					execute(prompt) {
						return prompt;
					},
					executeWithTUI() {
						return { exitCode: 0, output: "" };
					},
					getName() {
						return "Factory Adapter";
					},
				};
			}
		`);

		const adapter = await loadAdapter(dir);

		expect(adapter.getName()).toBe("Factory Adapter");
		expect(logger.error).not.toHaveBeenCalled();
	});

	it("uses a default-exported instance", async () => {
		const dir = await writeAdapter(`
			const adapter = {
				execute(prompt) {
					return prompt;
				},
				executeWithTUI() {
					return { exitCode: 0, output: "" };
				},
				getName() {
					return "Instance Adapter";
				},
			};
			export default adapter;
		`);

		const adapter = await loadAdapter(dir);

		expect(adapter.getName()).toBe("Instance Adapter");
	});

	it("calls a named createAdapter export", async () => {
		const dir = await writeAdapter(`
			export function createAdapter() {
				return {
					execute() {
						return "named";
					},
					executeWithTUI() {
						return { exitCode: 0, output: "" };
					},
					getName() {
						return "Named Factory";
					},
				};
			}
		`);

		const adapter = await loadAdapter(dir);

		expect(adapter.getName()).toBe("Named Factory");
		expect(adapter.execute("x")).toBe("named");
	});

	it("falls back when the module has no adapter export", async () => {
		const dir = await writeAdapter("export const unrelated = true;\n");

		const adapter = await loadAdapter(dir);

		expect(adapter.getName()).toBe("Claude Code");
		expect(logger.error).toHaveBeenCalledWith(
			"Failed to load custom adapter: Custom adapter must export default or createAdapter function",
		);
	});

	it("falls back when the adapter does not implement the required methods", async () => {
		const dir = await writeAdapter("export default class EmptyAdapter {}\n");

		const adapter = await loadAdapter(dir);

		expect(adapter.getName()).toBe("Claude Code");
		expect(logger.error).toHaveBeenCalledWith(
			"Failed to load custom adapter: Custom adapter must implement execute() and executeWithTUI() methods",
		);
	});

	it("uses the default adapter when no custom file exists", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "clawd-adapter-"));
		directories.push(dir);

		const adapter = await loadAdapter(dir);

		expect(adapter.getName()).toBe("Claude Code");
		expect(logger.error).not.toHaveBeenCalled();
	});
});
