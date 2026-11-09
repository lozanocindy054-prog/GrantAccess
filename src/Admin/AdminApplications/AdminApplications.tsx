import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  IonPage,
  IonContent,
  IonSpinner,
  IonToast,
  IonModal,
  IonButton,
  IonIcon,
} from '@ionic/react';

import {
  refreshOutline,
  searchOutline,
  eyeOutline,
  closeOutline,
  documentTextOutline,
  downloadOutline,
  peopleOutline,
} from 'ionicons/icons';

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  orderBy,
  query,
} from 'firebase/firestore';

import { db } from '../../Firebase/config';
import './AdminApplications.css';

interface Application {
  id: string;
  studentName: string;
  studentEmail: string;
  scholarshipName: string;
  organizationName: string;
  submittedAt: string;
  status: string;
  remarks: string;
  rawData: Record<string, unknown>;
}

interface SubmittedRequirement {
  name: string;
  url: string;
  status?: string;
}

const getSubmittedRequirements = (value: unknown): SubmittedRequirement[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const url = record.url ?? record.downloadURL ?? record.downloadUrl;
    if (typeof url !== 'string') return [];

    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        return [];
      }
    } catch {
      return [];
    }

    return [{
      name:
        typeof record.name === 'string' && record.name.trim()
          ? record.name
          : `Requirement ${index + 1}`,
      url,
      status: typeof record.status === 'string' ? record.status : undefined,
    }];
  });
};

const AdminApplications: React.FC = () => {
  const navigate = useNavigate();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const getText = (value: unknown, fallback = 'N/A'): string => {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }

    return fallback;
  };

  const formatDate = (value: unknown): string => {
    if (!value) return 'N/A';

    try {
      let date: Date;

      if (
        typeof value === 'object' &&
        value !== null &&
        'toDate' in value &&
        typeof (value as { toDate?: unknown }).toDate === 'function'
      ) {
        date = (value as { toDate: () => Date }).toDate();
      } else if (
        typeof value === 'object' &&
        value !== null &&
        'seconds' in value
      ) {
        date = new Date(
          Number((value as { seconds: number }).seconds) * 1000
        );
      } else {
        date = new Date(value as string | number);
      }

      if (Number.isNaN(date.getTime())) return 'N/A';

      return date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const loadApplications = async () => {
    setLoading(true);

    try {
      const applicationsRef = collection(db, 'applications');
      let snapshot;

      try {
        snapshot = await getDocs(
          query(applicationsRef, orderBy('submittedAt', 'desc'))
        );
      } catch {
        snapshot = await getDocs(applicationsRef);
      }

      const loadedApplications: Application[] = snapshot.docs.map(
        (applicationDoc) => {
          const data = applicationDoc.data() as Record<string, unknown>;

          const firstName = getText(data.firstName, '');
          const lastName = getText(data.lastName, '');
          const combinedName = `${firstName} ${lastName}`.trim();

          return {
            id: applicationDoc.id,
            studentName: getText(
              data.studentName ||
                data.fullName ||
                data.applicantName ||
                data.name ||
                combinedName,
              'Unnamed Student'
            ),
            studentEmail: getText(
              data.studentEmail ||
                data.email ||
                data.applicantEmail
            ),
            scholarshipName: getText(
              data.scholarshipName ||
                data.scholarshipTitle ||
                data.title
            ),
            organizationName: getText(
              data.organizationName ||
                data.providerName ||
                data.schoolName ||
                data.lguName
            ),
            submittedAt: formatDate(
              data.submittedAt ||
                data.createdAt ||
                data.applicationDate
            ),
            status: getText(data.status, 'Pending'),
            remarks: getText(
              data.remarks || data.adminRemarks,
              ''
            ),
            rawData: data,
          };
        }
      );

      setApplications(loadedApplications);
    } catch (error) {
      console.error('Error loading applications:', error);
      setToastMessage(
        'Unable to load applications. Check your Firebase connection, collection name, and Firestore permissions.'
      );
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApplications();
  }, []);

  const filteredApplications = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return applications.filter((application) => {
      const matchesSearch = [
        application.studentName,
        application.studentEmail,
        application.scholarshipName,
        application.organizationName,
        application.status,
      ].some((value) => value.toLowerCase().includes(search));

      const matchesStatus =
        statusFilter === 'All' ||
        application.status.toLowerCase() ===
          statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [applications, searchText, statusFilter]);

  const pendingCount = applications.filter(
    (application) =>
      application.status.toLowerCase() === 'pending'
  ).length;

  const approvedCount = applications.filter(
    (application) =>
      application.status.toLowerCase() === 'approved'
  ).length;

  const rejectedCount = applications.filter(
    (application) =>
      application.status.toLowerCase() === 'rejected'
  ).length;

  const updateApplicationStatus = async (
    application: Application,
    newStatus: string
  ) => {
    setUpdatingId(application.id);

    try {
      await updateDoc(
        doc(db, 'applications', application.id),
        { status: newStatus }
      );

      setApplications((previous) =>
        previous.map((item) =>
          item.id === application.id
            ? { ...item, status: newStatus }
            : item
        )
      );

      setSelectedApplication((previous) =>
        previous?.id === application.id
          ? { ...previous, status: newStatus }
          : previous
      );

      setToastMessage(
        `Application status updated to ${newStatus}.`
      );
      setShowToast(true);
    } catch (error) {
      console.error('Error updating application status:', error);
      setToastMessage(
        'Unable to update status. Check Firestore rules and permissions.'
      );
      setShowToast(true);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusClass = (status: string) => {
    const normalizedStatus = status.toLowerCase();

    if (normalizedStatus === 'approved') return 'status-approved';
    if (normalizedStatus === 'rejected') return 'status-rejected';
    if (normalizedStatus === 'pending') return 'status-pending';

    return 'status-other';
  };

  return (
    <IonPage>
      <IonContent
        fullscreen
        className="admin-applications-content"
      >
        <div className="applications-page">

          {/* HEADER */}
          <header className="applications-header">
            <div className="applications-brand">
              <img
                src="/image/logo3.png"
                alt="GrantAccess Logo"
                className="applications-logo"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />

              <div className="applications-brand-text">
                <h1>GrantAccess</h1>
                <p>ADMIN PORTAL</p>
              </div>
            </div>

            <IonButton
              className="applications-refresh-button"
              onClick={() => void loadApplications()}
              disabled={loading}
            >
              <IonIcon icon={refreshOutline} slot="start" />
              Refresh
            </IonButton>
          </header>

          <main className="applications-main">

            {/* PAGE TITLE */}
            <section className="applications-heading">
              <span className="applications-eyebrow">
                APPLICATION MANAGEMENT
              </span>

              <h2>Scholarship Applications</h2>

              <p>
                View and manage student scholarship applications
                registered in GrantAccess.
              </p>
            </section>

            {/* SUMMARY CARDS */}
            <section className="applications-stats">

              <div className="application-stat-card">
                <div className="application-stat-icon">
                  <IonIcon icon={documentTextOutline} />
                </div>
                <div>
                  <span>Total Applications</span>
                  <strong>
                    {loading ? '—' : applications.length}
                  </strong>
                </div>
              </div>

              <div className="application-stat-card">
                <div className="application-stat-icon pending-icon">
                  <IonIcon icon={documentTextOutline} />
                </div>
                <div>
                  <span>Pending</span>
                  <strong>
                    {loading ? '—' : pendingCount}
                  </strong>
                </div>
              </div>

              <div className="application-stat-card">
                <div className="application-stat-icon approved-icon">
                  <IonIcon icon={documentTextOutline} />
                </div>
                <div>
                  <span>Approved</span>
                  <strong>
                    {loading ? '—' : approvedCount}
                  </strong>
                </div>
              </div>

              <div className="application-stat-card">
                <div className="application-stat-icon rejected-icon">
                  <IonIcon icon={documentTextOutline} />
                </div>
                <div>
                  <span>Rejected</span>
                  <strong>
                    {loading ? '—' : rejectedCount}
                  </strong>
                </div>
              </div>

            </section>

            {/* APPLICATION TABLE */}
            <section className="applications-table-card">

              <div className="applications-table-heading">
                <div>
                  <h3>Application List</h3>
                  <p>
                    Search and review student application information.
                  </p>
                </div>
              </div>

              <div className="applications-filters">
                <div className="applications-search">
                  <IonIcon icon={searchOutline} />

                  <input
                    type="search"
                    placeholder="Search applications..."
                    value={searchText}
                    onChange={(event) =>
                      setSearchText(event.target.value)
                    }
                  />
                </div>

                <select
                  aria-label="Filter applications by status"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {loading ? (
                <div className="applications-state">
                  <IonSpinner name="crescent" />
                  <p>Loading applications...</p>
                </div>
              ) : filteredApplications.length === 0 ? (
                <div className="applications-state">
                  <IonIcon icon={peopleOutline} />
                  <h3>
                    {applications.length === 0
                      ? 'No applications registered yet'
                      : 'No matching applications found'}
                  </h3>
                  <p>
                    {applications.length === 0
                      ? 'Student applications saved in Firestore will appear here.'
                      : 'Try another search term or change the status filter.'}
                  </p>
                  {applications.length === 0 && (
                    <IonButton
                      onClick={() => void loadApplications()}
                    >
                      Try Again
                    </IonButton>
                  )}
                </div>
              ) : (
                <div className="applications-table-wrapper">
                  <table className="applications-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Scholarship</th>
                        <th>Date Submitted</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredApplications.map((application) => (
                        <tr key={application.id}>
                          <td>
                            <div className="application-student-cell">
                              <div className="application-avatar">
                                {application.studentName
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div>
                                <strong>
                                  {application.studentName}
                                </strong>
                                <span>
                                  {application.studentEmail}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="application-scholarship-cell">
                              <strong>
                                {application.scholarshipName}
                              </strong>
                              <span>
                                {application.organizationName}
                              </span>
                            </div>
                          </td>

                          <td>{application.submittedAt}</td>

                          <td>
                            <span
                              className={`application-status ${getStatusClass(
                                application.status
                              )}`}
                            >
                              {application.status}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="application-view-button"
                              onClick={() =>
                                setSelectedApplication(application)
                              }
                            >
                              <IonIcon icon={eyeOutline} />
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading && applications.length > 0 && (
                <div className="applications-table-footer">
                  Showing {filteredApplications.length} of{' '}
                  {applications.length} applications
                </div>
              )}
            </section>

            {/* BACK BUTTON: BOTTOM LEFT */}
            <div className="applications-bottom-actions">
              <button
                type="button"
                className="applications-back-button"
                onClick={() => navigate('/admin-dashboard')}
              >
              
                <span>Back</span>
              </button>
            </div>

          </main>
        </div>

        {/* APPLICATION REVIEW MODAL */}
        <IonModal
          isOpen={selectedApplication !== null}
          onDidDismiss={() => setSelectedApplication(null)}
          className="application-review-modal"
        >
          {selectedApplication && (
            <div className="application-modal-content">

              <div className="application-modal-header">
                <div>
                  <span>APPLICATION REVIEW</span>
                  <h2>Application Details</h2>
                </div>

                <button
                  type="button"
                  className="application-modal-close"
                  onClick={() => setSelectedApplication(null)}
                  aria-label="Close application details"
                >
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <div className="application-modal-body">
                <div className="application-detail-item">
                  <span>Student Name</span>
                  <strong>{selectedApplication.studentName}</strong>
                </div>

                <div className="application-detail-item">
                  <span>Student Email</span>
                  <strong>{selectedApplication.studentEmail}</strong>
                </div>

                <div className="application-detail-item">
                  <span>Scholarship</span>
                  <strong>{selectedApplication.scholarshipName}</strong>
                </div>

                <div className="application-detail-item">
                  <span>LGU / School</span>
                  <strong>{selectedApplication.organizationName}</strong>
                </div>

                <div className="application-detail-item">
                  <span>Date Submitted</span>
                  <strong>{selectedApplication.submittedAt}</strong>
                </div>

                <div className="application-detail-item">
                  <span>Current Status</span>
                  <strong
                    className={`application-status ${getStatusClass(
                      selectedApplication.status
                    )}`}
                  >
                    {selectedApplication.status}
                  </strong>
                </div>

                <div className="application-detail-item application-full-width">
                  <span>Submitted Requirements</span>
                  {getSubmittedRequirements(
                    selectedApplication.rawData.requirements ??
                      selectedApplication.rawData.documents ??
                      selectedApplication.rawData.uploadedDocuments
                  ).length > 0 ? (
                    <div className="admin-submitted-requirements">
                      {getSubmittedRequirements(
                        selectedApplication.rawData.requirements ??
                          selectedApplication.rawData.documents ??
                          selectedApplication.rawData.uploadedDocuments
                      ).map((requirement, index) => (
                        <a
                          key={`${requirement.url}-${index}`}
                          href={requirement.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <IonIcon icon={downloadOutline} />
                          <span>{requirement.name}</span>
                          {requirement.status && (
                            <small>{requirement.status}</small>
                          )}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p>No uploaded requirements were included.</p>
                  )}
                </div>

                <div className="application-detail-item application-full-width">
                  <span>Remarks</span>
                  <p>
                    {selectedApplication.remarks ||
                      'No remarks provided.'}
                  </p>
                </div>
              </div>

              <div className="application-modal-actions">
                <p>Update application status:</p>

                <div className="application-status-buttons">
                  <IonButton
                    className="application-approve-button"
                    disabled={updatingId === selectedApplication.id}
                    onClick={() =>
                      void updateApplicationStatus(
                        selectedApplication,
                        'Approved'
                      )
                    }
                  >
                    Approve
                  </IonButton>

                  <IonButton
                    className="application-reject-button"
                    disabled={updatingId === selectedApplication.id}
                    onClick={() =>
                      void updateApplicationStatus(
                        selectedApplication,
                        'Rejected'
                      )
                    }
                  >
                    Reject
                  </IonButton>

                  <IonButton
                    className="application-pending-button"
                    fill="outline"
                    disabled={updatingId === selectedApplication.id}
                    onClick={() =>
                      void updateApplicationStatus(
                        selectedApplication,
                        'Pending'
                      )
                    }
                  >
                    Set Pending
                  </IonButton>
                </div>

                {updatingId === selectedApplication.id && (
                  <p className="application-updating-message">
                    Updating status...
                  </p>
                )}
              </div>
            </div>
          )}
        </IonModal>

        <IonToast
          isOpen={showToast}
          message={toastMessage}
          duration={3500}
          position="bottom"
          color="success"
          onDidDismiss={() => setShowToast(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default AdminApplications;