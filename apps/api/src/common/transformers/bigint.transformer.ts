// apps/api/src/common/transformers/bigint.transformer.ts

export const bigintTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseInt(value, 10),
};
