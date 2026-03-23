import type { OTOperation } from "@/models/collaboration/collaborationType";

/**
 * Client-side OT (Operational Transformation) implementation
 *
 * Handles local editing while maintaining consistency with the server
 */

export type ClientState = "synchronized" | "awaitingAck" | "awaitingAckWithBuffer";

export type OTClientState = {
    state: ClientState;
    serverRevision: number;
    pendingOperations: OTOperation[];
    bufferOperations: OTOperation[];
    document: string;
};

export type OfflineChanges = {
    localDocument: string;
    serverDocument: string;
    pendingOperations: OTOperation[];
    serverRevision: number;
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
            return doc;
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
 * Transform an operation against another operation
 */
function transformOperation(
    op1: OTOperation,
    op2: OTOperation,
    priority: "left" | "right"
): OTOperation {
    if (op1.type === "insert" && op2.type === "insert") {
        if (op1.position < op2.position) {
            return op1;
        }
        if (op1.position > op2.position) {
            return { ...op1, position: op1.position + (op2.text?.length ?? 0) };
        }
        if (priority === "left") {
            return op1;
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
        return { ...op1, position: op2.position };
    }

    if (op1.type === "delete" && op2.type === "insert") {
        if (op2.position <= op1.position) {
            return { ...op1, position: op1.position + (op2.text?.length ?? 0) };
        }
        if (op2.position >= op1.position + (op1.count ?? 0)) {
            return op1;
        }
        const beforeInsert = op2.position - op1.position;
        const afterInsert = (op1.count ?? 0) - beforeInsert;
        return { ...op1, count: beforeInsert + afterInsert };
    }

    if (op1.type === "delete" && op2.type === "delete") {
        const op1End = op1.position + (op1.count ?? 0);
        const op2End = op2.position + (op2.count ?? 0);

        if (op1End <= op2.position) {
            return op1;
        }
        if (op1.position >= op2End) {
            return { ...op1, position: op1.position - (op2.count ?? 0) };
        }
        if (op1.position >= op2.position && op1End <= op2End) {
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
    priority: "left" | "right"
): OTOperation[] {
    let transformed = [...ops1];

    for (const op2 of ops2) {
        transformed = transformed.map((op1) => transformOperation(op1, op2, priority));
    }

    return transformed.filter(
        (op) => op.type !== "retain" && (op.type !== "delete" || (op.count ?? 0) > 0)
    );
}

/**
 * Compose two lists of operations into one
 */
export function compose(ops1: OTOperation[], ops2: OTOperation[]): OTOperation[] {
    // For simplicity, just concatenate - a full implementation would merge them
    return [...ops1, ...ops2];
}

/**
 * Convert a text change event to OT operations
 */
export function textChangeToOperations(
    oldText: string,
    newText: string,
    selectionStart: number,
    selectionEnd: number
): OTOperation[] {
    const operations: OTOperation[] = [];

    // Simple diff: find what was deleted/inserted at the cursor position
    if (oldText === newText) {
        return operations;
    }

    // Calculate the change
    const oldLength = oldText.length;
    const newLength = newText.length;

    // Find common prefix
    let commonStart = 0;
    while (commonStart < oldLength && commonStart < newLength && oldText[commonStart] === newText[commonStart]) {
        commonStart++;
    }

    // Find common suffix
    let commonEnd = 0;
    while (
        commonEnd < oldLength - commonStart &&
        commonEnd < newLength - commonStart &&
        oldText[oldLength - 1 - commonEnd] === newText[newLength - 1 - commonEnd]
    ) {
        commonEnd++;
    }

    const deletedLength = oldLength - commonStart - commonEnd;
    const insertedText = newText.slice(commonStart, newLength - commonEnd);

    if (deletedLength > 0) {
        operations.push({
            type: "delete",
            position: commonStart,
            count: deletedLength,
        });
    }

    if (insertedText.length > 0) {
        operations.push({
            type: "insert",
            position: commonStart,
            text: insertedText,
        });
    }

    return operations;
}

/**
 * OT Client class
 *
 * Manages client-side state for operational transformation
 */
export class OTClient {
    private state: ClientState = "synchronized";
    private serverRevision: number;
    private pendingOperations: OTOperation[] = [];
    private bufferOperations: OTOperation[] = [];
    private document: string;
    private onSendOperations: ((revision: number, operations: OTOperation[]) => void) | null = null;

    // F4.7.4 & F4.7.5 - Track offline changes for potential manual submission
    private offlineChanges: OfflineChanges | null = null;

    constructor(initialDocument: string = "", initialRevision: number = 0) {
        this.document = initialDocument;
        this.serverRevision = initialRevision;
    }

    getDocument(): string {
        return this.document;
    }

    getRevision(): number {
        return this.serverRevision;
    }

    getState(): ClientState {
        return this.state;
    }

    /**
     * F4.7.4 - Check if there are unsent offline changes
     */
    hasOfflineChanges(): boolean {
        return this.offlineChanges !== null;
    }

    /**
     * F4.7.5 - Get offline changes for potential submission
     */
    getOfflineChanges(): OfflineChanges | null {
        return this.offlineChanges;
    }

    /**
     * F4.7.5 - Clear offline changes after they've been handled
     */
    clearOfflineChanges(): void {
        this.offlineChanges = null;
    }

    /**
     * Check if there are pending operations that haven't been acknowledged
     */
    hasPendingOperations(): boolean {
        return this.pendingOperations.length > 0 || this.bufferOperations.length > 0;
    }

    setOnSendOperations(callback: (revision: number, operations: OTOperation[]) => void): void {
        this.onSendOperations = callback;
    }

    /**
     * Handle local edit - called when user makes a change
     */
    applyLocalOperation(operations: OTOperation[]): string {
        // Apply to local document
        this.document = applyOperations(this.document, operations);

        switch (this.state) {
            case "synchronized":
                // Send immediately
                this.pendingOperations = operations;
                this.state = "awaitingAck";
                this.onSendOperations?.(this.serverRevision, operations);
                break;

            case "awaitingAck":
                // Buffer the operations
                this.bufferOperations = compose(this.bufferOperations, operations);
                this.state = "awaitingAckWithBuffer";
                break;

            case "awaitingAckWithBuffer":
                // Add to buffer
                this.bufferOperations = compose(this.bufferOperations, operations);
                break;
        }

        return this.document;
    }

    /**
     * Handle server acknowledgment
     */
    handleServerAck(newRevision: number): void {
        this.serverRevision = newRevision;

        switch (this.state) {
            case "awaitingAck":
                this.pendingOperations = [];
                this.state = "synchronized";
                break;

            case "awaitingAckWithBuffer":
                // Send buffered operations
                this.pendingOperations = this.bufferOperations;
                this.bufferOperations = [];
                this.state = "awaitingAck";
                this.onSendOperations?.(this.serverRevision, this.pendingOperations);
                break;
        }
    }

    /**
     * Handle server operation (from another client)
     */
    handleServerOperation(serverOps: OTOperation[], newRevision: number): string {
        this.serverRevision = newRevision;

        switch (this.state) {
            case "synchronized":
                // Apply directly
                this.document = applyOperations(this.document, serverOps);
                break;

            case "awaitingAck":
                // Transform against pending
                const transformedServerOps = transform(serverOps, this.pendingOperations, "right");
                this.pendingOperations = transform(this.pendingOperations, serverOps, "left");
                this.document = applyOperations(this.document, transformedServerOps);
                break;

            case "awaitingAckWithBuffer":
                // Transform against pending and buffer
                const transformed1 = transform(serverOps, this.pendingOperations, "right");
                this.pendingOperations = transform(this.pendingOperations, serverOps, "left");

                const transformed2 = transform(transformed1, this.bufferOperations, "right");
                this.bufferOperations = transform(this.bufferOperations, transformed1, "left");

                this.document = applyOperations(this.document, transformed2);
                break;
        }

        return this.document;
    }

    /**
     * Handle full sync from server (when out of sync)
     * F4.7.4 - Don't auto-merge offline changes
     */
    handleSync(document: string, revision: number): void {
        // F4.7.4 & F4.7.5 - Preserve offline changes instead of discarding
        if (this.pendingOperations.length > 0 || this.bufferOperations.length > 0) {
            this.offlineChanges = {
                localDocument: this.document,
                serverDocument: document,
                pendingOperations: [...this.pendingOperations, ...this.bufferOperations],
                serverRevision: revision,
            };
        }

        this.document = document;
        this.serverRevision = revision;
        this.pendingOperations = [];
        this.bufferOperations = [];
        this.state = "synchronized";
    }

    /**
     * Reset client state (on reconnect)
     * F4.7.2 & F4.7.3 - Show latest shared code, preserving any offline changes
     */
    reset(document: string = "", revision: number = 0): void {
        // F4.7.4 & F4.7.5 - Preserve offline changes for potential manual submission
        if (this.pendingOperations.length > 0 || this.bufferOperations.length > 0) {
            this.offlineChanges = {
                localDocument: this.document,
                serverDocument: document,
                pendingOperations: [...this.pendingOperations, ...this.bufferOperations],
                serverRevision: this.serverRevision,
            };
        }

        this.document = document;
        this.serverRevision = revision;
        this.pendingOperations = [];
        this.bufferOperations = [];
        this.state = "synchronized";
    }

    /**
     * F4.7.5 - Submit offline changes after reconnection
     * Reconciles against the latest authoritative shared code
     */
    submitOfflineChanges(): OTOperation[] | null {
        if (!this.offlineChanges) {
            return null;
        }

        // Generate operations to transform local changes to current server state
        const offlineOps = this.offlineChanges.pendingOperations;
        this.offlineChanges = null;

        if (offlineOps.length === 0) {
            return null;
        }

        // Apply through normal flow - OT will handle reconciliation
        this.applyLocalOperation(offlineOps);

        return offlineOps;
    }
}
