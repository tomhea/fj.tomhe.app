// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileTree from '@/components/FileTree';
import type { FJFile } from '@/lib/types';

function makeFile(id: string, name: string): FJFile {
  return { id, name, content: '' };
}

const BASE_PROPS = {
  sources: [],
  activeSourceIdx: null,
  collapsed: false,
  onToggleCollapsed: vi.fn(),
  onSelectFile: vi.fn(),
  onSelectSource: vi.fn(),
  onCreateFile: vi.fn(),
  onRenameFile: vi.fn(),
  onDeleteFile: vi.fn(),
  onDeleteSource: vi.fn(),
  onReorderFiles: vi.fn(),
};

function makeProps(
  files: FJFile[],
  activeFileId: string,
  overrides: Partial<typeof BASE_PROPS> = {},
) {
  return { ...BASE_PROPS, files, activeFileId, ...overrides };
}

describe('FileTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all file names', () => {
    const files = [makeFile('1', 'main.fj'), makeFile('2', 'lib.fj')];
    render(<FileTree {...makeProps(files, '1')} />);
    expect(screen.getByText('main.fj')).toBeInTheDocument();
    expect(screen.getByText('lib.fj')).toBeInTheDocument();
  });

  it('calls onSelectFile with the correct id when a file is clicked', () => {
    const onSelectFile = vi.fn();
    const files = [makeFile('1', 'main.fj'), makeFile('2', 'lib.fj')];
    render(<FileTree {...makeProps(files, '1', { onSelectFile })} />);
    fireEvent.click(screen.getByText('lib.fj'));
    expect(onSelectFile).toHaveBeenCalledWith('2');
  });

  it('shows an input with "untitled.fj" after clicking the new-file button', () => {
    const files = [makeFile('1', 'main.fj')];
    render(<FileTree {...makeProps(files, '1')} />);
    fireEvent.click(screen.getByTitle('New file'));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('untitled.fj');
  });

  it('calls onCreateFile with the entered name on Enter', () => {
    const onCreateFile = vi.fn();
    const files = [makeFile('1', 'main.fj')];
    render(<FileTree {...makeProps(files, '1', { onCreateFile })} />);
    fireEvent.click(screen.getByTitle('New file'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'newfile.fj' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCreateFile).toHaveBeenCalledWith('newfile.fj');
  });

  it('cancels new file input on Escape without calling onCreateFile', () => {
    const onCreateFile = vi.fn();
    const files = [makeFile('1', 'main.fj')];
    render(<FileTree {...makeProps(files, '1', { onCreateFile })} />);
    fireEvent.click(screen.getByTitle('New file'));
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCreateFile).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows an error message when creating a file with a duplicate name', () => {
    const files = [makeFile('1', 'main.fj')];
    render(<FileTree {...makeProps(files, '1')} />);
    fireEvent.click(screen.getByTitle('New file'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'main.fj' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  it('shows Rename and Delete in context menu on right-click', () => {
    const files = [makeFile('1', 'main.fj'), makeFile('2', 'lib.fj')];
    render(<FileTree {...makeProps(files, '1')} />);
    fireEvent.contextMenu(screen.getByText('main.fj'));
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onDeleteFile when Delete is clicked and there are multiple files', () => {
    const onDeleteFile = vi.fn();
    const files = [makeFile('1', 'main.fj'), makeFile('2', 'lib.fj')];
    render(<FileTree {...makeProps(files, '1', { onDeleteFile })} />);
    fireEvent.contextMenu(screen.getByText('lib.fj'));
    fireEvent.click(screen.getByText('Delete'));
    expect(onDeleteFile).toHaveBeenCalledWith('2');
  });

  it('calls onDeleteFile even when deleting the only remaining file (IDE will create untitled.fj)', () => {
    const onDeleteFile = vi.fn();
    const files = [makeFile('1', 'main.fj')];
    render(<FileTree {...makeProps(files, '1', { onDeleteFile })} />);
    fireEvent.contextMenu(screen.getByText('main.fj'));
    fireEvent.click(screen.getByText('Delete'));
    expect(onDeleteFile).toHaveBeenCalledWith('1');
  });

  it('renders a narrow strip when collapsed=true', () => {
    const files = [makeFile('1', 'main.fj')];
    const { container } = render(<FileTree {...makeProps(files, '1', { collapsed: true })} />);
    // Collapsed sidebar is 32px wide
    const root = container.firstChild as HTMLElement;
    expect(root.style.width).toBe('32px');
    // File list is not rendered
    expect(screen.queryByText('main.fj')).toBeNull();
  });
});
