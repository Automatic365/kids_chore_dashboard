type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type LooseFunction = {
  Args: Record<string, unknown>;
  Returns: unknown;
};

type LooseSchema = {
  Tables: Record<string, LooseTable>;
  Views: Record<string, never>;
  Functions: Record<string, LooseFunction>;
  Enums: Record<string, never>;
  CompositeTypes: Record<string, never>;
};

export type Database = {
  public: LooseSchema;
};
