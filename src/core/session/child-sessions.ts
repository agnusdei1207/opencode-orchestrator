/**
 * Child sessions per parent, learned from `session.created` events.
 *
 * Delegation runs through OpenCode's native subagent tool, so the plugin no
 * longer owns delegated tasks. It only needs to know whether a parent still
 * has a child at work (to hold mission continuation) and which children to
 * stop when a mission is replaced. Busy state comes from the host status map.
 */

import type { HostClient } from "../../host/client.js";

export class ChildSessions {
    private readonly childrenByParent = new Map<string, Set<string>>();
    private readonly parentByChild = new Map<string, string>();

    add(parentID: string, childID: string): void {
        if (!parentID || !childID || parentID === childID) return;
        const children = this.childrenByParent.get(parentID) ?? new Set<string>();
        children.add(childID);
        this.childrenByParent.set(parentID, children);
        this.parentByChild.set(childID, parentID);
    }

    /** Forget a deleted session, whether it was a parent or a child. */
    remove(sessionID: string): void {
        const parentID = this.parentByChild.get(sessionID);
        if (parentID) {
            const siblings = this.childrenByParent.get(parentID);
            siblings?.delete(sessionID);
            if (siblings?.size === 0) this.childrenByParent.delete(parentID);
            this.parentByChild.delete(sessionID);
        }
        for (const childID of this.childrenByParent.get(sessionID) ?? []) this.parentByChild.delete(childID);
        this.childrenByParent.delete(sessionID);
    }

    /** Children of the parent that the host reports as not idle. */
    busyChildren(client: Pick<HostClient, "statuses">, parentID: string): string[] {
        const statuses = client.statuses();
        return [...(this.childrenByParent.get(parentID) ?? [])].filter(childID => statuses.has(childID));
    }

    clear(): void {
        this.childrenByParent.clear();
        this.parentByChild.clear();
    }
}
