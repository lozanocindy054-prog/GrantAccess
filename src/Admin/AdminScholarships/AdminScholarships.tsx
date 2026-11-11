
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon,
  IonInput,
  IonSpinner,
  IonToast,
  IonModal,
} from '@ionic/react';

import {
  searchOutline,
  refreshOutline,
  eyeOutline,
  schoolOutline,
  closeOutline,
  cashOutline,
  calendarOutline,
  documentTextOutline,
} from 'ionicons/icons';

import { collection, getDocs, onSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';

import { db } from '../../Firebase/config';
import './AdminScholarships.css';

interface Scholarship {
  id: string;
  title: string;
  provider: string;
  amount: string;
  deadline: string;
  status: string;
  description: string;
  requirements: string;
}

const AdminScholarships: React.FC = () => {
  const navigate = useNavigate();

  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const [showDetails, setShowDetails] = useState(false);
  const [selectedScholarship, setSelectedScholarship] =
    useState<Scholarship | null>(null);

  const loadScholarships = useCallback(async (isRefresh = false, incoming?: QuerySnapshot<DocumentData>) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const snapshot = incoming ?? await getDocs(collection(db, 'scholarships'));

      const scholarshipList: Scholarship[] = snapshot.docs.map((item) => {
        const data = item.data();
        const requirements = data.requirements;

        return {
          id: item.id,
          title:
            data.title ||
            data.scholarshipName ||
            data.name ||
            'Untitled Scholarship',

          provider:
            data.providerName ||
            data.organizationName ||
            data.schoolName ||
            data.lguName ||
            data.provider ||
            'Not specified',

          amount: String(
            data.amount ??
              data.scholarshipAmount ??
              data.benefit ??
              data.benefits ??
              'Not specified'
          ),

          deadline: String(
            data.deadline ||
              data.applicationDeadline ||
              data.deadlineDate ||
              ''
          ),

          status: String(data.status || 'Active'),

          description: String(
            data.description ||
              data.details ||
              'No description provided.'
          ),

          requirements: Array.isArray(requirements)
            ? requirements.join(', ')
            : String(requirements || 'No requirements specified.'),
        };
      });

      setScholarships(scholarshipList);

      if (isRefresh) {
        setToastMessage('Scholarship list refreshed successfully.');
      }
    } catch (err) {
      console.error('Error loading scholarships:', err);

      setError(
        'Unable to load scholarships. Please check your Firebase connection.'
      );

      setToastMessage('Failed to load scholarships.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => onSnapshot(collection(db, 'scholarships'), snapshot => {
    void loadScholarships(false, snapshot);
  }, () => { setLoading(false); setError('Unable to load scholarships. Please check your connection.'); }), [loadScholarships]);

  const keyword = searchText.trim().toLowerCase();

  const filteredScholarships = scholarships.filter((scholarship) =>
    [
      scholarship.title,
      scholarship.provider,
      scholarship.amount,
      scholarship.deadline,
      scholarship.status,
    ].some((value) => value.toLowerCase().includes(keyword))
  );

  const openDetails = (scholarship: Scholarship) => {
    setSelectedScholarship(scholarship);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedScholarship(null);
  };

  const getStatusClass = (status: string) => {
    const normalizedStatus = status.trim().toLowerCase();

    if (
      ['active', 'approved', 'open'].includes(normalizedStatus)
    ) {
      return 'scholarship-status-active';
    }

    if (
      ['inactive', 'closed', 'rejected', 'expired'].includes(
        normalizedStatus
      )
    ) {
      return 'scholarship-status-inactive';
    }

    return 'scholarship-status-other';
  };

  return (
    <IonPage>
      <IonContent fullscreen className="admin-scholarships-content">
        <div className="admin-scholarships-page">

          {/* HEADER */}
          <header className="scholarships-brand-header">
            <div className="scholarships-brand">
              <img
                src="/mylogo.png"
                alt="GrantAccess Logo"
                className="scholarships-brand-logo"
              />

              <div className="scholarships-brand-text">
                <h2>GrantAccess</h2>
                <span>ADMIN PORTAL</span>
              </div>
            </div>

            <IonButton
              className="scholarships-refresh-button"
              onClick={() => void loadScholarships(true)}
              disabled={loading || refreshing}
            >
              {refreshing ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={refreshOutline} slot="start" />
              )}
              Refresh
            </IonButton>
          </header>

          {/* PAGE HEADING */}
          <section className="scholarships-page-heading">
            <span className="scholarships-eyebrow">
              SCHOLARSHIP MANAGEMENT
            </span>

            <h1>Scholarships</h1>

            <p>
              View and manage the scholarship listings available in
              GrantAccess.
            </p>
          </section>

          {/* SUMMARY CARD */}
          <section className="scholarships-summary-card">
            <div className="scholarships-summary-icon">
              <IonIcon icon={schoolOutline} />
            </div>

            <div>
              <p>Total Scholarships</p>
              <h2>{scholarships.length}</h2>
              <span>Scholarship records in the system</span>
            </div>
          </section>

          {/* SCHOLARSHIP TABLE */}
          <section className="scholarships-table-card">
            <div className="scholarships-table-heading">
              <div>
                <h2>Scholarship List</h2>
                <p>Review scholarship details and current status.</p>
              </div>

              <div className="scholarships-search">
                <IonIcon icon={searchOutline} />

                <IonInput
                  value={searchText}
                  placeholder="Search scholarships..."
                  onIonInput={(event) =>
                    setSearchText(event.detail.value ?? '')
                  }
                  clearInput
                />
              </div>
            </div>

            {loading ? (
              <div className="scholarships-state">
                <IonSpinner name="crescent" />
                <p>Loading scholarships...</p>
              </div>
            ) : error ? (
              <div className="scholarships-state scholarships-error">
                <p>{error}</p>

                <IonButton
                  className="scholarships-retry-button"
                  onClick={() => void loadScholarships()}
                >
                  Try Again
                </IonButton>
              </div>
            ) : filteredScholarships.length === 0 ? (
              <div className="scholarships-state">
                <IonIcon icon={schoolOutline} />

                <h3>
                  {searchText
                    ? 'No matching scholarships found'
                    : 'No scholarships available'}
                </h3>

                <p>
                  {searchText
                    ? 'Try using another search keyword.'
                    : 'Scholarship records will appear here once available.'}
                </p>
              </div>
            ) : (
              <>
                <div className="scholarships-table-wrapper">
                  <table className="scholarships-table">
                    <thead>
                      <tr>
                        <th>Scholarship Name</th>
                        <th>Provider</th>
                        <th>Amount / Benefit</th>
                        <th>Deadline</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredScholarships.map((scholarship) => (
                        <tr key={scholarship.id}>
                          <td>
                            <div className="scholarship-title-cell">
                              <div className="scholarship-row-icon">
                                <IonIcon icon={schoolOutline} />
                              </div>

                              <span>{scholarship.title}</span>
                            </div>
                          </td>

                          <td>{scholarship.provider}</td>

                          <td>{scholarship.amount}</td>

                          <td>
                            {scholarship.deadline || 'Not specified'}
                          </td>

                          <td>
                            <span
                              className={`scholarship-status ${getStatusClass(
                                scholarship.status
                              )}`}
                            >
                              {scholarship.status}
                            </span>
                          </td>

                          <td>
                            <IonButton
                              className="scholarship-view-button"
                              onClick={() => openDetails(scholarship)}
                            >
                              <IonIcon
                                icon={eyeOutline}
                                slot="start"
                              />
                              View
                            </IonButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="scholarships-table-footer">
                  <span>
                    Showing <strong>{filteredScholarships.length}</strong>
                    {' '}of <strong>{scholarships.length}</strong>
                    {' '}scholarships
                  </span>
                </div>
              </>
            )}
          </section>

          {/* BACK TO DASHBOARD */}
          <div className="scholarships-bottom-actions">
            <IonButton
              className="scholarships-back-button"
              onClick={() => navigate('/admin-dashboard')}
            >
            
              Back
            </IonButton>
          </div>
        </div>

        {/* SCHOLARSHIP DETAILS MODAL */}
        <IonModal
          isOpen={showDetails}
          onDidDismiss={closeDetails}
          className="scholarship-details-modal"
        >
          <div className="scholarship-modal-content">
            <div className="scholarship-modal-header">
              <div className="scholarship-modal-brand">
                <img
                  src="/mylogo.png"
                  alt="GrantAccess Logo"
                  className="scholarship-modal-logo"
                />

                <div>
                  <h2>Scholarship Details</h2>
                  <p>GrantAccess Admin Portal</p>
                </div>
              </div>

              <button
                type="button"
                className="scholarship-modal-close"
                onClick={closeDetails}
                aria-label="Close scholarship details"
              >
                <IonIcon icon={closeOutline} />
              </button>
            </div>

            {selectedScholarship && (
              <>
                <div className="scholarship-modal-title">
                  <div className="scholarship-modal-title-icon">
                    <IonIcon icon={schoolOutline} />
                  </div>

                  <div>
                    <span>Scholarship Information</span>
                    <h3>{selectedScholarship.title}</h3>
                  </div>
                </div>

                <div className="scholarship-details-list">
                  <div className="scholarship-detail-item">
                    <span className="scholarship-detail-label">
                      <IonIcon icon={schoolOutline} />
                      Provider
                    </span>
                    <p>{selectedScholarship.provider}</p>
                  </div>

                  <div className="scholarship-detail-item">
                    <span className="scholarship-detail-label">
                      <IonIcon icon={cashOutline} />
                      Amount / Benefit
                    </span>
                    <p>{selectedScholarship.amount}</p>
                  </div>

                  <div className="scholarship-detail-item">
                    <span className="scholarship-detail-label">
                      <IonIcon icon={calendarOutline} />
                      Application Deadline
                    </span>
                    <p>
                      {selectedScholarship.deadline || 'Not specified'}
                    </p>
                  </div>

                  <div className="scholarship-detail-item">
                    <span className="scholarship-detail-label">
                      Status
                    </span>
                    <p>
                      <span
                        className={`scholarship-status ${getStatusClass(
                          selectedScholarship.status
                        )}`}
                      >
                        {selectedScholarship.status}
                      </span>
                    </p>
                  </div>

                  <div className="scholarship-detail-item scholarship-detail-full">
                    <span className="scholarship-detail-label">
                      <IonIcon icon={documentTextOutline} />
                      Description
                    </span>
                    <p>{selectedScholarship.description}</p>
                  </div>

                  <div className="scholarship-detail-item scholarship-detail-full">
                    <span className="scholarship-detail-label">
                      <IonIcon icon={documentTextOutline} />
                      Requirements
                    </span>
                    <p>{selectedScholarship.requirements}</p>
                  </div>
                </div>

                <IonButton
                  expand="block"
                  className="scholarship-modal-done-button"
                  onClick={closeDetails}
                >
                  Close Details
                </IonButton>
              </>
            )}
          </div>
        </IonModal>

        <IonToast
          isOpen={!!toastMessage}
          message={toastMessage}
          duration={2500}
          position="bottom"
          onDidDismiss={() => setToastMessage('')}
        />
      </IonContent>
    </IonPage>
  );
};

export default AdminScholarships;
