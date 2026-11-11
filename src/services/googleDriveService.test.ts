import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearGoogleDriveAccess, connectGoogleDrive, uploadPdfToGoogleDrive } from './googleDriveService';

const options = { organizationId: 'org-1', organizationName: 'School', category: 'requirements', description: 'Application form' };

const authorize = async () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client');
  window.google = {
    accounts: { oauth2: { initTokenClient: (config) => ({
      requestAccessToken: () => config.callback({ access_token: 'test-token', expires_in: 3600 }),
    }) } },
  };
  await connectGoogleDrive(options.organizationId);
};

afterEach(() => {
  clearGoogleDriveAccess();
  delete window.google;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Drive PDF uploads', () => {
  it('uploads and shares a PDF and returns student preview/download links', async () => {
    await authorize();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'pdf-1', name: 'form.pdf' }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const result = await uploadPdfToGoogleDrive(new File(['pdf'], 'form.pdf', { type: 'application/pdf' }), options);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ type: 'anyone', role: 'reader' });
    expect(result.driveFileId).toBe('pdf-1');
    expect(result.previewUrl).toContain('/pdf-1/preview');
    expect(result.downloadUrl).toContain('id=pdf-1');
  });

  it('removes the uploaded file when public sharing is blocked', async () => {
    await authorize();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'pdf-1' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: 'Sharing blocked' } }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await expect(uploadPdfToGoogleDrive(new File(['pdf'], 'form.pdf', { type: 'application/pdf' }), options)).rejects.toThrow('Sharing blocked');
    expect(fetchMock.mock.calls[2][1].method).toBe('DELETE');
  });

  it('requires authorization and rejects non-PDF files', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(uploadPdfToGoogleDrive(new File(['text'], 'form.txt', { type: 'text/plain' }), options)).rejects.toThrow('Only PDF');
    await expect(uploadPdfToGoogleDrive(new File(['pdf'], 'form.pdf', { type: 'application/pdf' }), options)).rejects.toThrow('reconnect Google Drive');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
