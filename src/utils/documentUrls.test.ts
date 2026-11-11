import { describe, expect, it } from 'vitest';
import { resolveDocumentUrl } from './documentUrls';
describe('document links', () => {
  it('keeps stored files readable on the current app origin', () => {
    expect(resolveDocumentUrl('/files/receipt123')).toBe(`${window.location.origin}/files/receipt123`);
  });
  it('retains legacy HTTPS download links', () => {
    expect(resolveDocumentUrl('https://drive.google.com/file/d/example/view')).toContain('https://drive.google.com/');
  });
  it('rejects executable schemes and unrelated relative paths', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,test', '/admin-dashboard', '/files/../login', '//evil.example/test']) {
      expect(resolveDocumentUrl(value)).toBe('');
    }
  });
});
