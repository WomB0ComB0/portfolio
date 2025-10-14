import { describe, it, expect } from 'vitest';
import { Redacted } from './redacted';

describe('Redacted', () => {
  it('should create a Redacted instance', () => {
    const value = 'secret';
    const redacted = Redacted.make(value);
    expect(redacted).toBeInstanceOf(Redacted);
  });

  it('should throw an error for null or undefined values', () => {
    expect(() => Redacted.make(null)).toThrow('Value cannot be null or undefined');
    expect(() => Redacted.make(undefined)).toThrow('Value cannot be null or undefined');
  });

  it('should return the original value with getValue', () => {
    const value = 'secret';
    const redacted = Redacted.make(value);
    expect(redacted.getValue()).toBe(value);
  });

  it('should return [REDACTED] for toString', () => {
    const redacted = Redacted.make('secret');
    expect(redacted.toString()).toBe('[REDACTED]');
  });

  it('should return [REDACTED] for toJSON', () => {
    const redacted = Redacted.make('secret');
    expect(redacted.toJSON()).toBe('[REDACTED]');
  });

  it('should return [REDACTED] for inspect', () => {
    const redacted = Redacted.make('secret');
    expect(redacted.inspect()).toBe('[REDACTED]');
  });

  it('should compare two Redacted instances', () => {
    const redacted1 = Redacted.make('secret');
    const redacted2 = Redacted.make('secret');
    const redacted3 = Redacted.make('another-secret');
    expect(redacted1.equals(redacted2)).toBe(true);
    expect(redacted1.equals(redacted3)).toBe(false);
  });

  it('should identify a Redacted instance', () => {
    const redacted = Redacted.make('secret');
    expect(Redacted.isRedacted(redacted)).toBe(true);
    expect(Redacted.isRedacted('secret')).toBe(false);
  });

  it('should return the original value with valueOf', () => {
    const value = 'secret';
    const redacted = Redacted.make(value);
    expect(redacted.valueOf()).toBe(value);
  });
});
