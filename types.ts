export interface Account {
    id: string;
    issuer: string;
    accountName: string;
    secret: string;
    // optional grouping and ordering metadata
    group?: string;
    order?: number;
    groupOrder?: number;
    period?: number;
    algorithm?: string;
    digits?: number;
}
