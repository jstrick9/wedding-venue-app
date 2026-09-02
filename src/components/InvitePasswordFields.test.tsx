import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { InvitePasswordFields } from './InvitePasswordFields';

function Harness() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  return (
    <InvitePasswordFields
      idPrefix="test"
      password={password}
      confirmPassword={confirmation}
      onPasswordChange={setPassword}
      onConfirmPasswordChange={setConfirmation}
    />
  );
}

describe('InvitePasswordFields', () => {
  it('live-validates every requirement and password equality', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const password = screen.getByLabelText(/^new password$/i);
    const confirmation = screen.getByLabelText(/^confirm new password$/i);
    await user.type(password, 'Valid#12');

    expect(screen.getByText('At least 8 characters').closest('li')).toHaveClass('text-emerald-700');
    expect(screen.getByText('One uppercase letter').closest('li')).toHaveClass('text-emerald-700');
    expect(screen.getByText('One lowercase letter').closest('li')).toHaveClass('text-emerald-700');
    expect(screen.getByText('One number').closest('li')).toHaveClass('text-emerald-700');
    expect(screen.getByText('One special character').closest('li')).toHaveClass('text-emerald-700');

    await user.type(confirmation, 'Valid#1');
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    await user.type(confirmation, '2');
    expect(screen.getByText(/passwords match/i)).toBeInTheDocument();
  });

  it('reveals and hides each password independently', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const password = screen.getByLabelText(/^new password$/i);
    const confirmation = screen.getByLabelText(/^confirm new password$/i);
    expect(password).toHaveAttribute('type', 'password');
    expect(confirmation).toHaveAttribute('type', 'password');

    const revealPassword = screen.getByRole('button', { name: /show new password/i });
    expect(revealPassword).toHaveAttribute('aria-pressed', 'false');
    await user.click(revealPassword);
    expect(password).toHaveAttribute('type', 'text');
    expect(revealPassword).toHaveAttribute('aria-pressed', 'true');
    expect(confirmation).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /show confirmed password/i }));
    expect(confirmation).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: /hide new password/i }));
    expect(password).toHaveAttribute('type', 'password');
  });
});
