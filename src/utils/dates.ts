export const parseDate = (value: unknown): Date | null => {
  if (value == null || value === '') return null;
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') date = value.toDate();
  else if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') date = new Date(value.seconds * 1000);
  else if (typeof value === 'string' || typeof value === 'number') date = new Date(value);
  else return null;
  return Number.isNaN(date.getTime()) ? null : date;
};
