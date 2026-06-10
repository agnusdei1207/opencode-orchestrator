export const VERIFICATION_BUILD = `
# Build Verification

- Run the repository build or the narrowest build command that covers the changed surface.
- Treat generated artifacts, package metadata, and exported types as part of the build contract.
- If a build cannot run in the current environment, state the exact blocker and run the closest lower-level checks.
`;
