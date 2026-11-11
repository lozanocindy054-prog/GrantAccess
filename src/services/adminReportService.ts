export interface AdminReportData {
  generatedAt: Date;
  filters: string;
  totals: { students: number; organizations: number; scholarships: number; applications: number };
  statuses: Record<string, number>;
  months: Array<{ label: string; count: number }>;
  rows: string[][];
}
export const createAdminReportPdf = async (report: AdminReportData): Promise<{ data: ArrayBuffer; filename: string }> => {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });
  pdf.setProperties({ title: 'GrantAccess Administration Report', author: 'GrantAccess', subject: report.filters });
  pdf.setFillColor(8, 118, 56); pdf.rect(0, 0, 297, 30, 'F');
  try {
    const response = await fetch('/mylogo.png');
    if (response.ok) pdf.addImage(new Uint8Array(await response.arrayBuffer()), 'PNG', 14, 4, 22, 22);
  } catch { /* Text branding remains available if the logo cannot be loaded. */ }
  pdf.setTextColor(255); pdf.setFontSize(19); pdf.text('GrantAccess | Administration Report', 42, 14);
  pdf.setFontSize(10); pdf.text(`Generated ${report.generatedAt.toLocaleString('en-PH')}`, 42, 22);
  pdf.setTextColor(25, 45, 34); pdf.setFontSize(11);
  const filterLines = pdf.splitTextToSize(`Application filters: ${report.filters}`, 265);
  pdf.text(filterLines, 14, 39);
  const summaryY = 43 + filterLines.length * 5;
  pdf.setFontSize(12); pdf.text('Platform totals (all records)', 14, summaryY);
  pdf.setFontSize(10); pdf.text(`Students: ${report.totals.students}   Organizations: ${report.totals.organizations}   Scholarships: ${report.totals.scholarships}   Applications: ${report.totals.applications}`, 14, summaryY + 8);
  pdf.text(`Applications matching filters: ${report.rows.length}`, 14, summaryY + 16);
  const chartY = summaryY + 29;
  pdf.setFontSize(12); pdf.text('Filtered applications by status', 14, chartY);
  const entries = Object.entries(report.statuses);
  const statuses = entries.length > 9 ? [...entries.slice(0, 8), ['Other', entries.slice(8).reduce((sum, [, count]) => sum + count, 0)] as [string, number]] : entries;
  const maxStatus = Math.max(1, ...statuses.map(([, count]) => count));
  pdf.setFontSize(9);
  if (!statuses.length) pdf.text('No matching applications.', 14, chartY + 10);
  statuses.slice(0, 9).forEach(([label, count], index) => {
    const y = chartY + 7 + index * 8;
    pdf.text(pdf.splitTextToSize(label, 34)[0], 14, y + 3); pdf.setFillColor(8, 118, 56); pdf.rect(52, y, 58 * count / maxStatus, 4, 'F'); pdf.text(String(count), 114, y + 3);
  });
  pdf.setFontSize(12); pdf.text('Monthly trend (last 6 months; filtered)', 147, chartY);
  const maxMonth = Math.max(1, ...report.months.map(month => month.count));
  report.months.forEach((month, index) => {
    const x = 151 + index * 21; const height = 48 * month.count / maxMonth;
    pdf.setFillColor(8, 118, 56); pdf.rect(x, chartY + 60 - height, 13, height, 'F'); pdf.setFontSize(9); pdf.text(String(month.count), x + 2, chartY + 56 - height); pdf.text(month.label, x, chartY + 67);
  });
  pdf.addPage(); pdf.setFontSize(16); pdf.text('Application records', 14, 16);
  pdf.setFontSize(10); pdf.text(`${report.rows.length} matching records | ${report.generatedAt.toLocaleDateString('en-PH')}`, 14, 24);
  autoTable(pdf, {
    startY: 30,
    head: [['Application ID', 'Student', 'Email', 'Scholarship', 'Organization', 'Status', 'Submitted']],
    body: report.rows.length ? report.rows : [['No matching records', '', '', '', '', '', '']],
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [8, 118, 56] }, alternateRowStyles: { fillColor: [241, 248, 244] },
    margin: { top: 14, bottom: 18, left: 14, right: 14 },
    rowPageBreak: 'avoid',
  });
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setFontSize(8); pdf.setTextColor(90);
    pdf.text('GrantAccess | Administrative use only', 14, 202); pdf.text(`Page ${page} of ${pages}`, 280, 202, { align: 'right' });
  }
  return { data: pdf.output('arraybuffer'), filename: `grantaccess-report-${report.generatedAt.toISOString().replace(/[:.]/g, '-')}.pdf` };
};
