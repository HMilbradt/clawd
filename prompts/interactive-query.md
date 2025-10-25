# Interactive User Query

The user has submitted an interactive query while the project is running. Please respond to their request based on the current project state.

## User Query Type
{{queryType}}

## User Query
{{userQuery}}

## Current Project Context

**Project Brief:** {{projectBrief}}

**Project Goal:** {{goal}}

**Current Phase:** {{currentPhase}}

**Current Step:** {{currentStep}}

**Overall Progress:** {{completedSteps}}/{{totalSteps}} steps completed

## Instructions

Based on the query type and the user's request, please:

1. **For "question" type:** Answer the user's question about the current status, progress, or implementation details. Be specific and reference the current phase and completed work.

2. **For "plan_change" type:** The user wants to modify the existing plan. Read the PROJECT_PLAN.md file, understand their requested changes, and update the plan accordingly. Make sure to preserve the existing progress markers (checked boxes for completed tasks).

3. **For "add_scope" type:** The user wants to add new tasks or expand the scope. Read the PROJECT_PLAN.md file and add new phases or steps as appropriate. Add them as uncompleted tasks (unchecked boxes).

4. **For "guidance" type:** The user is providing direction or steering for how to approach the next steps. Acknowledge their guidance and, if applicable, adjust the plan or approach accordingly.

Be concise and actionable in your response. If you make changes to the plan, clearly summarize what was changed.
