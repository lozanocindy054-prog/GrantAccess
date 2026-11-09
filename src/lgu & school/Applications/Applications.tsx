
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  IonIcon,
  IonSpinner,
  IonModal,
  IonButton,
  IonBadge,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToast,
} from '@ionic/react';

import {
  schoolOutline,
  documentTextOutline,
  peopleOutline,
  eyeOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  timeOutline,
  downloadOutline,
  refreshOutline,
  clipboardOutline,
  personOutline,
  fileTrayOutline,
  closeOutline,
  locationOutline,
} from 'ionicons/icons';

import { getAuth } from 'firebase/auth';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';

import { db } from '../../Firebase/config';

import './Applications.css';

type ApplicationStatus =
  | 'Pending'
  | 'Under Review'
  | 'For Compliance'
  | 'Approved'
  | 'Rejected';

interface Requirement {
  name: string;
  url: string;
  mimeType?: string;
  requirementType?: string;
  status?: string;
}

interface ApplicationRecord {
  id: string;
  studentId: string;
  scholarshipId: string;
  organizationId: string;
  studentName: string;
  studentEmail: string;
  studentNumber: string;
  contactNumber: string;
  school: string;
  course: string;
  yearLevel: string;
  scholarshipTitle: string;
  scholarshipAmount: string;
  submittedAt: Date | null;
  status: ApplicationStatus;
  requirements: Requirement[];
  studentActive: boolean;
  approximateLocation: { latitude: number; longitude: number } | null;
  remarks: string;
  rejectionReason: string;
}

interface RawData {
  [key: string]: unknown;
}

const STATUS_OPTIONS: ApplicationStatus[] = [
  'Pending',
  'Under Review',
  'For Compliance',
  'Approved',
  'Rejected',
];

const getString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;
};

const getDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();

  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const getRequirements = (value: unknown): Requirement[] => {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item === 'string') {
        return {
          name: `Requirement ${index + 1}`,
          url: item,
        };
      }

      if (item && typeof item === 'object') {
        const data = item as RawData;

        return {
          name: getString(
            data.name ?? data.title ?? data.fileName,
            `Requirement ${index + 1}`,
          ),
          url: getString(
            data.url ?? data.downloadURL ?? data.fileURL,
          ),
          mimeType: getString(data.mimeType ?? data.contentType),
          requirementType: getString(data.requirementType),
          status: getString(data.status),
        };
      }

      return {
        name: `Requirement ${index + 1}`,
        url: '',
      };
    });
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as RawData).map(([name, item]) => {
      if (typeof item === 'string') {
        return { name, url: item };
      }

      if (item && typeof item === 'object') {
        const data = item as RawData;

        return {
          name,
          url: getString(
            data.url ?? data.downloadURL ?? data.fileURL,
          ),
          mimeType: getString(data.mimeType ?? data.contentType),
          requirementType: getString(data.requirementType),
          status: getString(data.status),
        };
      }

      return { name, url: '' };
    });
  }

  return [];
};

const formatDate = (date: Date | null): string => {
  if (!date) return 'Not available';

  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatCurrency = (amount: string): string => {
  const number = Number(amount.replace(/[₱,\s]/g, ''));

  if (!amount || Number.isNaN(number)) {
    return amount || 'Not specified';
  }

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(number);
};

const isPresenceActive = (value: RawData): boolean => {
  const lastActive = getDate(value.lastActive);
  return (
    value.online === true &&
    !!lastActive &&
    Date.now() - lastActive.getTime() < 2 * 60 * 1000
  );
};

const getSafeDocumentUrl = (value: string): string => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : '';
  } catch {
    return '';
  }
};

const getDocumentDownloadUrl = (value: string): string => {
  const safeUrl = getSafeDocumentUrl(value);
  if (!safeUrl) return '';

  const url = new URL(safeUrl);
  if (url.hostname === 'res.cloudinary.com') {
    const pathParts = url.pathname.split('/');
    const uploadIndex = pathParts.lastIndexOf('upload');

    if (
      uploadIndex >= 0 &&
      pathParts[uploadIndex + 1] !== 'fl_attachment'
    ) {
      pathParts.splice(uploadIndex + 1, 0, 'fl_attachment');
      url.pathname = pathParts.join('/');
    }
  }

  return url.toString();
};

const getDocumentType = (
  requirement: Requirement,
): 'pdf' | 'image' | 'other' => {
  const mimeType = requirement.mimeType?.toLowerCase();
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType?.startsWith('image/')) return 'image';

  const extension = requirement.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) {
    return 'image';
  }
  return 'other';
};

const Applications: React.FC = () => {
  const auth = getAuth();

  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [selectedApplication, setSelectedApplication] =
    useState<ApplicationRecord | null>(null);

  const [previewRequirement, setPreviewRequirement] =
    useState<Requirement | null>(null);

  const [showDetails, setShowDetails] = useState(false);

  const [newStatus, setNewStatus] =
    useState<ApplicationStatus>('Pending');

  const [remarks, setRemarks] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const [toast, setToast] = useState({
    show: false,
    message: '',
    color: 'success' as 'success' | 'danger' | 'warning',
  });

  const showToast = (
    message: string,
    color: 'success' | 'danger' | 'warning' = 'success',
  ) => {
    setToast({ show: true, message, color });
  };

  const fetchApplications = useCallback(async () => {
    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      showToast('Your session has expired. Please log in again.', 'danger');
      return;
    }

    setLoading(true);

    try {
      const applicationsQuery = query(
        collection(db, 'applications'),
        where('organizationId', '==', user.uid),
      );

      const snapshot = await getDocs(applicationsQuery);

      const records: ApplicationRecord[] = await Promise.all(
        snapshot.docs.map(async (applicationDoc) => {
          const data = applicationDoc.data() as RawData;

          const studentId = getString(data.studentId ?? data.userId);
          const scholarshipId = getString(data.scholarshipId);

          let studentData: RawData = {};
          let scholarshipData: RawData = {};
          const studentActive = false;

          if (studentId) {
            try {
              const studentSnapshot = await getDoc(
                doc(db, 'students', studentId),
              );

              if (studentSnapshot.exists()) {
                studentData = studentSnapshot.data() as RawData;
              }
            } catch (error) {
              console.error('Unable to fetch student:', error);
            }
          }

          if (scholarshipId) {
            try {
              const scholarshipSnapshot = await getDoc(
                doc(db, 'scholarships', scholarshipId),
              );

              if (scholarshipSnapshot.exists()) {
                scholarshipData = scholarshipSnapshot.data() as RawData;
              }
            } catch (error) {
              console.error('Unable to fetch scholarship:', error);
            }
          }

          const rawLocation = data.approximateLocation;
          const approximateLocation =
            data.locationConsent === true &&
            typeof rawLocation === 'object' &&
            rawLocation !== null &&
            'latitude' in rawLocation &&
            'longitude' in rawLocation &&
            typeof rawLocation.latitude === 'number' &&
            typeof rawLocation.longitude === 'number' &&
            Number.isFinite(rawLocation.latitude) &&
            Number.isFinite(rawLocation.longitude)
              ? {
                  latitude: rawLocation.latitude,
                  longitude: rawLocation.longitude,
                }
              : null;

          const rawStatus = getString(data.status, 'Pending');

          const validStatus: ApplicationStatus =
            STATUS_OPTIONS.includes(rawStatus as ApplicationStatus)
              ? (rawStatus as ApplicationStatus)
              : 'Pending';

          const firstName = getString(studentData.firstName);
          const lastName = getString(studentData.lastName);

          const studentFullName =
            getString(
              studentData.fullName ??
                studentData.name ??
                data.studentName,
            ) || `${firstName} ${lastName}`.trim();

          return {
            id: applicationDoc.id,
            studentId,
            scholarshipId,
            organizationId: getString(data.organizationId),

            studentName: studentFullName || 'Unknown Student',

            studentEmail: getString(
              studentData.email ?? data.studentEmail,
            ),

            studentNumber: getString(
              studentData.studentNumber ??
                studentData.studentIdNumber,
            ),

            contactNumber: getString(
              studentData.contactNumber ??
                studentData.phoneNumber ??
                studentData.phone,
            ),

            school: getString(
              studentData.school ??
                studentData.schoolName ??
                studentData.university,
            ),

            course: getString(
              studentData.course ?? studentData.program,
            ),

            yearLevel: getString(studentData.yearLevel),

            scholarshipTitle: getString(
              scholarshipData.title ??
                scholarshipData.name ??
                data.scholarshipTitle,
              'Scholarship',
            ),

            scholarshipAmount: getString(
              scholarshipData.amount ??
                scholarshipData.assistanceAmount ??
                data.scholarshipAmount,
            ),

            submittedAt: getDate(
              data.submittedAt ??
                data.applicationDate ??
                data.createdAt,
            ),

            status: validStatus,

            requirements: getRequirements(
              data.requirements ??
                data.documents ??
                data.uploadedDocuments,
            ),

            studentActive,
            approximateLocation,
            remarks: getString(data.remarks),
            rejectionReason: getString(data.rejectionReason),
          };
        }),
      );

      records.sort((a, b) => {
        const dateA = a.submittedAt?.getTime() ?? 0;
        const dateB = b.submittedAt?.getTime() ?? 0;
        return dateB - dateA;
      });

      setApplications(records);
    } catch (error) {
      console.error('Error fetching applications:', error);

      showToast(
        'Unable to load applications. Please check your connection and Firestore rules.',
        'danger',
      );
    } finally {
      setLoading(false);
    }
  }, [auth]);

  const applicantIds = useMemo(
    () => Array.from(new Set(applications.map((item) => item.studentId))).join('\0'),
    [applications],
  );

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    const studentIds = applicantIds.split('\0').filter(Boolean);
    if (studentIds.length === 0) return;

    const unsubscribes = studentIds.map((studentId) =>
      onSnapshot(
        doc(db, 'studentPresence', studentId),
        (snapshot) => {
          const online =
            snapshot.exists() &&
            isPresenceActive(snapshot.data() as RawData);
          setApplications((previous) =>
            previous.map((application) =>
              application.studentId === studentId
                ? { ...application, studentActive: online }
                : application,
            ),
          );
        },
        (error) => {
          console.error('Unable to watch student activity:', error);
        },
      ),
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [applicantIds]);

  const summary = useMemo(() => ({
    total: applications.length,
    pending: applications.filter(
      (item) => item.status === 'Pending',
    ).length,
    reviewing: applications.filter(
      (item) => item.status === 'Under Review',
    ).length,
    approved: applications.filter(
      (item) => item.status === 'Approved',
    ).length,
    rejected: applications.filter(
      (item) => item.status === 'Rejected',
    ).length,
  }), [applications]);

  const filteredApplications = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return applications.filter((application) => {
      const matchesSearch =
        !keyword ||
        application.studentName.toLowerCase().includes(keyword) ||
        application.scholarshipTitle.toLowerCase().includes(keyword) ||
        application.id.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === 'All' ||
        application.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [applications, searchText, statusFilter]);

  const openApplication = (application: ApplicationRecord) => {
    setSelectedApplication(application);
    setPreviewRequirement(null);
    setNewStatus(application.status);
    setRemarks(application.remarks || application.rejectionReason);
    setShowDetails(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedApplication) return;

    if (
      (newStatus === 'Rejected' || newStatus === 'For Compliance') &&
      !remarks.trim()
    ) {
      showToast(
        newStatus === 'Rejected'
          ? 'Please provide a reason before rejecting an application.'
          : 'Please specify the missing or incorrect requirements.',
        'warning',
      );
      return;
    }

    setSavingStatus(true);

    try {
      const applicationRef = doc(
        db,
        'applications',
        selectedApplication.id,
      );

      await updateDoc(applicationRef, {
        status: newStatus,
        remarks: remarks.trim(),
        rejectionReason:
          newStatus === 'Rejected' ? remarks.trim() : '',
        reviewedAt: Timestamp.now(),
        reviewedBy: auth.currentUser?.uid ?? '',
        updatedAt: Timestamp.now(),
      });

      setApplications((previous) =>
        previous.map((application) =>
          application.id === selectedApplication.id
            ? {
                ...application,
                status: newStatus,
                remarks: remarks.trim(),
                rejectionReason:
                  newStatus === 'Rejected' ? remarks.trim() : '',
              }
            : application,
        ),
      );

      showToast('Application status updated successfully.');
      setShowDetails(false);
    } catch (error) {
      console.error('Error updating application:', error);

      showToast(
        'Unable to update application. Please check your Firestore rules.',
        'danger',
      );
    } finally {
      setSavingStatus(false);
    }
  };

  const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
      case 'Approved':
        return 'success';
      case 'Rejected':
        return 'danger';
      case 'Under Review':
        return 'warning';
      case 'For Compliance':
        return 'tertiary';
      default:
        return 'medium';
    }
  };

  if (loading) {
    return (
      <div className="applications-popup-loading">
        <IonSpinner name="crescent" />
        <p>Loading applications...</p>
      </div>
    );
  }

  return (
    <div className="applications-popup">

      <header className="applications-popup-header">
        <div className="applications-popup-brand">
          <div className="applications-popup-brand-icon">
            <IonIcon icon={schoolOutline} />
          </div>

          <div>
            <span>GRANTACCESS</span>
            <h1>Application Management</h1>
            <p>Review and manage student scholarship applications.</p>
          </div>
        </div>

        <button
          type="button"
          className="applications-refresh-button"
          onClick={() => void fetchApplications()}
        >
          <IonIcon icon={refreshOutline} />
          Refresh
        </button>
      </header>

      <main className="applications-popup-content">

        <div className="applications-heading-row">
          <div>
            <div className="applications-breadcrumb">
              <span>LGU / School Portal</span>
              <span>›</span>
              <strong>Applications</strong>
            </div>

            <h2>Application Overview</h2>
            <p>Monitor, review, and manage submitted scholarship applications.</p>
          </div>

          <span className="applications-live">
            <span />
            Application Records
          </span>
        </div>

        <section className="applications-summary-grid">

          <article className="applications-summary-card">
            <div className="applications-summary-icon total">
              <IonIcon icon={peopleOutline} />
            </div>
            <div>
              <small>Total Applications</small>
              <h2>{summary.total}</h2>
              <span>All submitted applications</span>
            </div>
          </article>

          <article className="applications-summary-card">
            <div className="applications-summary-icon pending">
              <IonIcon icon={timeOutline} />
            </div>
            <div>
              <small>Pending</small>
              <h2>{summary.pending}</h2>
              <span>Waiting for review</span>
            </div>
          </article>

          <article className="applications-summary-card">
            <div className="applications-summary-icon reviewing">
              <IonIcon icon={clipboardOutline} />
            </div>
            <div>
              <small>Under Review</small>
              <h2>{summary.reviewing}</h2>
              <span>Currently evaluated</span>
            </div>
          </article>

          <article className="applications-summary-card">
            <div className="applications-summary-icon approved">
              <IonIcon icon={checkmarkCircleOutline} />
            </div>
            <div>
              <small>Approved</small>
              <h2>{summary.approved}</h2>
              <span>Accepted applications</span>
            </div>
          </article>

          <article className="applications-summary-card">
            <div className="applications-summary-icon rejected">
              <IonIcon icon={closeCircleOutline} />
            </div>
            <div>
              <small>Rejected</small>
              <h2>{summary.rejected}</h2>
              <span>Not approved</span>
            </div>
          </article>

        </section>

        <section className="applications-list-section">

          <div className="applications-list-heading">
            <div>
              <h2>Application List</h2>
              <p>View and manage student scholarship applications.</p>
            </div>

            <span className="applications-list-count">
              {filteredApplications.length} result(s)
            </span>
          </div>

          <div className="applications-toolbar">

            <div className="applications-search-wrapper">
              <IonSearchbar
                value={searchText}
                onIonInput={(event) =>
                  setSearchText(event.detail.value ?? '')
                }
                placeholder="Search student, scholarship, or ID..."
                debounce={250}
                className="applications-searchbar"
              />
            </div>

            <div className="applications-filter-wrapper">
              <IonSelect
                value={statusFilter}
                placeholder="Filter by status"
                interface="popover"
                onIonChange={(event) =>
                  setStatusFilter(String(event.detail.value ?? 'All'))
                }
              >
                <IonSelectOption value="All">
                  All Status
                </IonSelectOption>

                {STATUS_OPTIONS.map((status) => (
                  <IonSelectOption key={status} value={status}>
                    {status}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </div>

          </div>

          <div className="applications-table-container">
            <table className="applications-table">
              <thead>
                <tr>
                  <th>APPLICATION ID</th>
                  <th>STUDENT</th>
                  <th>SCHOLARSHIP</th>
                  <th>DATE SUBMITTED</th>
                  <th>REQUIREMENTS</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {filteredApplications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <span className="applications-id">
                        {application.id}
                      </span>
                    </td>

                    <td>
                      <div className="applications-student-cell">
                        <div className="applications-student-avatar">
                          {application.studentName.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <strong>{application.studentName}</strong>
                          <span>
                            {application.studentActive
                              ? 'Active now'
                              : application.studentEmail || 'No email available'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="applications-scholarship-name">
                        {application.scholarshipTitle}
                      </span>
                    </td>

                    <td>{formatDate(application.submittedAt)}</td>

                    <td>
                      <span className="applications-requirement-count">
                        <IonIcon icon={fileTrayOutline} />
                        {application.requirements.length} file(s)
                      </span>
                    </td>

                    <td>
                      <IonBadge
                        color={getStatusColor(application.status)}
                        className="applications-status-badge"
                      >
                        {application.status}
                      </IonBadge>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="applications-view-button"
                        onClick={() => openApplication(application)}
                      >
                        <IonIcon icon={eyeOutline} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredApplications.length === 0 && (
              <div className="applications-empty-state">
                <div className="applications-empty-icon">
                  <IonIcon icon={documentTextOutline} />
                </div>

                <h3>No Applications Found</h3>

                <p>
                  {applications.length === 0
                    ? 'There are no applications submitted to your organization yet.'
                    : 'No applications match your search or selected status.'}
                </p>

                {(searchText || statusFilter !== 'All') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchText('');
                      setStatusFilter('All');
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>

        </section>

        <footer className="applications-popup-footer">
          © {new Date().getFullYear()} GrantAccess. All rights reserved.
          <span>LGU / School Portal</span>
        </footer>

      </main>

      <IonModal
        isOpen={showDetails}
        onDidDismiss={() => setShowDetails(false)}
        className="applications-details-modal"
      >
        {selectedApplication && (
          <div className="applications-modal-container">

            <div className="applications-modal-header">
              <div>
                <span>APPLICATION REVIEW</span>
                <h2>Application Details</h2>
                <p>{selectedApplication.id}</p>
              </div>

              <button
                type="button"
                className="applications-modal-close"
                onClick={() => setShowDetails(false)}
                aria-label="Close details"
              >
                <IonIcon icon={closeOutline} />
              </button>
            </div>

            <div className="applications-modal-body">

              <div className="applications-detail-status">
                <span>Current Status</span>
                <IonBadge color={getStatusColor(selectedApplication.status)}>
                  {selectedApplication.status}
                </IonBadge>
                <span className={selectedApplication.studentActive ? 'applications-active-now' : ''}>
                  {selectedApplication.studentActive ? 'Student active now' : 'Student not currently active'}
                </span>
              </div>

              <div className="applications-detail-section">
                <h3>
                  <IonIcon icon={personOutline} />
                  Student Information
                </h3>

                <div className="applications-detail-grid">
                  <div className="applications-detail-item">
                    <span>Full Name</span>
                    <strong>{selectedApplication.studentName}</strong>
                  </div>

                  <div className="applications-detail-item">
                    <span>Student Number</span>
                    <strong>{selectedApplication.studentNumber || 'Not provided'}</strong>
                  </div>

                  <div className="applications-detail-item">
                    <span>Email Address</span>
                    <strong>{selectedApplication.studentEmail || 'Not provided'}</strong>
                  </div>

                  <div className="applications-detail-item">
                    <span>Contact Number</span>
                    <strong>{selectedApplication.contactNumber || 'Not provided'}</strong>
                  </div>

                  <div className="applications-detail-item">
                    <span>School / University</span>
                    <strong>{selectedApplication.school || 'Not provided'}</strong>
                  </div>

                  <div className="applications-detail-item">
                    <span>Course / Program</span>
                    <strong>{selectedApplication.course || 'Not provided'}</strong>
                  </div>

                  <div className="applications-detail-item">
                    <span>Year Level</span>
                    <strong>{selectedApplication.yearLevel || 'Not provided'}</strong>
                  </div>
                </div>
              </div>

              <div className="applications-detail-section">
                <h3>
                  <IonIcon icon={locationOutline} />
                  Student Location
                </h3>

                {selectedApplication.approximateLocation ? (
                  <>
                    <p className="applications-location-note">
                      Approximate location shared by the student for this
                      application (rounded to about 1 km).
                    </p>
                    <a
                      className="applications-map-link"
                      href={`https://www.openstreetmap.org/?mlat=${selectedApplication.approximateLocation.latitude}&mlon=${selectedApplication.approximateLocation.longitude}#map=12/${selectedApplication.approximateLocation.latitude}/${selectedApplication.approximateLocation.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <IonIcon icon={locationOutline} />
                      View approximate location on map
                    </a>
                  </>
                ) : (
                  <p className="applications-location-note">
                    The student did not share a location with this application.
                  </p>
                )}
              </div>

              <div className="applications-detail-section">
                <h3>
                  <IonIcon icon={schoolOutline} />
                  Scholarship Information
                </h3>

                <div className="applications-detail-grid">
                  <div className="applications-detail-item">
                    <span>Scholarship Name</span>
                    <strong>{selectedApplication.scholarshipTitle}</strong>
                  </div>

                  <div className="applications-detail-item">
                    <span>Scholarship Amount</span>
                    <strong>
                      {formatCurrency(selectedApplication.scholarshipAmount)}
                    </strong>
                  </div>

                  <div className="applications-detail-item">
                    <span>Date Submitted</span>
                    <strong>{formatDate(selectedApplication.submittedAt)}</strong>
                  </div>
                </div>
              </div>

              <div className="applications-detail-section">
                <h3>
                  <IonIcon icon={documentTextOutline} />
                  Submitted Requirements
                </h3>

                {selectedApplication.requirements.length > 0 ? (
                  <div className="applications-document-list">
                    {selectedApplication.requirements.map((requirement, index) => {
                      const documentUrl = getSafeDocumentUrl(requirement.url);
                      const downloadUrl = getDocumentDownloadUrl(
                        requirement.url,
                      );
                      const canPreview =
                        !!documentUrl &&
                        getDocumentType(requirement) !== 'other';

                      return (
                        <div
                          className="applications-document-item"
                          key={`${requirement.name}-${index}`}
                        >
                          <div className="applications-document-icon">
                            <IonIcon icon={documentTextOutline} />
                          </div>

                          <div className="applications-document-info">
                            <strong>{requirement.name}</strong>
                            <span>
                              {requirement.requirementType
                                ? `${requirement.requirementType} · `
                                : ''}
                              {requirement.status || 'Submitted'}
                            </span>
                          </div>

                          {documentUrl ? (
                            <>
                              {canPreview && (
                                <IonButton
                                  size="small"
                                  fill="outline"
                                  onClick={() =>
                                    setPreviewRequirement(requirement)
                                  }
                                >
                                  <IonIcon
                                    icon={eyeOutline}
                                    slot="start"
                                  />
                                  Preview
                                </IonButton>
                              )}
                              <a
                                href={documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="applications-download-button"
                              >
                                <IonIcon icon={eyeOutline} />
                                Open file
                              </a>
                              <a
                                href={downloadUrl}
                                download={requirement.name}
                                className="applications-download-button"
                              >
                                <IonIcon icon={downloadOutline} />
                                Download
                              </a>
                            </>
                          ) : (
                            <span className="applications-no-file">
                              File link unavailable
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="applications-no-documents">
                    <IonIcon icon={fileTrayOutline} />
                    <p>No uploaded requirements found.</p>
                  </div>
                )}

                {previewRequirement && (
                  <div className="applications-document-preview">
                    <div className="applications-document-preview-header">
                      <strong>{previewRequirement.name}</strong>
                      <IonButton
                        size="small"
                        fill="clear"
                        onClick={() => setPreviewRequirement(null)}
                      >
                        Close preview
                      </IonButton>
                    </div>

                    {getDocumentType(previewRequirement) === 'image' ? (
                      <img
                        className="applications-document-preview-image"
                        src={getSafeDocumentUrl(previewRequirement.url)}
                        alt={previewRequirement.name}
                      />
                    ) : (
                      <iframe
                        className="applications-document-preview-frame"
                        src={getSafeDocumentUrl(previewRequirement.url)}
                        title={`Preview of ${previewRequirement.name}`}
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="applications-detail-section applications-review-section">
                <h3>
                  <IonIcon icon={clipboardOutline} />
                  Application Review
                </h3>

                <div className="applications-form-group">
                  <label>Update Application Status</label>

                  <IonSelect
                    value={newStatus}
                    interface="popover"
                    onIonChange={(event) =>
                      setNewStatus(event.detail.value as ApplicationStatus)
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <IonSelectOption key={status} value={status}>
                        {status}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </div>

                <div className="applications-form-group">
                  <label>
                    Remarks / Reason
                    {(newStatus === 'Rejected' || newStatus === 'For Compliance') && (
                      <span className="applications-required"> *</span>
                    )}
                  </label>

                  <IonTextarea
                    value={remarks}
                    onIonInput={(event) =>
                      setRemarks(event.detail.value ?? '')
                    }
                    placeholder={
                      newStatus === 'Rejected'
                        ? 'Explain why this application is rejected...'
                        : newStatus === 'For Compliance'
                          ? 'Specify the missing or incorrect requirements...'
                          : 'Add review notes or remarks (optional)...'
                    }
                    rows={4}
                    autoGrow={true}
                  />
                </div>

                <p className="applications-review-note">
                  The updated status and remarks will be saved to the application record.
                </p>
              </div>

            </div>

            <div className="applications-modal-footer">
              <IonButton
                fill="outline"
                color="medium"
                onClick={() => setShowDetails(false)}
                disabled={savingStatus}
              >
                Cancel
              </IonButton>

              <IonButton
                className="applications-save-button"
                onClick={() => void handleUpdateStatus()}
                disabled={savingStatus}
              >
                {savingStatus ? (
                  <IonSpinner name="crescent" />
                ) : (
                  'Save Review'
                )}
              </IonButton>
            </div>

          </div>
        )}
      </IonModal>

      <IonToast
        isOpen={toast.show}
        message={toast.message}
        color={toast.color}
        duration={3000}
        position="top"
        onDidDismiss={() =>
          setToast((previous) => ({
            ...previous,
            show: false,
          }))
        }
      />

    </div>
  );
};

export default Applications;
