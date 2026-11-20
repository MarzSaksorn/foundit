import { describe, expect, it } from 'vitest';
import { validateLeadDraft } from './lead-validation';

describe('validateLeadDraft', () => {
  it('rejects an empty or whitespace-only message', () => {
    expect(validateLeadDraft({ message: '', location: '' }).message).toBe('lead.validation.messageTooShort');
    expect(validateLeadDraft({ message: ' \n  ', location: '' }).message).toBe('lead.validation.messageTooShort');
  });

  it('trims before checking the 12-character minimum', () => {
    expect(validateLeadDraft({ message: ' 12345678901 ', location: '' }).message).toBe('lead.validation.messageTooShort');
    expect(validateLeadDraft({ message: ' 123456789012 ', location: '' })).toEqual({});
  });

  it('accepts exactly 1500 trimmed message characters and rejects more', () => {
    expect(validateLeadDraft({ message: 'x'.repeat(1500), location: '' })).toEqual({});
    expect(validateLeadDraft({ message: ` ${'x'.repeat(1501)} `, location: '' }).message).toBe('lead.validation.messageTooLong');
  });

  it('allows an empty or whitespace-only optional location', () => {
    expect(validateLeadDraft({ message: 'A valid observation', location: '' })).toEqual({});
    expect(validateLeadDraft({ message: 'A valid observation', location: '  \n ' })).toEqual({});
  });

  it('accepts 120 trimmed location characters and rejects more', () => {
    expect(validateLeadDraft({ message: 'A valid observation', location: 'x'.repeat(120) })).toEqual({});
    expect(validateLeadDraft({ message: 'A valid observation', location: ` ${'x'.repeat(121)} ` }).location).toBe('lead.validation.locationTooLong');
  });
});
