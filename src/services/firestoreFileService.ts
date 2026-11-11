import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../Firebase/config';

export const MAX_DOCUMENT_BYTES = 650 * 1024;
export const MAX_IMAGE_BYTES = 128 * 1024;
const TYPES: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
export const fileMimeType = (file: File): string => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = TYPES[extension];
  if (!mime || (file.type && file.type !== mime && file.type !== 'application/octet-stream')) throw new Error('Choose a PDF, DOC, DOCX, JPG, PNG, or WebP file.');
  return mime;
};
const readDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('Unable to read this file. Please select it again.'));
  reader.readAsDataURL(file);
});
export const encodeProfileImage = async (file: File): Promise<string> => {
  const mime = fileMimeType(file);
  if (!mime.startsWith('image/')) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 128 KB or smaller. Resize or compress the image first.');
  return readDataUrl(file);
};
export interface FileAccess { organizationId: string; visibility: 'public' | 'private'; }
export const uploadFirestoreFile = async (file: File, access: FileAccess) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in before uploading documents.');
  if (!user.emailVerified) throw new Error('Verify your email before uploading documents.');
  if (!file.size || file.size > MAX_DOCUMENT_BYTES) throw new Error(`${file.name}: files must be 650 KB or smaller. Compress the file first.`);
  const mimeType = fileMimeType(file);
  const dataUrl = await readDataUrl(file);
  const stored = await addDoc(collection(db, 'uploadedFiles'), {
    ownerId: user.uid, organizationId: access.organizationId, visibility: access.visibility,
    name: file.name.slice(0, 180), size: file.size, mimeType,
    dataBase64: dataUrl.slice(dataUrl.indexOf(',') + 1), createdAt: serverTimestamp(),
  });
  const url = `/files/${stored.id}`;
  return { name: file.name.slice(0, 180), url, previewUrl: url, downloadUrl: url, fileId: stored.id, provider: 'firestore' as const, mimeType, size: file.size };
};
export const loadFirestoreFile = async (id: string): Promise<{ name: string; blob: Blob }> => {
  if (!/^[a-zA-Z0-9]{1,128}$/.test(id)) throw new Error('Invalid document link.');
  const snapshot = await getDoc(doc(db, 'uploadedFiles', id));
  if (!snapshot.exists()) throw new Error('This document is no longer available.');
  const data = snapshot.data();
  if (typeof data.dataBase64 !== 'string' || !Object.values(TYPES).includes(data.mimeType)) throw new Error('This document could not be opened.');
  const bytes = Uint8Array.from(atob(data.dataBase64), character => character.charCodeAt(0));
  return { name: String(data.name || 'document'), blob: new Blob([bytes], { type: data.mimeType }) };
};

export const setStoredFileVisibility = async (url: string, visibility: 'public' | 'private'): Promise<void> => {
  const match = url.match(/^\/files\/([a-zA-Z0-9]{1,128})$/);
  if (match) await updateDoc(doc(db, 'uploadedFiles', match[1]), { visibility });
};
