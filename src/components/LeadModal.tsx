import { useRef, useState, type FormEvent } from 'react';
import { Button, Description, FieldError, Form, Label, Modal, TextArea, TextField } from '@heroui/react';
import { useI18n } from '../lib/i18n';
import { validateLeadDraft, type LeadDraft } from '../lib/lead-validation';
import type { NewReportLeadInput } from '../lib/live-reports';

export type LeadModalProps = {
  reportTitle: string;
  onClose: () => void;
  onSubmit: (input: NewReportLeadInput) => Promise<void>;
};

export function LeadModal({ reportTitle, onClose, onSubmit }: LeadModalProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<LeadDraft>({ message: '', location: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof LeadDraft, string>>>({});
  const [submitError, setSubmitError] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    const nextErrors = validateLeadDraft(draft);
    setErrors(nextErrors);
    setSubmitError(false);
    if (Object.keys(nextErrors).length > 0) return;

    submitting.current = true;
    setPending(true);
    try {
      const message = draft.message.trim();
      const sightingLocation = draft.location.trim();
      await onSubmit({ message, sightingLocation });
    } catch {
      setSubmitError(true);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <Modal.Backdrop
      className="modal-backdrop"
      isOpen
      isDismissable={!pending}
      isKeyboardDismissDisabled={pending}
      onOpenChange={(open) => { if (!open && !pending) onClose(); }}
    >
      <Modal.Container>
        <Modal.Dialog className="modal lead-modal" aria-labelledby="lead-modal-heading" aria-describedby="lead-modal-intro">
          <Modal.CloseTrigger className="close-button" aria-label={t('Close lead form')} isDisabled={pending}>
            <span aria-hidden="true">×</span>
          </Modal.CloseTrigger>
          <Modal.Header className="modal-header">
            <div>
              <div className="eyebrow"><span className="eyebrow-line purple" />{t('Share a lead')}</div>
              <Modal.Heading id="lead-modal-heading">{t('Send a private lead')}</Modal.Heading>
              <p className="lead-report-title">{reportTitle}</p>
            </div>
          </Modal.Header>
          <Modal.Body>
            <Form className="lead-form" validationBehavior="aria" onSubmit={submit}>
              <p id="lead-modal-intro" className="lead-intro">{t('Tell the report owner what you noticed. You may add an approximate location.')}</p>
              <div className="private-banner" role="note">
                <span aria-hidden="true">▣</span>
                <span>{t('Your note is private to the report owner and authorized school staff. Do not include contact details.')}</span>
              </div>
              <TextField
                className="lead-field"
                isRequired
                fullWidth
                name="message"
                value={draft.message}
                onChange={(message) => { setDraft((current) => ({ ...current, message })); setErrors((current) => ({ ...current, message: undefined })); setSubmitError(false); }}
                isInvalid={Boolean(errors.message)}
                aria-describedby={errors.message ? 'lead-message-error' : 'lead-message-help'}
              >
                <Label>{t('What did you notice?')} <span aria-hidden="true">*</span></Label>
                <TextArea placeholder={t('Describe what you saw or know…')} rows={5} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'lead-message-error' : 'lead-message-help'} />
                {errors.message ? <FieldError id="lead-message-error" className="form-error">{t(errors.message)}</FieldError> : <Description id="lead-message-help">{t('Required · 12–1,500 characters')}</Description>}
              </TextField>
              <TextField
                className="lead-field"
                fullWidth
                name="location"
                value={draft.location}
                onChange={(location) => { setDraft((current) => ({ ...current, location })); setErrors((current) => ({ ...current, location: undefined })); setSubmitError(false); }}
                isInvalid={Boolean(errors.location)}
                aria-describedby={errors.location ? 'lead-location-error' : 'lead-location-help'}
              >
                <Label>{t('Approximate location')} <span className="optional-label">{t('Optional')}</span></Label>
                <TextArea placeholder={t('For example, near the library…')} rows={2} aria-invalid={Boolean(errors.location)} aria-describedby={errors.location ? 'lead-location-error' : 'lead-location-help'} />
                {errors.location ? <FieldError id="lead-location-error" className="form-error">{t(errors.location)}</FieldError> : <Description id="lead-location-help">{t('Up to 120 characters. Do not share a phone number or email.')}</Description>}
              </TextField>
              {submitError && <p className="lead-submit-error" role="alert" aria-live="assertive">{t('We couldn’t send your lead. Please try again.')}</p>}
              <Modal.Footer className="modal-footer">
                <Button variant="secondary" type="button" isDisabled={pending} onPress={onClose}>{t('Cancel')}</Button>
                <Button className="button primary" variant="primary" type="submit" isPending={pending} isDisabled={pending}>{t(pending ? 'Sending…' : 'Send lead')}</Button>
              </Modal.Footer>
            </Form>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export default LeadModal;
