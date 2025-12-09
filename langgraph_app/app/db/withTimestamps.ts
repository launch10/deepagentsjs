export const withTimestamps = <TData extends Record<string, any>>(
  data: TData
): TData & { createdAt: string; updatedAt: string } => {
  const now = new Date().toISOString();

  return {
    ...data,
    createdAt: now,
    updatedAt: now,
  };
};

export const withUpdatedAt = <TData extends Record<string, any>>(
  data: TData
): TData & { updatedAt: string } => {
  const now = new Date().toISOString();

  return {
    ...data,
    updatedAt: now,
  };
};
