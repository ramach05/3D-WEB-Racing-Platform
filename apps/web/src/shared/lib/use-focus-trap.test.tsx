import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useFocusTrap } from './use-focus-trap';

const Harness = () => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap({ active: open, containerRef: panelRef });

  return (
    <div>
      <button type="button" onClick={() => setOpen((current) => !current)}>
        opener
      </button>
      {open ? (
        <div ref={panelRef}>
          <button type="button">first</button>
          <button type="button">middle</button>
          <button type="button">last</button>
        </div>
      ) : null}
    </div>
  );
};

const activeText = (): string => (document.activeElement?.textContent ?? '').trim();

describe('useFocusTrap', () => {
  it('focuses the first control on open and returns focus to the opener on close', () => {
    render(<Harness />);

    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    fireEvent.click(opener);
    expect(activeText()).toBe('first');

    fireEvent.click(opener);
    expect(activeText()).toBe('opener');
  });

  it('wraps Tab at both ends of the container', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'opener' }));

    screen.getByRole('button', { name: 'last' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(activeText()).toBe('first');

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(activeText()).toBe('last');
  });

  it('pulls focus back into the container when it escaped', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'opener' }));
    screen.getByRole('button', { name: 'opener' }).focus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(activeText()).toBe('first');
  });
});
