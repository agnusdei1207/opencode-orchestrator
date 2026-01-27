/**
 * Lifecycle Module
 *
 * Provides interfaces and managers for component lifecycle management,
 * including shutdown, cleanup, and handler registration patterns.
 */

export { ShutdownManager, type CleanupHandler, type CleanupFunction } from "./shutdown-manager.js";
export {
    Registration,
    RegistrationWithMetadata,
    CleanupRegistration,
} from "./registration.js";
