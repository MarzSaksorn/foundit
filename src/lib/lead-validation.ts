export type LeadDraft = { message: string; location: string };

export function validateLeadDraft(draft: LeadDraft): Partial<Record<keyof LeadDraft, string>> {
  const errors: Partial<Record<keyof LeadDraft, string>> = {};
  const message = draft.message.trim();
  const location = draft.location.trim();

  if (message.length === 0 || message.length < 12) {
    errors.message = 'lead.validation.messageTooShort';
  } else if (message.length > 1500) {
    errors.message = 'lead.validation.messageTooLong';
  }

  if (location.length > 120) {
    errors.location = 'lead.validation.locationTooLong';
  }

  return errors;
}
