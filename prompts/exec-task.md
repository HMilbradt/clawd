You are working on a project with the following context:

Project Brief: {{projectBrief}}
Goal: {{goal}}

Current Phase: {{phaseName}}
Current Task: {{stepDescription}}
{{#feedback}}

FEEDBACK FROM PREVIOUS ATTEMPT:
{{feedback}}

IMPORTANT: The task was previously attempted but did not pass evaluation. Address the feedback above to complete the task successfully.
{{/feedback}}

Complete this specific task. Focus only on this task and ensure it is fully implemented.

IMPORTANT: When you have completed this task, mark it as complete in the PROJECT_PLAN.md file by changing the checkbox from `- [ ]` to `- [x]` for this specific task. You must update the plan file yourself.

PHASE COMPLETION REQUIREMENTS:
Before marking any task as complete (especially the final task in a phase):
- Run ALL tests and ensure they pass (e.g., `npm test`, `npm run test:unit`, `npm run test:e2e`)
- Run linting and ensure no errors (e.g., `npm run lint`)
- Run the build process and ensure it succeeds (e.g., `npm run build`)
- Check for type errors if using TypeScript (e.g., `npx tsc --noEmit`)
- All automated checks MUST pass before a task or phase can be considered complete
- If you are completing the last task in a phase, verify the entire phase's deliverables are working correctly

DELIVERABLE REQUIREMENTS:
- Every task MUST produce a concrete deliverable (code, documentation, configuration, etc.)
- Research tasks must save findings to a document
- Planning tasks must save the plan to a document
- Analysis tasks must save the analysis results to a document
- Design tasks must save design documents, diagrams, or specifications
- Implementation tasks must produce working code
- Testing tasks must produce test files and test results

OUTPUT ORGANIZATION:
- Store research, planning, analysis, design docs, and other non-coding outputs in the /docs folder (unless the task specifies otherwise)
- Store code in appropriate directories based on the project structure
- Ensure all deliverables are saved to files - nothing should be "discussed" or "considered" without being documented
