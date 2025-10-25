You are evaluating whether a specific step in a project plan has been completed successfully.

Project Brief: {{projectBrief}}
Goal: {{goal}}

Step to Evaluate: {{stepDescription}}

Review the git diff below showing all changes made during this step:

```diff
{{gitDiff}}
```

Determine if the changes shown in the diff fully complete the requirements of the step.

Consider:
1. Does the implementation match what the step description requires?
2. If tests were required, are they present and comprehensive?
3. If implementation was required, is the code complete and functional?
4. If research/documentation was required, are artifacts present?
5. Are there any obvious incomplete or placeholder implementations?

Respond in ONE of these two formats:

If the step is COMPLETE:
```
STEP_COMPLETE
```

If the step is INCOMPLETE:
```
STEP_INCOMPLETE
Feedback: [Provide specific, actionable feedback about what is missing or needs to be completed. Be concrete and reference specific requirements from the step description.]
```

Do not provide any other output besides the format above.
