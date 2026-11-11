export const isStoredFilePath = (value: string): boolean => /^\/files\/[a-zA-Z0-9]{1,128}$/.test(value);

export const resolveDocumentUrl = (value: string): string => {
  try {
    const url = isStoredFilePath(value) ? new URL(value, window.location.origin) : new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch { return ''; }
};
