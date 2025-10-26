Refine the project plan based on the user's feedback.

# Original User Request
{{userPrompt}}

# Current Plan
{{currentPlan}}

# User Feedback
{{feedback}}

# Instructions
Based on the user's feedback above, revise and improve the project plan. Address all concerns and suggestions mentioned in the feedback while maintaining the same format and structure.

Format the refined plan as follows:
# Project Brief
[Brief description of what needs to be built]

# Goal
[Clear statement of the end goal]

# Phases
## Phase 1: [Phase Name]
- [ ] [Specific actionable step with deliverable]
- [ ] [Specific actionable step with deliverable]
- [ ] [Specific actionable step with deliverable]

## Phase 2: [Phase Name]
- [ ] [Specific actionable step with deliverable]
- [ ] [Specific actionable step with deliverable]
- [ ] [Specific actionable step with deliverable]

[Continue with all necessary phases]

IMPORTANT PLANNING REQUIREMENTS:
- Make the plan detailed and comprehensive
- Each step MUST be clear, actionable, and produce a concrete deliverable
- ALL steps must specify what will be created (code, docs, config files, etc.)
- Research/analysis steps must include saving findings to docs/[topic].md
- Planning/design steps must include creating design documents in docs/
- Implementation steps must specify what code/files will be created
- Testing steps must specify what test files will be created
- Never create steps that only "discuss" or "consider" - all work must result in saved artifacts
- Break the project into logical phases that build upon each other
- Specify the /docs folder for non-code deliverables unless the project structure dictates otherwise

TEST-DRIVEN DEVELOPMENT (TDD) REQUIREMENTS:
- Follow Test-Driven Development principles throughout the project
- For each feature or component, write tests BEFORE implementing the code
- Include both unit tests and end-to-end (e2e) tests where appropriate
- Test early and often - include testing steps in each phase, not just at the end
- Each implementation task should be preceded by or include writing tests first
- Before completing any phase, ensure all tests, lints, and builds pass successfully
- Testing should be integrated throughout the development process, not as an afterthought
