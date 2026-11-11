import { expect, it, vi } from 'vitest';
import { createAdminReportPdf, type AdminReportData } from './adminReportService';
const report = (rows: string[][]): AdminReportData => ({ generatedAt: new Date('2026-11-12T00:00:00Z'), filters: 'Status: Approved', totals: { students: 4, organizations: 2, scholarships: 3, applications: 9 }, statuses: { Approved: rows.length }, months: [{ label: 'Nov', count: rows.length }], rows });
it('generates a real PDF containing filters, summary, analytics and application data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Logo unavailable')));
  try {
    const result = await createAdminReportPdf(report([['app1', 'Ana Santos', 'ana@example.com', 'STEM Grant', 'City School', 'Approved', 'Nov 12, 2026']]));
    const text = new TextDecoder().decode(result.data);
    expect(text.startsWith('%PDF-')).toBe(true); expect(text).toContain('Ana Santos'); expect(text).toContain('Status: Approved'); expect(text).toContain('Platform totals'); expect(result.filename).toMatch(/\.pdf$/);
  } finally { vi.unstubAllGlobals(); }
});
it('paginates large reports without dropping the last application', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Logo unavailable')));
  try {
    const rows = Array.from({ length: 160 }, (_, index) => [String(index), `Student ${index}`, 'student@example.com', 'Grant', 'School', 'Approved', 'Nov 12']);
    const result = await createAdminReportPdf(report(rows)); const text = new TextDecoder().decode(result.data);
    expect(text).toContain('Student 159'); expect((text.match(/\/Type \/Page\b/g) || []).length).toBeGreaterThan(2);
  } finally { vi.unstubAllGlobals(); }
});
it('generates an empty report with an explicit no-matching-records message', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Logo unavailable')));
  try { const result = await createAdminReportPdf(report([])); expect(new TextDecoder().decode(result.data)).toContain('No matching records'); }
  finally { vi.unstubAllGlobals(); }
});
