declare module "pg" {
    export class Pool {
        constructor(config?: Record<string, unknown>);
        query<T = any>(text: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
        on(event: string, listener: (...args: any[]) => void): this;
        end(): Promise<void>;
    }

    export interface QueryResultRow {
        [column: string]: unknown;
    }

    export interface QueryResult<T = QueryResultRow> {
        rows: T[];
        rowCount: number | null;
    }
}
