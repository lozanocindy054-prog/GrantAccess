import { createAdminReportPdf } from '../../services/adminReportService';
import { logoutAdministrator } from '../../services/adminService';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IonPage,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/react';

import {
  gridOutline,
  barChartOutline,
  notificationsOutline,
  timeOutline,
  settingsOutline,
  logOutOutline,
  analyticsOutline,
  peopleOutline,
  documentTextOutline,
  downloadOutline,
  searchOutline,
  refreshOutline,
  businessOutline,
} from 'ionicons/icons';

import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../Firebase/config';
import './AdminReports.css';
import { parseDate } from '../../utils/dates';

interface ReportRecord {
  id: string;
  [key: string]: unknown;
}

type DateFilter = 'all' | 'today' | 'month' | 'year' | 'custom';

const menuItems = [
  { label: 'Dashboard', icon: gridOutline, path: '/admin-dashboard' },
  { label: 'Reports & Analytics', icon: barChartOutline, path: '/admin-reports' },
  { label: 'Notifications', icon: notificationsOutline, path: '/admin-notifications' },
  { label: 'Activity Logs', icon: timeOutline, path: '/admin-activity-logs' },
  { label: 'System Settings', icon: settingsOutline, path: '/admin-settings' },
];

const getDate = parseDate;

const getRecordDate = (record: ReportRecord): Date | null =>
  getDate(
    record.createdAt ??
      record.appliedAt ??
      record.submittedAt ??
      record.dateCreated ??
      record.updatedAt ??
      record.timestamp
  );

const getStatus = (record: ReportRecord): string =>
  String(
    record.status ??
      record.applicationStatus ??
      record.reviewStatus ??
      'Pending'
  )
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .trim();

const normalize = (value: unknown): string =>
  String(value ?? '').toLowerCase().trim();

const formatDate = (date: Date | null): string =>
  date
    ? date.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const sameMonth = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth();

const sameYear = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear();

const csvValue = (value: unknown): string => {
  const text = String(value ?? '');
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
};

const studentName = (record: ReportRecord): string =>
  String(  record.studentName ??
  record.fullName ??
  record.name ??
  record.studentEmail ??
  record.email ??
  'Unknown student');

const scholarshipName = (record: ReportRecord): string =>
  String(  record.scholarshipTitle ??
  record.scholarshipName ??
  record.title ??
  'Not specified');

const organizationName = (record: ReportRecord): string =>
  String(  record.organizationName ??
  record.schoolName ??
  record.lguName ??
  record.name ??
  'Unnamed organization');

const AdminReports: React.FC = () => {
  const navigate = useNavigate();

  const [applications, setApplications] = useState<ReportRecord[]>([]);
  const [scholarships, setScholarships] = useState<ReportRecord[]>([]);
  const [students, setStudents] = useState<ReportRecord[]>([]);
  const [organizations, setOrganizations] = useState<ReportRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [reportTab, setReportTab] = useState<'analytics' | 'applications' | 'organizations'>('analytics');
  const [generating, setGenerating] = useState(false);
  const [reportError, setReportError] = useState('');
  const [generatedReport, setGeneratedReport] = useState<{ url: string; filename: string; count: number } | null>(null);
  const reportVersion = useRef(0);
  const invalidRange = dateFilter === 'custom' && Boolean(startDate && endDate && startDate > endDate);

  // Load Firestore collections in real time.
  useEffect(() => {
    const collectionNames = [
      'applications',
      'scholarships',
      'students',
      'organizations',
    ];

    const loadedCollections = new Set<string>();
    const collectionErrors = new Map<string, string>();
    const unsubscribers: Array<() => void> = [];

    const setters: Record<
      string,
      React.Dispatch<React.SetStateAction<ReportRecord[]>>
    > = {
      applications: setApplications,
      scholarships: setScholarships,
      students: setStudents,
      organizations: setOrganizations,
    };

    const markLoaded = (name: string) => {
      loadedCollections.add(name);

      if (loadedCollections.size === collectionNames.length) {
        setLoading(false);
      }
    };

    collectionNames.forEach((name) => {
      const unsubscribe = onSnapshot(
        collection(db, name),
        (snapshot) => {
          setters[name](
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            }))
          );

          collectionErrors.delete(name);
          setError([...collectionErrors.values()].join(' '));
          markLoaded(name);
        },
        (err) => {
          console.error(`Firestore error (${name}):`, err);

          collectionErrors.set(name, `Unable to load ${name}. Check your connection and administrator permissions.`);
          setError([...collectionErrors.values()].join(' '));

          markLoaded(name);
        }
      );

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const filteredApplications = useMemo(() => {
    const now = new Date();
    const searchTerm = normalize(search);

    return applications.filter((record) => {
      const date = getRecordDate(record);

      if (dateFilter !== 'all') {
        if (!date) return false;

        if (dateFilter === 'today' && !sameDay(date, now)) return false;
        if (dateFilter === 'month' && !sameMonth(date, now)) return false;
        if (dateFilter === 'year' && !sameYear(date, now)) return false;

        if (dateFilter === 'custom') {
          if (
            startDate &&
            date < new Date(`${startDate}T00:00:00`)
          ) {
            return false;
          }

          if (
            endDate &&
            date > new Date(`${endDate}T23:59:59.999`)
          ) {
            return false;
          }
        }
      }

      if (
        statusFilter !== 'all' &&
        normalize(getStatus(record)) !== normalize(statusFilter)
      ) {
        return false;
      }

      const searchable = [
        studentName(record),
        record.email,
        record.studentEmail,
        scholarshipName(record),
        record.organizationName,
        organizationName(record),
        getStatus(record),
        record.id,
      ]
        .map(normalize)
        .join(' ');

      return searchable.includes(searchTerm);
    });
  }, [
    applications,
    dateFilter,
    startDate,
    endDate,
    statusFilter,
    search,
  ]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    filteredApplications.forEach((record) => {
      const status = getStatus(record);
      counts[status] = (counts[status] ?? 0) + 1;
    });

    return counts;
  }, [filteredApplications]);

  const pendingCount = applications.filter((record) =>
    normalize(getStatus(record)).includes('pending')
  ).length;

  const approvedCount = applications.filter((record) =>
    ['approved', 'accepted'].includes(normalize(getStatus(record)))
  ).length;

  const rejectedCount = applications.filter((record) =>
    ['rejected', 'declined'].includes(normalize(getStatus(record)))
  ).length;

  const activeScholarships = scholarships.filter((record) => {
    const status = normalize(record.status);

    return (
      record.isActive === true ||
      ['active', 'published', 'open'].includes(status)
    );
  }).length;

  const monthlyData = useMemo(() => {
    const now = new Date();

    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(
        now.getFullYear(),
        now.getMonth() - 5 + index,
        1
      );

      const count = filteredApplications.filter((record) => {
        const date = getRecordDate(record);

        return (
          date &&
          date.getMonth() === monthDate.getMonth() &&
          date.getFullYear() === monthDate.getFullYear()
        );
      }).length;

      return {
        key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
        label: monthDate.toLocaleDateString('en-PH', {
          month: 'short',
        }),
        count,
      };
    });
  }, [filteredApplications]);

  const maxMonthly = Math.max(
    1,
    ...monthlyData.map((item) => item.count)
  );

  const maxStatus = Math.max(
    1,
    ...Object.values(statusCounts)
  );

  useEffect(() => {
    reportVersion.current++;
    setGeneratedReport(null);
    setReportError('');
  }, [filteredApplications, students.length, organizations.length, scholarships.length, applications.length]);
  useEffect(() => () => { if (generatedReport) URL.revokeObjectURL(generatedReport.url); }, [generatedReport]);
  const generatePdf = async () => {
    if (loading || error || invalidRange || generating) return;
    const version = reportVersion.current;
    setGenerating(true); setReportError('');
    try {
      const report = await createAdminReportPdf({
        generatedAt: new Date(),
        filters: `Date: ${dateFilter === 'custom' ? `${startDate || 'Any start'} to ${endDate || 'Any end'}` : dateFilter}; Status: ${statusFilter}; Search: ${search || 'None'}`,
        totals: { students: students.length, organizations: organizations.length, scholarships: scholarships.length, applications: applications.length },
        statuses: statusCounts, months: monthlyData,
        rows: filteredApplications.map(record => [record.id, studentName(record), String(record.studentEmail ?? record.email ?? ''), scholarshipName(record), organizationName(record), getStatus(record), formatDate(getRecordDate(record))]),
      });
      if (version !== reportVersion.current) { setReportError('Records or filters changed while generating. Please generate the report again.'); return; }
      setGeneratedReport({ url: URL.createObjectURL(new Blob([report.data], { type: 'application/pdf' })), filename: report.filename, count: filteredApplications.length });
    } catch (cause) {
      console.error('PDF generation failed:', cause); setReportError('Unable to generate the PDF. Please retry.');
    } finally { setGenerating(false); }
  };

  const exportCsv = () => {
    if (loading || error || invalidRange) return;
    const headers = [
      'Application ID',
      'Student Name',
      'Student Email',
      'Scholarship',
      'Organization',
      'Status',
      'Date Submitted',
    ];

    const rows = filteredApplications.map((record) => [
      record.id,
      studentName(record),
      record.studentEmail ?? record.email ?? '',
      scholarshipName(record),
      record.organizationName ?? organizationName(record),
      getStatus(record),
      formatDate(getRecordDate(record)),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(csvValue).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'grantaccess-reports.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setDateFilter('all');
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
    setSearch('');
  };

  return (
    <IonPage className="admin-page">
      <div className="admin-layout">
        {/* SIDEBAR — same layout as Admin Dashboard */}
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <div className="admin-brand-icon"><img className="grantaccess-brand-image" src="/mylogo.png" alt="GrantAccess" />
            </div>

            <div>
              <h2>GrantAccess</h2>
              <p>Admin Portal</p>
            </div>
          </div>

          <p className="admin-menu-label">MAIN MENU</p>

          <nav className="admin-navigation">
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`admin-nav-item ${
                  item.label === 'Reports & Analytics' ? 'active' : ''
                }`}
                onClick={() => navigate(item.path)}
              >
                <IonIcon icon={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <button
            type="button"
            className="admin-nav-item admin-logout"
            onClick={() => void logoutAdministrator().then(() => navigate('/admin-login', { replace: true })).catch(() => setError('Unable to sign out. Please retry.'))}
          >
            <IonIcon icon={logOutOutline} />
            <span>Logout</span>
          </button>
        </aside>

        {/* MAIN CONTENT */}
        <main className="admin-main">
          <IonContent className="admin-content">
            <div className="admin-reports">
              <div className="reports-breadcrumb">
                GrantAccess / Admin / Reports &amp; Analytics
              </div>

              {/* PAGE HEADER */}
              <header className="reports-heading">
                <div className="reports-heading-copy">
                  <h1>Reports &amp; Analytics</h1>
                  <p className="reports-subtitle">
                    Monitor students, scholarships, applications, and organizations.
                  </p>
                </div>

                <div className="reports-actions" aria-busy={generating}>
                <button type="button" className="reports-export-button reports-pdf-button" onClick={() => void generatePdf()} disabled={loading || Boolean(error) || invalidRange || generating}>
                  <IonIcon icon={documentTextOutline} /><span>{generating ? 'Generating PDF?' : 'Generate PDF'}</span>
                </button>
                <button
                  type="button"
                  className="reports-export-button"
                  onClick={exportCsv}
                  disabled={loading || Boolean(error) || invalidRange || generating}
                >
                  <IonIcon icon={downloadOutline} />
                  <span>Export CSV</span>
                </button>
                </div>
              </header>

              {error && (
                <div className="reports-error" role="alert">
                  {error}
                </div>
              )}

              {reportError && <p className="reports-error" role="alert">{reportError}</p>}
              {invalidRange && <p className="reports-error" role="alert">Start date must be on or before the end date.</p>}
              {generatedReport && <section className="reports-download-ready" aria-live="polite">
                <div><strong>Your PDF report is ready</strong><p>{generatedReport.count} matching application records, platform totals, and analytics.</p></div>
                <a href={generatedReport.url} download={generatedReport.filename}>Download PDF</a>
                <a href={generatedReport.url} target="_blank" rel="noopener noreferrer">Open PDF</a>
              </section>}
              <nav className="reports-tabs" role="tablist" aria-label="Report sections">{(['analytics', 'applications', 'organizations'] as const).map((tab, index, tabs) => <button key={tab} id={`report-tab-${tab}`} type="button" role="tab" aria-selected={reportTab === tab} aria-controls={`report-panel-${tab}`} tabIndex={reportTab === tab ? 0 : -1} onClick={() => setReportTab(tab)} onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                setReportTab(tabs[next]); document.getElementById(`report-tab-${tabs[next]}`)?.focus();
              }}>{tab === 'analytics' ? 'Analytics' : tab === 'applications' ? 'Applications' : 'Organizations'}</button>)}</nav>
              {loading ? (
                <div className="reports-loading">
                  <IonSpinner name="crescent" />
                  <p>Loading Reports &amp; Analytics...</p>
                </div>
              ) : (
                <>
                  {/* SUMMARY CARDS */}
                  <section className="reports-summary-grid">
                    <article className="reports-summary-card">
                      <div className="reports-card-icon green">
                        <IonIcon icon={peopleOutline} />
                      </div>
                      <div className="reports-summary-copy">
                        <p>Registered Students</p>
                        <h2>{students.length.toLocaleString()}</h2>
                        <span>Student records</span>
                      </div>
                    </article>

                    <article className="reports-summary-card">
                      <div className="reports-card-icon blue">
                        <IonIcon icon={documentTextOutline} />
                      </div>
                      <div className="reports-summary-copy">
                        <p>Total Applications</p>
                        <h2>{applications.length.toLocaleString()}</h2>
                        <span>
                          {filteredApplications.length} matching filters
                        </span>
                      </div>
                    </article>

                    <article className="reports-summary-card">
                      <div className="reports-card-icon orange">
                        <IonIcon icon={timeOutline} />
                      </div>
                      <div className="reports-summary-copy">
                        <p>Pending Applications</p>
                        <h2>{pendingCount.toLocaleString()}</h2>
                        <span>Awaiting review</span>
                      </div>
                    </article>

                    <article className="reports-summary-card">
                      <div className="reports-card-icon purple">
                        <IonIcon icon={businessOutline} />
                      </div>
                      <div className="reports-summary-copy">
                        <p>Organizations</p>
                        <h2>{organizations.length.toLocaleString()}</h2>
                        <span>{activeScholarships} active scholarships</span>
                      </div>
                    </article>
                  </section>

                  {/* SECONDARY STATISTICS */}
                  <section className="reports-secondary-stats">
                    <div className="reports-secondary-item">
                      <span className="status-dot approved-dot" />
                      <span>Approved</span>
                      <strong>{approvedCount}</strong>
                    </div>

                    <div className="reports-secondary-item">
                      <span className="status-dot rejected-dot" />
                      <span>Rejected</span>
                      <strong>{rejectedCount}</strong>
                    </div>

                    <div className="reports-secondary-item">
                      <span className="status-dot scholarship-dot" />
                      <span>Total Scholarships</span>
                      <strong>{scholarships.length}</strong>
                    </div>
                  </section>

                  <section className="reports-filter-scope"><strong>Application analytics</strong><p>Charts and the application table follow the filters below. Platform totals and organization records include all records.</p></section>
                  {/* FILTER PANEL */}
                  <section className="reports-filter-panel">
                    <div className="reports-section-heading">
                      <div>
                        <h2>Application Reports</h2>
                        <p>
                          Search and filter scholarship application records.
                        </p>
                      </div>
                    </div>

                    <div className="reports-filters">
                      <label className="reports-field reports-search-field">
                        <span>Search</span>
                        <div className="reports-search-box">
                          <IonIcon icon={searchOutline} />
                          <input
                            type="search"
                            maxLength={200}
                            placeholder="Student or scholarship..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                          />
                        </div>
                      </label>

                      <label className="reports-field">
                        <span>Date range</span>
                        <select
                          value={dateFilter}
                          onChange={(event) =>
                            setDateFilter(event.target.value as DateFilter)
                          }
                        >
                          <option value="all">All time</option>
                          <option value="today">Today</option>
                          <option value="month">This month</option>
                          <option value="year">This year</option>
                          <option value="custom">Custom range</option>
                        </select>
                      </label>

                      <label className="reports-field">
                        <span>Status</span>
                        <select
                          value={statusFilter}
                          onChange={(event) =>
                            setStatusFilter(event.target.value)
                          }
                        >
                          <option value="all">All statuses</option>
                          <option value="Pending">Pending</option>
                          <option value="Approved">Approved</option>
                          <option value="Accepted">Accepted</option>
                          <option value="Rejected">Rejected</option>
                          <option value="Declined">Declined</option>
                          <option value="Under Review">Under Review</option>
                        </select>
                      </label>

                      <button
                        type="button"
                        className="reports-reset-button"
                        onClick={resetFilters}
                      >
                        <IonIcon icon={refreshOutline} />
                        <span>Reset</span>
                      </button>
                    </div>

                    {dateFilter === 'custom' && (
                      <div className="reports-custom-dates">
                        <label className="reports-field">
                          <span>Start date</span>
                          <input
                            type="date"
                            value={startDate}
                            max={endDate || undefined}
                            onChange={(event) =>
                              setStartDate(event.target.value)
                            }
                          />
                        </label>

                        <label className="reports-field">
                          <span>End date</span>
                          <input
                            type="date"
                            value={endDate}
                            min={startDate || undefined}
                            onChange={(event) =>
                              setEndDate(event.target.value)
                            }
                          />
                        </label>
                      </div>
                    )}
                  </section>

                  {/* CHARTS */}
                  <section className="reports-analytics-grid" id="report-panel-analytics" role="tabpanel" aria-labelledby="report-tab-analytics" hidden={reportTab !== 'analytics'}>
                    <article className="reports-panel">
                      <div className="reports-panel-heading">
                        <div>
                          <h2>Applications by Status</h2>
                          <p>Filtered application totals</p>
                        </div>
                        <IonIcon icon={analyticsOutline} />
                      </div>

                      {Object.keys(statusCounts).length === 0 ? (
                        <p className="reports-empty-chart">
                          No application records found.
                        </p>
                      ) : (
                        <div className="reports-status-chart">
                          {Object.entries(statusCounts).map(
                            ([status, count]) => (
                              <div className="reports-status-row" key={status}>
                                <div className="reports-bar-label">
                                  <span>{status}</span>
                                  <strong>{count}</strong>
                                </div>
                                <div className="reports-bar-track">
                                  <div
                                    className={`reports-bar-fill ${normalize(
                                      status
                                    ).replace(/[^a-z0-9]+/g, '-')}`}
                                    style={{
                                      width: `${(count / maxStatus) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </article>

                    <article className="reports-panel">
                      <div className="reports-panel-heading">
                        <div>
                          <h2>Monthly Application Trend</h2>
                          <p>Filtered applications in the last six months</p>
                        </div>
                        <IonIcon icon={analyticsOutline} />
                      </div>

                      <div className="reports-monthly-chart">
                        {monthlyData.map((month) => (
                          <div className="reports-month-column" key={month.key}>
                            <strong>{month.count}</strong>
                            <div className="reports-month-bar-track">
                              <div
                                className="reports-month-bar"
                                style={{
                                  height:
                                    month.count === 0
                                      ? '0%'
                                      : `${Math.max(
                                          8,
                                          (month.count / maxMonthly) * 100
                                        )}%`,
                                }}
                              />
                            </div>
                            <span>{month.label}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  </section>

                  {/* APPLICATION TABLE */}
                  <section className="reports-table-panel" id="report-panel-applications" role="tabpanel" aria-labelledby="report-tab-applications" hidden={reportTab !== 'applications'}>
                    <div className="reports-table-heading">
                      <div>
                        <h2>Application Records</h2>
                        <p>
                          Showing {filteredApplications.length} of{' '}
                          {applications.length} records
                        </p>
                      </div>
                    </div>

                    <div className="reports-table-wrapper">
                      <table className="reports-table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Scholarship</th>
                            <th>Organization</th>
                            <th>Date Submitted</th>
                            <th>Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredApplications.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="reports-empty-table">
                                No matching application records.
                              </td>
                            </tr>
                          ) : (
                            filteredApplications.map((record) => {
                              const status = getStatus(record);

                              return (
                                <tr key={record.id}>
                                  <td>
                                    <div className="reports-student-cell">
                                      <div className="reports-avatar">
                                        {studentName(record)
                                          .charAt(0)
                                          .toUpperCase()}
                                      </div>
                                      <div className="reports-student-info">
                                        <strong>{studentName(record)}</strong>
                                        <span>
                                          {String(record.studentEmail ??
                                            record.email ??
                                            '—')}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td>{scholarshipName(record)}</td>
                                  <td>
                                    {String(record.organizationName ??
                                      organizationName(record))}
                                  </td>
                                  <td>{formatDate(getRecordDate(record))}</td>
                                  <td>
                                    <span
                                      className={`reports-status-badge ${normalize(
                                        status
                                      ).replace(/[^a-z0-9]+/g, '-')}`}
                                    >
                                      {status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* ORGANIZATION TABLE */}
                  <section className="reports-table-panel" id="report-panel-organizations" role="tabpanel" aria-labelledby="report-tab-organizations" hidden={reportTab !== 'organizations'}>
                    <div className="reports-table-heading">
                      <div>
                        <h2>Organization Overview</h2>
                        <p>
                          {organizations.length} registered organization records
                        </p>
                      </div>
                    </div>

                    <div className="reports-table-wrapper">
                      <table className="reports-table">
                        <thead>
                          <tr>
                            <th>Organization</th>
                            <th>Type</th>
                            <th>Email</th>
                            <th>Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {organizations.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="reports-empty-table">
                                No organization records found.
                              </td>
                            </tr>
                          ) : (
                            organizations.map((record) => (
                              <tr key={record.id}>
                                <td>{organizationName(record)}</td>
                                <td>
                                  {String(record.organizationType ??
                                    record.type ??
                                    record.role ??
                                    '—')}
                                </td>
                                <td>
                                  {String(record.organizationEmail ??
                                    record.email ??
                                    '—')}
                                </td>
                                <td>
                                  <span className="reports-status-badge">
                                    {String(record.status ?? 'Registered')}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <footer className="reports-footer-note">
                    <IonIcon icon={analyticsOutline} />
                    <span>
                      Data is based on records available in Firebase Firestore.
                    </span>
                  </footer>
                </>
              )}
            </div>
          </IonContent>
        </main>
      </div>
    </IonPage>
  );
};

export default AdminReports;