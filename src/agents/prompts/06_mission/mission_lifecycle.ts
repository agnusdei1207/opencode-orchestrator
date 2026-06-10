export const MISSION_LIFECYCLE = `
# Mission Lifecycle

- /task starts a persisted mission with objective, iteration budget, evidence trail, and active session state.
- Idle continuation may proceed only after a completed assistant turn for the current user message.
- /cancel, /stop, or an interrupt without current completion evidence deactivates continuation until a new mission starts.
`;
