export default {
	name: "{{PLUGIN_NAME}}",

	// Available hooks: pre:plan, post:plan, pre:exec, post:exec, pre:eval, post:eval, pre:complete, post:complete
	hooks: {
		/**
		 * Called before plan initialization
		 * @param {Object} context - { userPrompt, options, planContent, timestamp, logger }
		 * @returns {Object} - Modified context
		 */
		"pre:plan": async (context) => {
			context.logger.info(`[{{PLUGIN_NAME}}] Plan initialization starting...`);
			return context;
		},

		/**
		 * Called after plan has been generated/loaded
		 * @param {Object} context - { userPrompt, options, planContent, timestamp, logger }
		 * @returns {Object} - Modified context
		 */
		"post:plan": async (context) => {
			context.logger.info("[{{PLUGIN_NAME}}] Plan loaded successfully");
			return context;
		},

		/**
		 * Called before task execution
		 * @param {Object} context - { task, prompt, options, output, exitCode, timestamp, logger }
		 * @returns {Object} - Modified context
		 */
		"pre:exec": async (context) => {
			context.logger.info(
				`[{{PLUGIN_NAME}}] Executing: ${context.task.description}`,
			);
			return context;
		},

		/**
		 * Called after task execution
		 * @param {Object} context - { task, prompt, options, output, exitCode, timestamp, logger }
		 * @returns {Object} - Modified context
		 */
		"post:exec": async (context) => {
			if (context.exitCode === 0) {
				context.logger.info(
					`[{{PLUGIN_NAME}}] Task completed: ${context.task.description}`,
				);
			} else {
				context.logger.error(
					`[{{PLUGIN_NAME}}] Task failed with code ${context.exitCode}`,
				);
			}
			return context;
		},

		/**
		 * Called before task evaluation
		 * @param {Object} context - { task, result, timestamp, logger }
		 * @returns {Object} - Modified context
		 */
		"pre:eval": async (context) => {
			context.logger.info(
				`[{{PLUGIN_NAME}}] Evaluating: ${context.task.description}`,
			);
			return context;
		},

		/**
		 * Called after task evaluation
		 * @param {Object} context - { task, result: { complete, feedback }, timestamp, logger, runPrompt }
		 * @returns {Object} - Modified context
		 */
		"post:eval": async (context) => {
			if (context.result.complete) {
				context.logger.info(`[{{PLUGIN_NAME}}] Evaluation: COMPLETE`);
			} else {
				context.logger.warn(
					`[{{PLUGIN_NAME}}] Evaluation: INCOMPLETE - ${context.result.feedback}`,
				);

				// Example: Use runPrompt() to get additional information
				// const additionalInfo = await context.runPrompt(
				// 	`Based on this feedback: "${context.result.feedback}", suggest one specific action to fix the issue.`
				// );
				// context.logger.info(`Suggested fix: ${additionalInfo}`);
			}
			return context;
		},

		/**
		 * Called before project completion check
		 * @param {Object} context - { projectBrief, goal, plan, allTasksMarkedComplete, isComplete, timestamp, logger }
		 * @returns {Object} - Modified context
		 */
		"pre:complete": async (context) => {
			context.logger.info("[{{PLUGIN_NAME}}] Checking project completion...");
			return context;
		},

		/**
		 * Called after project completion check
		 * @param {Object} context - { projectBrief, goal, plan, allTasksMarkedComplete, isComplete, timestamp, logger }
		 * @returns {Object} - Modified context
		 */
		"post:complete": async (context) => {
			if (context.isComplete) {
				context.logger.info("[{{PLUGIN_NAME}}] 🎉 Project is complete!");
			} else {
				context.logger.info(
					"[{{PLUGIN_NAME}}] Project not yet complete, continuing...",
				);
			}
			return context;
		},
	},
};
