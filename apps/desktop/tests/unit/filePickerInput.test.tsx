import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

// Hoisted mock so the module instance imported by FilePickerInput sees the
// same vi.fn() handles we'll assert against in each test.
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    pickAndSave: vi.fn(),
    resolve: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/assets', () => ({
  assetsApi: mockApi,
  IMAGE_EXTS: ['png', 'jpg', 'jpeg', 'webp'] as const,
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `tauri://asset/${p}`,
}));

vi.mock('@/lib/auth', () => ({
  isTauri: () => false,
}));

import { FilePickerInput } from '@/components/shared/FilePickerInput';

i18n.init({
  lng: 'id',
  fallbackLng: 'id',
  resources: {
    id: {
      common: {
        filePicker: { pick: 'Pilih file…', clear: 'Hapus file' },
      },
    },
  },
  interpolation: { escapeValue: false },
});

function renderPicker(props: Partial<Parameters<typeof FilePickerInput>[0]> = {}) {
  const onChange = props.onChange ?? vi.fn();
  return {
    onChange,
    ...render(
      <I18nextProvider i18n={i18n}>
        <FilePickerInput
          value={null}
          onChange={onChange}
          category="anggota"
          testId="picker"
          {...props}
        />
      </I18nextProvider>,
    ),
  };
}

describe('FilePickerInput', () => {
  beforeEach(() => {
    mockApi.pickAndSave.mockReset();
    mockApi.resolve.mockReset();
    mockApi.delete.mockReset();
  });

  it('renders the empty state with a single pick button when value is null', () => {
    renderPicker({ value: null });
    expect(screen.getByTestId('picker-pick')).toBeInTheDocument();
    expect(screen.queryByTestId('picker-clear')).toBeNull();
    expect(screen.queryByTestId('picker-preview')).toBeNull();
  });

  it('uses caller-provided pick / clear labels when supplied', () => {
    mockApi.resolve.mockResolvedValue('/abs/uploads/anggota/x.jpg');
    renderPicker({
      value: 'uploads/anggota/x.jpg',
      pickLabel: 'Pilih foto…',
      clearLabel: 'Hapus foto',
    });
    expect(screen.getByTestId('picker-pick')).toHaveTextContent('Pilih foto…');
    expect(screen.getByTestId('picker-clear')).toHaveTextContent('Hapus foto');
  });

  it('resolves the relative path and renders a preview image when value is set', async () => {
    mockApi.resolve.mockResolvedValue('/abs/uploads/anggota/x.jpg');
    renderPicker({ value: 'uploads/anggota/x.jpg' });

    await waitFor(() => {
      expect(mockApi.resolve).toHaveBeenCalledWith('uploads/anggota/x.jpg');
    });
    const img = await screen.findByTestId('picker-preview');
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', '/abs/uploads/anggota/x.jpg');
  });

  it('falls back to the placeholder when resolve returns an empty string', async () => {
    mockApi.resolve.mockResolvedValue('');
    renderPicker({ value: 'uploads/anggota/missing.jpg' });
    await waitFor(() => {
      expect(mockApi.resolve).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('picker-preview')).toBeNull();
  });

  it('calls onChange with the new relative path after picking a file', async () => {
    mockApi.pickAndSave.mockResolvedValue({
      relPath: 'uploads/anggota/andi-1.png',
      absPath: '/abs/uploads/anggota/andi-1.png',
    });
    const { onChange } = renderPicker({ value: null });

    fireEvent.click(screen.getByTestId('picker-pick'));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('uploads/anggota/andi-1.png');
    });
    expect(mockApi.pickAndSave).toHaveBeenCalledWith('anggota');
    // No previous value, so delete must NOT be called.
    expect(mockApi.delete).not.toHaveBeenCalled();
  });

  it('does not call onChange when the user dismisses the dialog', async () => {
    mockApi.pickAndSave.mockResolvedValue(null);
    const { onChange } = renderPicker({ value: null });

    fireEvent.click(screen.getByTestId('picker-pick'));

    await waitFor(() => {
      expect(mockApi.pickAndSave).toHaveBeenCalled();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('deletes the previous file when replacing an existing value', async () => {
    mockApi.resolve.mockResolvedValue('/abs/uploads/anggota/old.png');
    mockApi.pickAndSave.mockResolvedValue({
      relPath: 'uploads/anggota/new.png',
      absPath: '/abs/uploads/anggota/new.png',
    });
    mockApi.delete.mockResolvedValue(undefined);
    const { onChange } = renderPicker({ value: 'uploads/anggota/old.png' });

    fireEvent.click(screen.getByTestId('picker-pick'));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('uploads/anggota/new.png');
    });
    expect(mockApi.delete).toHaveBeenCalledWith('uploads/anggota/old.png');
  });

  it('calls onChange(null) and deletes the file when clear is clicked', async () => {
    mockApi.resolve.mockResolvedValue('/abs/uploads/anggota/x.png');
    mockApi.delete.mockResolvedValue(undefined);
    const { onChange } = renderPicker({ value: 'uploads/anggota/x.png' });

    const clearBtn = await screen.findByTestId('picker-clear');
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(null);
    });
    expect(mockApi.delete).toHaveBeenCalledWith('uploads/anggota/x.png');
  });

  it('still calls onChange(null) when delete throws (DB row should still drop the reference)', async () => {
    mockApi.resolve.mockResolvedValue('/abs/uploads/anggota/x.png');
    mockApi.delete.mockRejectedValue(new Error('disk full'));
    const { onChange } = renderPicker({ value: 'uploads/anggota/x.png' });

    const clearBtn = await screen.findByTestId('picker-clear');
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });
});
