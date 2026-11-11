import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeProfileImage, loadFirestoreFile, MAX_DOCUMENT_BYTES, uploadFirestoreFile } from './firestoreFileService';
const mocks = vi.hoisted(() => ({ addDoc: vi.fn(), getDoc: vi.fn(), auth: { currentUser: null as null | { uid: string; emailVerified: boolean } } }));
vi.mock('../Firebase/config', () => ({ auth: mocks.auth, db: {} }));
vi.mock('firebase/firestore', () => ({
  addDoc: mocks.addDoc, getDoc: mocks.getDoc, collection: vi.fn(), doc: vi.fn(),
  updateDoc: vi.fn(), serverTimestamp: () => 'server-time',
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.currentUser = { uid: 'student', emailVerified: true };
  mocks.addDoc.mockResolvedValue({ id: 'file123' });
});
describe('Firestore files', () => {
  it('stores a private receipt with owner and recipient access metadata', async () => {
    const result = await uploadFirestoreFile(new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' }), { organizationId: 'school', visibility: 'private' });
    expect(mocks.addDoc.mock.calls[0][1]).toMatchObject({ ownerId: 'student', organizationId: 'school', visibility: 'private', dataBase64: btoa('receipt'), size: 7 });
    expect(result.url).toBe('/files/file123');
  });
  it('rejects oversized and unsafe files before writing', async () => {
    const access = { organizationId: 'school', visibility: 'private' as const };
    await expect(uploadFirestoreFile(new File([new Uint8Array(MAX_DOCUMENT_BYTES + 1)], 'large.pdf'), access)).rejects.toThrow('650 KB');
    await expect(uploadFirestoreFile(new File(['<script>'], 'receipt.html', { type: 'text/html' }), access)).rejects.toThrow('Choose a PDF');
    expect(mocks.addDoc).not.toHaveBeenCalled();
  });
  it('requires a verified signed-in account', async () => {
    mocks.auth.currentUser = { uid: 'student', emailVerified: false };
    await expect(uploadFirestoreFile(new File(['pdf'], 'receipt.pdf'), { organizationId: 'school', visibility: 'private' })).rejects.toThrow('Verify your email');
    expect(mocks.addDoc).not.toHaveBeenCalled();
  });
  it('decodes a stored PDF for preview and download', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: 'receipt.pdf', dataBase64: btoa('receipt'), mimeType: 'application/pdf' }) });
    const result = await loadFirestoreFile('file123');
    expect(result.name).toBe('receipt.pdf');
    expect(result.blob.type).toBe('application/pdf');
    expect(result.blob.size).toBe(7);
  });
  it('keeps embedded images small and blocks SVG', async () => {
    await expect(encodeProfileImage(new File([new Uint8Array(128 * 1024 + 1)], 'logo.png', { type: 'image/png' }))).rejects.toThrow('128 KB');
    await expect(encodeProfileImage(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }))).rejects.toThrow('Choose a PDF');
  });
});
