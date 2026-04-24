export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_NAME_LENGTH = 200;

export function validateName(name: unknown): string {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Name is required and cannot be empty');
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Name cannot exceed ${MAX_NAME_LENGTH} characters`);
  }
  return name.trim();
}

export function validateUUID(id: unknown): string {
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw new Error('Invalid ID format');
  }
  return id;
}

export function validateTripDate(date: unknown): string | null {
  if (date === undefined || date === null) return null;
  if (typeof date !== 'string') throw new Error('Trip date must be a string');
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) throw new Error('Trip date is not a valid date');
  return date;
}
