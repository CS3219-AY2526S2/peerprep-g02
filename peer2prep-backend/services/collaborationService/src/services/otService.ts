import type { OTOperation } from "@/models/session.js";
import { RedisOTRepository } from "@/repositories/redisOTRepository.js";
import { logger } from "@/utils/logger.js";

/**
 * Operational Transformation (OT) Service
 *
 * Handles real-time collaborative text editing using OT algorithms.
 * Operations: insert, delete, retain
 *
 * Document state is persisted to Redis for multi-instance support.
 */

export type TransformResult = {
    op1Prime: OTOperation[];
    op2Prime: OTOperation[];
};

/**
 * Apply a single operation to a document
 */
function applySingleOperation(doc: string, op: OTOperation): string {
    switch (op.type) {
        case "insert":
            return doc.slice(0, op.position) + (op.text ?? "") + doc.slice(op.position);
        case "delete":
            return doc.slice(0, op.position) + doc.slice(op.position + (op.count ?? 0));
        case "retain":
            return doc; // No change
        default:
            return doc;
    }
}

/**
 * Apply a list of operations to a document
 */
export function applyOperations(doc: string, operations: OTOperation[]): string {
    let result = doc;
    for (const op of operations) {
        result = applySingleOperation(result, op);
    }
    return result;
}

/**
 * Transform two operations so they can be applied in either order
 * This is the core OT algorithm
 *
 * Given operations A and B that were created concurrently:
 * - A' = transform(A, B) gives an operation that achieves A's intent after B has been applied
 * - B' = transform(B, A) gives an operation that achieves B's intent after A has been applied
 */
export function transformOperation(
    op1: OTOperation,
    op2: OTOperation,
    priority: "left" | "right",
): OTOperation {
    // If both are at same position, priority determines order
    if (op1.type === "insert" && op2.type === "insert") {
        if (op1.position < op2.position) {
            return op1;
        }
        if (op1.position > op2.position) {
            return { ...op1, position: op1.position + (op2.text?.length ?? 0) };
        }
        // Same position - priority determines which goes first
        if (priority === "left") {
            return op1; // op1 stays, op2 shifts
        }
        return { ...op1, position: op1.position + (op2.text?.length ?? 0) };
    }

    if (op1.type === "insert" && op2.type === "delete") {
        if (op1.position <= op2.position) {
            return op1;
        }
        if (op1.position >= op2.position + (op2.count ?? 0)) {
            return { ...op1, position: op1.position - (op2.count ?? 0) };
        }
        // Insert is within deleted region - place at delete position
        return { ...op1, position: op2.position };
    }

    if (op1.type === "delete" && op2.type === "insert") {
        if (op2.position <= op1.position) {
            return { ...op1, position: op1.position + (op2.text?.length ?? 0) };
        }
        if (op2.position >= op1.position + (op1.count ?? 0)) {
            return op1;
        }
        // Insert is within our delete region - split the delete
        const beforeInsert = op2.position - op1.position;
        const afterInsert = (op1.count ?? 0) - beforeInsert;
        // For simplicity, delete just the part before the insert
        // A more complete implementation would return two operations
        return { ...op1, count: beforeInsert + afterInsert };
    }

    if (op1.type === "delete" && op2.type === "delete") {
        const op1End = op1.position + (op1.count ?? 0);
        const op2End = op2.position + (op2.count ?? 0);

        if (op1End <= op2.position) {
            return op1; // No overlap, op1 is before op2
        }
        if (op1.position >= op2End) {
            return { ...op1, position: op1.position - (op2.count ?? 0) }; // Shift position
        }

        // Overlapping deletes - calculate remaining portion
        if (op1.position >= op2.position && op1End <= op2End) {
            // op1 entirely within op2 - nothing to delete
            return { type: "retain", position: 0 };
        }

        if (op1.position < op2.position) {
            const newCount = op2.position - op1.position;
            return { ...op1, count: newCount };
        }

        const newPosition = op2.position;
        const newCount = op1End - op2End;
        return { ...op1, position: newPosition, count: Math.max(0, newCount) };
    }

    return op1;
}

/**
 * Transform a list of operations against another list
 */
export function transform(
    ops1: OTOperation[],
    ops2: OTOperation[],
    priority: "left" | "right",
): OTOperation[] {
    let transformed = [...ops1];

    for (const op2 of ops2) {
        transformed = transformed.map((op1) => transformOperation(op1, op2, priority));
    }

    return transformed.filter(
        (op) => op.type !== "retain" && (op.type !== "delete" || (op.count ?? 0) > 0),
    );
}

export type ApplyOperationsResult = {
    transformedOps: OTOperation[];
    newRevision: number;
    newContent: string;
};

/**
 * OT Document Manager using Redis for persistence
 */
export class OTDocumentManager {
    constructor(private readonly otRepository: RedisOTRepository) {}

    async initializeDocument(collaborationId: string, content: string = ""): Promise<void> {
        await this.otRepository.initializeDocument(collaborationId, content);
    }

    async getContent(collaborationId: string): Promise<string> {
        return this.otRepository.getContent(collaborationId);
    }

    async getRevision(collaborationId: string): Promise<number> {
        return this.otRepository.getRevision(collaborationId);
    }

    async getDocument(collaborationId: string): Promise<{ content: string; revision: number } | null> {
        return this.otRepository.getDocument(collaborationId);
    }

    /**
     * Process incoming operations from a client
     * Returns transformed operations to broadcast and acknowledgment
     */
    async applyClientOperations(
        collaborationId: string,
        userId: string,
        clientRevision: number,
        operations: OTOperation[],
    ): Promise<ApplyOperationsResult | null> {
        // Get current document state
        const doc = await this.otRepository.getDocument(collaborationId);
        if (!doc) {
            logger.warn({ collaborationId }, "Document not found for OT operation");
            return null;
        }

        // Client must be at most one revision behind
        if (clientRevision > doc.revision) {
            logger.warn(
                { clientRevision, serverRevision: doc.revision },
                "Client revision ahead of server",
            );
            return null;
        }

        // Transform operations against any operations that happened since client's revision
        let transformedOps = operations;

        if (clientRevision < doc.revision) {
            // Get all operations that happened after client's revision
            const historyOps = await this.otRepository.getOperationsSinceRevision(
                collaborationId,
                clientRevision,
            );

            for (const historyEntry of historyOps) {
                if (historyEntry.userId !== userId) {
                    transformedOps = transform(transformedOps, historyEntry.serverOps, "right");
                }
            }
        }

        // Apply transformed operations to document
        const newContent = applyOperations(doc.content, transformedOps);
        const newRevision = doc.revision + 1;

        // Store the update
        await this.otRepository.updateDocument(collaborationId, newContent, newRevision, {
            userId,
            revision: newRevision,
            clientOps: operations,
            serverOps: transformedOps,
        });

        return {
            transformedOps,
            newRevision,
            newContent,
        };
    }

    async deleteDocument(collaborationId: string): Promise<void> {
        await this.otRepository.deleteDocument(collaborationId);
    }
}
