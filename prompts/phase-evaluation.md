You are evaluating whether a phase in a project plan has been completed successfully.

Project Brief: {{projectBrief}}
Goal: {{goal}}

Phase Name: {{phaseName}}

Steps in this phase:
{{stepDescriptions}}

Commits made during this phase:
{{commitSummary}}

Review the overall git diff for this phase:

```diff
{{phaseDiff}}
```

Determine if ALL steps in this phase have been fully completed based on the commits and changes shown.

For each step, consider:
1. Does the implementation match what the step description requires?
2. If tests were required, are they present and comprehensive?
3. If implementation was required, is the code complete and functional?
4. If research/documentation was required, are artifacts present?
5. Are there any obvious incomplete or placeholder implementations?

Respond in ONE of these two formats:

If ALL steps are COMPLETE:
```
PHASE_COMPLETE
```

If ANY steps are INCOMPLETE, list ONLY the incomplete steps with specific feedback:
```
PHASE_INCOMPLETE
Step 2: [exact step description]
Feedback: [Specific, actionable feedback about what is missing or needs to be completed for this step]

Step 5: [exact step description]
Feedback: [Specific, actionable feedback about what is missing or needs to be completed for this step]
```

IMPORTANT:
- Only list steps that are incomplete
- Use the exact step number and description from the steps list above
- Provide concrete, actionable feedback for each incomplete step
- Do not provide any other output besides the format above
