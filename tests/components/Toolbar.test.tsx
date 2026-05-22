// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from '@/components/Toolbar';
import { EXAMPLES } from '@/lib/examples';
import type { CompileStatus, RunStatus } from '@/lib/types';

function makeProps(overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  return {
    compileStatus: 'idle' as CompileStatus,
    runStatus: 'idle' as RunStatus,
    compiledFjm: null,
    onCompile: vi.fn(),
    onDownloadFjm: vi.fn(),
    onDownloadFjProject: vi.fn(),
    onRunFj: vi.fn(),
    onRunFjm: vi.fn(),
    onKill: vi.fn(),
    onImportBf: vi.fn(),
    onImportC: vi.fn(),
    onImportFj: vi.fn(),
    onImportError: vi.fn(),
    onImportFjm: vi.fn(),
    onLoadExample: vi.fn(),
    onOpenDocs: vi.fn(),
    c2fjOutput: null,
    onRunC2fjSource: vi.fn(),
    ...overrides,
  };
}

describe('Toolbar', () => {
  it('renders the FlipJump IDE logo', () => {
    render(<Toolbar {...makeProps()} />);
    expect(screen.getByText('FlipJump IDE')).toBeInTheDocument();
  });

  it('calls onCompile when Compile is clicked', () => {
    const onCompile = vi.fn();
    render(<Toolbar {...makeProps({ onCompile })} />);
    fireEvent.click(screen.getByTitle('Compile FJ → FJM'));
    expect(onCompile).toHaveBeenCalledOnce();
  });

  it('disables Compile button while compiling', () => {
    render(<Toolbar {...makeProps({ compileStatus: 'compiling' })} />);
    expect(screen.getByTitle('Compile FJ → FJM')).toBeDisabled();
  });

  it('disables Compile button while running', () => {
    render(<Toolbar {...makeProps({ runStatus: 'running' })} />);
    expect(screen.getByTitle('Compile FJ → FJM')).toBeDisabled();
  });

  it('shows Kill button and calls onKill when process is running', () => {
    const onKill = vi.fn();
    render(<Toolbar {...makeProps({ runStatus: 'running', onKill })} />);
    const killBtn = screen.getByTitle('Kill process');
    expect(killBtn).toBeInTheDocument();
    expect(killBtn.textContent).toContain('Kill');
    fireEvent.click(killBtn);
    expect(onKill).toHaveBeenCalledOnce();
  });

  it('shows Run FJ (not Kill) when process is idle', () => {
    render(<Toolbar {...makeProps({ runStatus: 'idle' })} />);
    expect(screen.getByTitle('Compile and run FJ online')).toBeInTheDocument();
    expect(screen.queryByTitle('Kill process')).toBeNull();
  });

  it('hides Run FJM button when compiledFjm is null', () => {
    render(<Toolbar {...makeProps({ compiledFjm: null })} />);
    expect(screen.queryByTitle('Run compiled FJM online')).toBeNull();
  });

  it('shows Run FJM button when compiledFjm is non-null', () => {
    render(<Toolbar {...makeProps({ compiledFjm: 'abc123' })} />);
    expect(screen.getByTitle('Run compiled FJM online')).toBeInTheDocument();
  });

  it('hides Run FJM button when running even if compiledFjm is set', () => {
    render(<Toolbar {...makeProps({ compiledFjm: 'abc123', runStatus: 'running' })} />);
    expect(screen.queryByTitle('Run compiled FJM online')).toBeNull();
  });

  it('shows all example names in the dropdown when Examples is clicked', () => {
    render(<Toolbar {...makeProps()} />);
    fireEvent.click(screen.getByTitle('Load a built-in example'));
    for (const ex of EXAMPLES) {
      expect(screen.getByText(ex.name)).toBeInTheDocument();
    }
  });

  it('calls onLoadExample with the clicked example and closes dropdown', () => {
    const onLoadExample = vi.fn();
    render(<Toolbar {...makeProps({ onLoadExample })} />);
    fireEvent.click(screen.getByTitle('Load a built-in example'));
    fireEvent.click(screen.getByText(EXAMPLES[0].name));
    expect(onLoadExample).toHaveBeenCalledWith(EXAMPLES[0]);
    // Dropdown should be gone after selection
    expect(screen.queryByText(EXAMPLES[1].name)).toBeNull();
  });

  it('does not render a Copy Link button (share feature removed)', () => {
    render(<Toolbar {...makeProps()} />);
    expect(screen.queryByText('Copy Link')).toBeNull();
    expect(screen.queryByText('Copied!')).toBeNull();
  });

  it('does not render a Short Link button (spoo.me removed)', () => {
    render(<Toolbar {...makeProps()} />);
    expect(screen.queryByText('Short Link')).toBeNull();
    expect(screen.queryByText('Shortening…')).toBeNull();
  });

  it('calls onOpenDocs when Docs is clicked', () => {
    const onOpenDocs = vi.fn();
    render(<Toolbar {...makeProps({ onOpenDocs })} />);
    fireEvent.click(screen.getByTitle('Open language reference and STL viewer'));
    expect(onOpenDocs).toHaveBeenCalledOnce();
  });
});
