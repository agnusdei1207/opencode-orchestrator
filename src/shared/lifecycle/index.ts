/**
 * Lifecycle Module
 *
 * Provides interfaces and managers for component lifecycle management,
 * including shutdown, cleanup, and handler registration patterns.
 */

export { ShutdownManager, type CleanupFunction } from "./shutdown-manager.js";
export {
    Registration,
    RegistrationWithMetadata,
    CleanupRegistration,
} from "./registration.js";
