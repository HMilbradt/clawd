You are evaluating whether a task has been completed successfully.

Project Brief: {{projectBrief}}
Goal: {{goal}}

Phase: {{phaseName}}
Task: {{stepDescription}}

Review the current state of the project and determine if this task has been fully completed.

EVALUATION PROCESS:
1. **Run automated checks** (if applicable to the project):
   - Run linting (e.g., `npm run lint` or `npx eslint .` or equivalent)
   - Run tests (e.g., `npm test` or `npm run test` or equivalent)
   - Run build (e.g., `npm run build` or equivalent)
   - Check for type errors (e.g., `npx tsc --noEmit` if TypeScript)

2. **Manual verification**:
   - Read relevant files to verify the task was implemented correctly
   - Check that all requirements of the task description are met
   - Ensure code quality and best practices are followed

3. **Check for common issues**:
   - Files that should exist are present
   - No obvious bugs or errors in the implementation
   - Dependencies are properly installed if new ones were added
   - Configuration files are correct

IMPORTANT:
- If any checks fail (lint errors, test failures, build errors), the task is INCOMPLETE
- Run the actual commands to verify - don't just assume they will pass
- Look for package.json to determine what scripts are available
- Be thorough in your evaluation
- Check that the task is actually done, not just partially done
- Provide clear, specific feedback if incomplete, including exact error messages from failed checks

Respond in ONE of these two formats:

If the task is COMPLETE (all checks passed and implementation is correct):
```
TASK_COMPLETE
```

If the task is INCOMPLETE:
```
TASK_INCOMPLETE
Feedback: [Specific, actionable feedback about what is missing, what checks failed (with exact error output), or what needs to be completed]
```

Only respond with the format above, no additional text.
