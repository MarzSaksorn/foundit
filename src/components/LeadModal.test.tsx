import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeadModal from './LeadModal';
import { setLanguage } from '../lib/i18n';

afterEach(() => {
  cleanup();
  setLanguage('en');
});

function renderLeadModal(onSubmit: (input: { message: string; sightingLocation?: string }) => Promise<void>, onClose = vi.fn()) {
  return { onClose, ...render(<LeadModal reportTitle="Blue water bottle" onClose={onClose} onSubmit={onSubmit} />) };
}

describe('LeadModal', () => {
  it('renders labeled required message and optional location controls in English', () => {
    renderLeadModal(vi.fn().mockResolvedValue(undefined));
    expect(screen.getByRole('heading', { name: 'Send a private lead' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /What did you notice\?/i })).toBeRequired();
    expect(screen.getByRole('textbox', { name: /Approximate location/i })).toBeInTheDocument();
    expect(screen.getByText(/private to the report owner and authorized school staff/i)).toBeInTheDocument();
  });

  it('renders translated labels and privacy text in Thai', () => {
    setLanguage('th');
    renderLeadModal(vi.fn().mockResolvedValue(undefined));
    expect(screen.getByRole('heading', { name: 'ส่งเบาะแสส่วนตัว' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /คุณสังเกตเห็นอะไร/i })).toBeRequired();
    expect(screen.getByRole('textbox', { name: /สถานที่โดยประมาณ/i })).toBeInTheDocument();
    expect(screen.getByText(/ข้อความนี้เป็นส่วนตัวสำหรับเจ้าของรายงาน/)).toBeInTheDocument();
  });

  it('shows associated accessible field errors and does not submit invalid values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderLeadModal(onSubmit);
    const message = screen.getByRole('textbox', { name: /What did you notice\?/i });
    await user.type(message, 'Too short');
    await user.click(screen.getByRole('button', { name: 'Send lead' }));
    expect(await screen.findByText('Enter at least 12 characters for your message.')).toBeInTheDocument();
    expect(message).toHaveAttribute('aria-invalid', 'true');
    expect(message).toHaveAttribute('aria-describedby', 'lead-message-error');
    expect(onSubmit).not.toHaveBeenCalled();

    await user.clear(message);
    await user.type(message, 'A sufficiently detailed observation');
    const location = screen.getByRole('textbox', { name: /Approximate location/i });
    await user.type(location, 'x'.repeat(121));
    await user.click(screen.getByRole('button', { name: 'Send lead' }));
    expect(await screen.findByText('Keep the location to 120 characters or fewer.')).toBeInTheDocument();
    expect(location).toHaveAttribute('aria-invalid', 'true');
    expect(location).toHaveAttribute('aria-describedby', 'lead-location-error');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits normalized values once and leaves closing to the parent', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderLeadModal(onSubmit, onClose);
    await user.type(screen.getByRole('textbox', { name: /What did you notice\?/i }), '  I saw the item near class  ');
    await user.type(screen.getByRole('textbox', { name: /Approximate location/i }), '  Library entrance  ');
    await user.click(screen.getByRole('button', { name: 'Send lead' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ message: 'I saw the item near class', sightingLocation: 'Library entrance' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('blocks duplicate submits while pending', async () => {
    const user = userEvent.setup();
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { resolveSubmit = resolve; }));
    renderLeadModal(onSubmit);
    await user.type(screen.getByRole('textbox', { name: /What did you notice\?/i }), 'A sufficiently detailed observation');
    const submit = screen.getByRole('button', { name: 'Send lead' });
    await user.click(submit);
    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Sending…' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolveSubmit?.();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send lead' })).toBeEnabled());
  });

  it('shows a retryable submit error and succeeds on retry', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    renderLeadModal(onSubmit);
    await user.type(screen.getByRole('textbox', { name: /What did you notice\?/i }), 'A sufficiently detailed observation');
    await user.click(screen.getByRole('button', { name: 'Send lead' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t send your lead. Please try again.');
    await user.click(screen.getByRole('button', { name: 'Send lead' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes from cancel and the dialog close control', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderLeadModal(vi.fn().mockResolvedValue(undefined), onClose);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();
    renderLeadModal(vi.fn().mockResolvedValue(undefined), onClose);
    await user.click(screen.getByRole('button', { name: 'Close lead form' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
