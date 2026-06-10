export const EXECUTION_ERROR_HANDLING = `
# Execution Error Handling

- Treat failing commands as evidence, not noise; capture the command, exit state, and relevant output.
- Classify failures as environmental, dependency, test, type, runtime, or design before retrying.
- Retry only transient failures with a changed condition; otherwise inspect the affected path and adapt the plan.
`;
