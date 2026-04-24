import { describe, it, expect } from 'vitest';
import {
  validateName,
  validateUUID,
  validateTripDate,
  UUID_REGEX,
  MAX_NAME_LENGTH,
} from '../validation';

describe('validateName', () => {
  it('returns trimmed string for valid name', () => {
    expect(validateName('  My Trip  ')).toBe('My Trip');
  });

  it('throws for empty string', () => {
    expect(() => validateName('')).toThrow('Name is required and cannot be empty');
  });

  it('throws for whitespace-only string', () => {
    expect(() => validateName('   ')).toThrow('Name is required and cannot be empty');
  });

  it('throws for non-string input', () => {
    expect(() => validateName(123)).toThrow('Name is required and cannot be empty');
    expect(() => validateName(null)).toThrow('Name is required and cannot be empty');
    expect(() => validateName(undefined)).toThrow('Name is required and cannot be empty');
  });

  it('throws for name exceeding 200 characters', () => {
    const longName = 'a'.repeat(201);
    expect(() => validateName(longName)).toThrow(`Name cannot exceed ${MAX_NAME_LENGTH} characters`);
  });

  it('accepts name at exactly 200 characters', () => {
    const name = 'a'.repeat(200);
    expect(validateName(name)).toBe(name);
  });
});

describe('validateUUID', () => {
  it('returns valid UUID string', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(validateUUID(uuid)).toBe(uuid);
  });

  it('accepts uppercase UUID', () => {
    const uuid = '550E8400-E29B-41D4-A716-446655440000';
    expect(validateUUID(uuid)).toBe(uuid);
  });

  it('throws for non-string input', () => {
    expect(() => validateUUID(123)).toThrow('Invalid ID format');
    expect(() => validateUUID(null)).toThrow('Invalid ID format');
  });

  it('throws for malformed UUID', () => {
    expect(() => validateUUID('not-a-uuid')).toThrow('Invalid ID format');
    expect(() => validateUUID('550e8400-e29b-41d4-a716')).toThrow('Invalid ID format');
  });
});

describe('validateTripDate', () => {
  it('returns null for undefined', () => {
    expect(validateTripDate(undefined)).toBeNull();
  });

  it('returns null for null', () => {
    expect(validateTripDate(null)).toBeNull();
  });

  it('returns valid ISO date string', () => {
    const date = '2025-06-15';
    expect(validateTripDate(date)).toBe(date);
  });

  it('throws for non-string input', () => {
    expect(() => validateTripDate(123)).toThrow('Trip date must be a string');
  });

  it('throws for invalid date string', () => {
    expect(() => validateTripDate('not-a-date')).toThrow('Trip date is not a valid date');
  });
});

describe('constants', () => {
  it('UUID_REGEX matches valid UUIDs', () => {
    expect(UUID_REGEX.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('MAX_NAME_LENGTH is 200', () => {
    expect(MAX_NAME_LENGTH).toBe(200);
  });
});
