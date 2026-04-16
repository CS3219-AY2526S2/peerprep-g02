import type { OTOperation } from "@/models/collaboration/collaborationType";

/**
 * Client-side OT (Operational Transformation) implementation
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
    priority: "left" | "right",
): OTOperation {
    if (op1.type === "insert" && op2.type === "insert") {
        if (op1.position < op2.position) return op1;
        if (op1.position > op2.position) {
            return { ...op1, position: op1.position + (op2.text?.length ?? 0) };
        }
        if (priority === "left") return op1;
        return { ...op1, position: op1.position + (op2.text?.length ?? 0) };
    }

    if (op1.type === "insert" && op2.type === "delete") {
        if (op1.position <= op2.position) return op1;
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

        if (op1End <= op2.position) return op1;
        if (op1.position >= op2End) {
            return { ...op1, position: op1.position - (op2.count ?? 0) };
        }
        if (op1.position >= op2.position && op1End <= op2End) {
            return { type: "retain", position: 0 };
        }
        if (op1.position < op2.position) {
            return { ...op1, count: op2.position - op1.position };
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

/**
 * Compose two lists of operations into one
 */
export function compose(ops1: OTOperation[], ops2: OTOperation[]): OTOperation[] {
    return [...ops1, ...ops2];
}

/**
 * Convert a text change event to OT operations
 */
export function textChangeToOperations(oldText: string, newText: string): OTOperation[] {
    const operations: OTOperation[] = [];

    if (oldText === newText) return operations;

    const oldLength = oldText.length;
    const newLength = newText.length;

    let commonStart = 0;
    while (
        commonStart < oldLength &&
        commonStart < newLength &&
        oldText[commonStart] === newText[commonStart]
    ) {
        commonStart++;
    }

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
 */
export class OTClient {
    private state: ClientState = "synchronized";
    private serverRevision: number;
    private pendingOperations: OTOperation[] = [];
    private bufferOperations: OTOperation[] = [];
    private document: string;

    private onSendOperations: ((revision: number, operations: OTOperation[]) => void) | null = null;

    private offlineChanges: OfflineChanges | null = null;

    constructor(initialDocument: string = "", initialRevision: number = 0) {
        this.document = initialDocument;
        this.serverRevision = initialRevision;
    }

    getDocument() {
        return this.document;
    }

    getRevision() {
        return this.serverRevision;
    }

    getState() {
        return this.state;
    }

    hasOfflineChanges() {
        return this.offlineChanges !== null;
    }

    getOfflineChanges() {
        return this.offlineChanges;
    }

    clearOfflineChanges() {
        this.offlineChanges = null;
    }

    hasPendingOperations() {
        return this.pendingOperations.length > 0 || this.bufferOperations.length > 0;
    }

    setOnSendOperations(callback: (revision: number, operations: OTOperation[]) => void) {
        this.onSendOperations = callback;
    }

    applyLocalOperation(operations: OTOperation[]): string {
        this.document = applyOperations(this.document, operations);

        switch (this.state) {
            case "synchronized": {
                this.pendingOperations = operations;
                this.state = "awaitingAck";
                this.onSendOperations?.(this.serverRevision, operations);
                break;
            }

            case "awaitingAck": {
                this.bufferOperations = compose(this.bufferOperations, operations);
                this.state = "awaitingAckWithBuffer";
                break;
            }

            case "awaitingAckWithBuffer": {
                this.bufferOperations = compose(this.bufferOperations, operations);
                break;
            }
        }

        return this.document;
    }

    handleServerAck(newRevision: number) {
        this.serverRevision = newRevision;

        switch (this.state) {
            case "awaitingAck": {
                this.pendingOperations = [];
                this.state = "synchronized";
                break;
            }

            case "awaitingAckWithBuffer": {
                this.pendingOperations = this.bufferOperations;
                this.bufferOperations = [];
                this.state = "awaitingAck";
                this.onSendOperations?.(this.serverRevision, this.pendingOperations);
                break;
            }
        }
    }

    handleServerOperation(serverOps: OTOperation[], newRevision: number): string {
        this.serverRevision = newRevision;

        switch (this.state) {
            case "synchronized": {
                this.document = applyOperations(this.document, serverOps);
                break;
            }

            case "awaitingAck": {
                const transformedServerOps = transform(serverOps, this.pendingOperations, "right");
                this.pendingOperations = transform(this.pendingOperations, serverOps, "left");
                this.document = applyOperations(this.document, transformedServerOps);
                break;
            }

            case "awaitingAckWithBuffer": {
                const transformed1 = transform(serverOps, this.pendingOperations, "right");
                this.pendingOperations = transform(this.pendingOperations, serverOps, "left");

                const transformed2 = transform(transformed1, this.bufferOperations, "right");
                this.bufferOperations = transform(this.bufferOperations, transformed1, "left");

                this.document = applyOperations(this.document, transformed2);
                break;
            }
        }

        return this.document;
    }

    handleSync(document: string, revision: number) {
        if (this.hasPendingOperations()) {
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

    reset(document: string = "", revision: number = 0) {
        if (this.hasPendingOperations()) {
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

    submitOfflineChanges(): OTOperation[] | null {
        if (!this.offlineChanges) return null;

        const offlineOps = this.offlineChanges.pendingOperations;
        this.offlineChanges = null;

        if (offlineOps.length === 0) return null;

        this.applyLocalOperation(offlineOps);

        return offlineOps;
    }
}
