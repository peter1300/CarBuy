/** Loose string keys so catalogs can grow without union churn. */
export type MessageKey = string

export type Messages = Record<string, string>
