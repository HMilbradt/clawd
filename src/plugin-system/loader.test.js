import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import logger from "../core/logger.js";
import hookManager from "./hooks.js";
import { listPlugins, loadPlugins } from "./loader.js";

vi.mock("../core/logger.js", () => ({
	default: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}));

describe("Plugin Loader", () => {
	let testDir;
	let pluginsDir;

	beforeEach(async () => {
		hookManager.clear();
		vi.clearAllMocks();

		// Create a temp directory for tests
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawd-test-"));
		pluginsDir = path.join(testDir, ".clawd", "plugins");
	});

	afterEach(async () => {
		// Clean up temp directory
		try {
			await fs.rm(testDir, { recursive: true, force: true });
		} catch (_error) {
			// Ignore cleanup errors
		}
	});

	describe("loadPlugins", () => {
		it("should return empty array when .clawd/plugins directory does not exist", async () => {
			const result = await loadPlugins(testDir);

			expect(result).toEqual([]);
			expect(logger.debug).toHaveBeenCalledWith(
				"No .clawd/plugins directory found, skipping plugin loading",
			);
		});

		it("should return empty array when no .js files found", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });
			await fs.writeFile(path.join(pluginsDir, "README.md"), "# Plugins");
			await fs.writeFile(
				path.join(pluginsDir, "config.json"),
				JSON.stringify({}),
			);

			const result = await loadPlugins(testDir);

			expect(result).toEqual([]);
			expect(logger.info).toHaveBeenCalledWith(
				"No plugin files found in .clawd/plugins/",
			);
		});

		it("should load a valid plugin and register its hooks", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			const pluginCode = `
export default {
  name: 'test-plugin',
  hooks: {
    'pre:exec': async (ctx) => ctx,
    'post:exec': async (ctx) => ctx,
  }
};
`;
			await fs.writeFile(path.join(pluginsDir, "test-plugin.js"), pluginCode);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("test-plugin");
			expect(hookManager.count("pre:exec")).toBe(1);
			expect(hookManager.count("post:exec")).toBe(1);
			expect(logger.info).toHaveBeenCalledWith(
				"✓ Loaded plugin: test-plugin (2 hooks)",
			);
		});

		it("should load multiple plugins", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "plugin1.js"),
				`
export default {
  name: 'plugin-1',
  hooks: {
    'pre:plan': async (ctx) => ctx,
  }
};
`,
			);

			await fs.writeFile(
				path.join(pluginsDir, "plugin2.js"),
				`
export default {
  name: 'plugin-2',
  hooks: {
    'post:plan': async (ctx) => ctx,
  }
};
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("plugin-1");
			expect(result[1].name).toBe("plugin-2");
			expect(logger.info).toHaveBeenCalledWith(
				"Successfully loaded 2 plugin(s)",
			);
		});

		it("should skip plugin without default export", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "bad-plugin.js"),
				`
export const something = 123;
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(0);
			expect(logger.warn).toHaveBeenCalledWith(
				"Plugin bad-plugin.js does not have a default export, skipping",
			);
		});

		it("should skip plugin without valid name", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "no-name.js"),
				`
export default {
  hooks: {
    'pre:exec': async (ctx) => ctx,
  }
};
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(0);
			expect(logger.warn).toHaveBeenCalledWith(
				"Plugin no-name.js does not have a valid name, skipping",
			);
		});

		it("should skip plugin with non-string name", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "invalid-name.js"),
				`
export default {
  name: 123,
  hooks: {
    'pre:exec': async (ctx) => ctx,
  }
};
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(0);
			expect(logger.warn).toHaveBeenCalledWith(
				"Plugin invalid-name.js does not have a valid name, skipping",
			);
		});

		it("should skip plugin without hooks object", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "no-hooks.js"),
				`
export default {
  name: 'no-hooks-plugin',
};
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(0);
			expect(logger.warn).toHaveBeenCalledWith(
				"Plugin no-hooks.js does not have hooks object, skipping",
			);
		});

		it("should skip plugin with hooks as non-object", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "invalid-hooks.js"),
				`
export default {
  name: 'invalid-hooks',
  hooks: 'not an object',
};
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(0);
			expect(logger.warn).toHaveBeenCalledWith(
				"Plugin invalid-hooks.js does not have hooks object, skipping",
			);
		});

		it("should handle plugin with invalid hook name", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "mixed-hooks.js"),
				`
export default {
  name: 'plugin-with-invalid-hook',
  hooks: {
    'invalid:hook': async (ctx) => ctx,
    'pre:exec': async (ctx) => ctx,
  }
};
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(1);
			expect(hookManager.count("pre:exec")).toBe(1);
			expect(hookManager.count("invalid:hook")).toBe(0);
			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining(
					"Failed to register hook invalid:hook from plugin plugin-with-invalid-hook",
				),
			);
			expect(logger.info).toHaveBeenCalledWith(
				"✓ Loaded plugin: plugin-with-invalid-hook (1 hooks)",
			);
		});

		it("should handle plugin import error", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "syntax-error.js"),
				`
export default {
  name: 'bad-syntax',
  this is invalid javascript syntax!!!
};
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(0);
			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining("Failed to load plugin syntax-error.js"),
			);
		});

		it("should filter out non-.js files", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "plugin.js"),
				`
export default {
  name: 'valid-plugin',
  hooks: {
    'pre:exec': async (ctx) => ctx,
  }
};
`,
			);
			await fs.writeFile(path.join(pluginsDir, "README.md"), "# Plugins");
			await fs.writeFile(
				path.join(pluginsDir, "config.json"),
				JSON.stringify({}),
			);
			await fs.writeFile(path.join(pluginsDir, ".DS_Store"), "");

			const result = await loadPlugins(testDir);

			// Only plugin.js should be loaded
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("valid-plugin");
		});

		it("should continue loading other plugins when one fails", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "plugin1.js"),
				`
export default {
  name: 'plugin-1',
  hooks: {
    'pre:exec': async (ctx) => ctx,
  }
};
`,
			);

			await fs.writeFile(
				path.join(pluginsDir, "bad.js"),
				`
invalid syntax!!!
`,
			);

			await fs.writeFile(
				path.join(pluginsDir, "plugin2.js"),
				`
export default {
  name: 'plugin-2',
  hooks: {
    'post:exec': async (ctx) => ctx,
  }
};
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("plugin-1");
			expect(result[1].name).toBe("plugin-2");
			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining("Failed to load plugin bad.js"),
			);
		});

		it("should log correct number of hooks when plugin has no hooks", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "empty.js"),
				`
export default {
  name: 'empty-hooks',
  hooks: {}
};
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(1);
			expect(logger.info).toHaveBeenCalledWith(
				"✓ Loaded plugin: empty-hooks (0 hooks)",
			);
		});

		it("should log found plugin files count", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			for (let i = 1; i <= 3; i++) {
				await fs.writeFile(
					path.join(pluginsDir, `plugin${i}.js`),
					`
export default {
  name: 'plugin-${i}',
  hooks: {}
};
`,
				);
			}

			await loadPlugins(testDir);

			expect(logger.info).toHaveBeenCalledWith("Found 3 plugin file(s)");
		});

		it("should load plugin with many hooks", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "many-hooks.js"),
				`
export default {
  name: 'many-hooks',
  hooks: {
    'pre:plan': async (ctx) => ctx,
    'post:plan': async (ctx) => ctx,
    'pre:exec': async (ctx) => ctx,
    'post:exec': async (ctx) => ctx,
    'pre:eval': async (ctx) => ctx,
    'post:eval': async (ctx) => ctx,
    'pre:complete': async (ctx) => ctx,
    'post:complete': async (ctx) => ctx,
  }
};
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(1);
			expect(logger.info).toHaveBeenCalledWith(
				"✓ Loaded plugin: many-hooks (8 hooks)",
			);
		});

		it("should handle plugin with additional properties", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "extended.js"),
				`
export default {
  name: 'extended-plugin',
  version: '1.0.0',
  description: 'A plugin with extra properties',
  hooks: {
    'pre:exec': async (ctx) => ctx,
  }
};
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("extended-plugin");
			expect(result[0].version).toBe("1.0.0");
			expect(result[0].description).toBe("A plugin with extra properties");
		});

		it("should handle async hooks properly", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "async.js"),
				`
export default {
  name: 'async-plugin',
  hooks: {
    'pre:exec': async (ctx) => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return { ...ctx, modified: true };
    },
  }
};
`,
			);

			const result = await loadPlugins(testDir);

			expect(result).toHaveLength(1);
			expect(hookManager.count("pre:exec")).toBe(1);

			// Test that the hook actually works
			const context = { test: true };
			const modified = await hookManager.execute("pre:exec", context);
			expect(modified).toEqual({ test: true, modified: true });
		});
	});

	describe("listPlugins", () => {
		it("should return empty object when no plugins loaded", () => {
			const result = listPlugins();
			expect(result).toEqual({});
		});

		it("should return all loaded plugins and their hooks", async () => {
			await fs.mkdir(pluginsDir, { recursive: true });

			await fs.writeFile(
				path.join(pluginsDir, "plugin1.js"),
				`
export default {
  name: 'plugin-1',
  hooks: {
    'pre:exec': async (ctx) => ctx,
  }
};
`,
			);

			await fs.writeFile(
				path.join(pluginsDir, "plugin2.js"),
				`
export default {
  name: 'plugin-2',
  hooks: {
    'pre:exec': async (ctx) => ctx,
  }
};
`,
			);

			await fs.writeFile(
				path.join(pluginsDir, "plugin3.js"),
				`
export default {
  name: 'plugin-3',
  hooks: {
    'post:plan': async (ctx) => ctx,
  }
};
`,
			);

			await loadPlugins(testDir);

			const result = listPlugins();

			expect(result).toEqual({
				"pre:exec": ["plugin-1", "plugin-2"],
				"post:plan": ["plugin-3"],
			});
		});

		it("should reflect current hook manager state", async () => {
			hookManager.register("pre:eval", vi.fn(), "plugin-1");

			let result = listPlugins();
			expect(result).toEqual({
				"pre:eval": ["plugin-1"],
			});

			hookManager.register("pre:eval", vi.fn(), "plugin-2");

			result = listPlugins();
			expect(result).toEqual({
				"pre:eval": ["plugin-1", "plugin-2"],
			});
		});
	});
});
