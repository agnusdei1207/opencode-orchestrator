/**
 * Recovery Stats Interface
 */

export interface RecoveryStats {
    totalRecoveries: number;
    byCategory: Record<string, number>;
    byAction: Record<string, number>;
    successRate: number;
}
