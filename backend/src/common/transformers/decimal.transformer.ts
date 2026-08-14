import { ValueTransformer } from 'typeorm';

/**
 * pg returns NUMERIC/DECIMAL columns as strings to avoid float precision loss.
 * The API and frontend treat these as plain numbers (arithmetic, JSON), so
 * convert on the way out of the database.
 */
export const DecimalTransformer: ValueTransformer = {
  to: (value?: number) => value,
  from: (value?: string) => (value === null || value === undefined ? value : parseFloat(value)),
};
