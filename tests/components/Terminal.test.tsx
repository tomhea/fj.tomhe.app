// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Terminal from '@/components/Terminal';
import type { TerminalLine, RunStatus } from '@/lib/types';

function line(
  id: number,
  type: TerminalLine['type'],
  text: string,
): TerminalLine {
  return { id, type, text };
}

const BASE_PROPS = {
  lines: [] as TerminalLine[],
  runStatus: 'idle' as RunStatus,
  onSendStdin: vi.fn(),
  onClear: vi.fn(),
  onKill: vi.fn(),
  stdinContent: '',
  onStdinContentChange: vi.fn(),
};

describe('Terminal', () => {
  it('shows the ready placeholder when lines is empty', () => {
    render(<Terminal {...BASE_PROPS} />);
    expect(screen.getByText(/Ready\./i)).toBeInTheDocument();
  });

  it('renders stdout lines', () => {
    const props = { ...BASE_PROPS, lines: [line(1, 'stdout', 'Hello, World!')] };
    render(<Terminal {...props} />);
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });

  it('renders stderr lines', () => {
    const props = { ...BASE_PROPS, lines: [line(1, 'stderr', 'Error: crash')] };
    render(<Terminal {...props} />);
    expect(screen.getByText('Error: crash')).toBeInTheDocument();
  });

  it('renders info lines', () => {
    const props = { ...BASE_PROPS, lines: [line(1, 'info', 'Compiled OK')] };
    render(<Terminal {...props} />);
    expect(screen.getByText('Compiled OK')).toBeInTheDocument();
  });

  it('renders error lines', () => {
    const props = { ...BASE_PROPS, lines: [line(1, 'error', 'Fatal error')] };
    render(<Terminal {...props} />);
    expect(screen.getByText('Fatal error')).toBeInTheDocument();
  });

  it('shows the Running indicator when runStatus is running', () => {
    render(<Terminal {...BASE_PROPS} runStatus="running" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('does not show Running indicator when runStatus is idle', () => {
    render(<Terminal {...BASE_PROPS} runStatus="idle" />);
    expect(screen.queryByText('Running')).toBeNull();
  });

  it('enables stdin input when running', () => {
    render(<Terminal {...BASE_PROPS} runStatus="running" />);
    const input = screen.getByPlaceholderText(/Type stdin and press Enter/i);
    expect(input).not.toBeDisabled();
  });

  it('disables stdin input when not running', () => {
    render(<Terminal {...BASE_PROPS} runStatus="idle" />);
    const input = screen.getByPlaceholderText(/Run a program/i);
    expect(input).toBeDisabled();
  });

  it('calls onSendStdin with value + newline on Enter, then clears input', () => {
    const onSendStdin = vi.fn();
    render(<Terminal {...BASE_PROPS} runStatus="running" onSendStdin={onSendStdin} />);
    const input = screen.getByPlaceholderText(/Type stdin/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSendStdin).toHaveBeenCalledWith('hello\n');
    expect(input.value).toBe('');
  });

  it('calls onClear when Clear is clicked', () => {
    const onClear = vi.fn();
    render(<Terminal {...BASE_PROPS} onClear={onClear} />);
    fireEvent.click(screen.getByTitle('Clear terminal'));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('shows the Pre-set Stdin tab and renders stdinContent in the textarea', () => {
    // Use a JS expression (not a JSX string literal) so \n is a real newline.
    render(<Terminal {...BASE_PROPS} stdinContent={'line1\nline2'} />);
    fireEvent.click(screen.getByText('Pre-set Stdin'));
    const textarea = screen.getByPlaceholderText(/Enter stdin content/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('line1\nline2');
  });

  it('calls onStdinContentChange when Pre-set Stdin textarea changes', () => {
    const onStdinContentChange = vi.fn();
    render(<Terminal {...BASE_PROPS} onStdinContentChange={onStdinContentChange} />);
    fireEvent.click(screen.getByText('Pre-set Stdin'));
    const textarea = screen.getByPlaceholderText(/Enter stdin content/i);
    fireEvent.change(textarea, { target: { value: 'new input' } });
    expect(onStdinContentChange).toHaveBeenCalledWith('new input');
  });

  it('collapses and expands when the collapse button is clicked', () => {
    render(<Terminal {...BASE_PROPS} />);
    // Initially shows '▼' (collapse to smaller)
    const collapseBtn = screen.getByTitle('Collapse');
    fireEvent.click(collapseBtn);
    // Now shows '▲' (expand)
    expect(screen.getByTitle('Expand')).toBeInTheDocument();
    // Click again to re-expand
    fireEvent.click(screen.getByTitle('Expand'));
    expect(screen.getByTitle('Collapse')).toBeInTheDocument();
  });
});
