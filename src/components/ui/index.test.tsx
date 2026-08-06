import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, Card, Badge, EmptyState, SectionHeader } from './index';

describe('shared UI kit', () => {
  it('renders a primary Button and fires onClick', () => {
    const onClick = () => {};
    render(<Button tone="primary" onClick={onClick}>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeTruthy();
    fireEvent.click(btn); // no throw
  });

  it('renders Badge, Card, EmptyState, SectionHeader', () => {
    render(
      <Card>
        <SectionHeader title="Overview" subtitle="Sub" />
        <Badge tone="success">Ready</Badge>
        <EmptyState title="Nothing here" />
      </Card>,
    );
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });
});
