
import React, { useEffect, useMemo, useState } from 'react';
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
  businessOutline,
  closeOutline,
} from 'ionicons/icons';

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../Firebase/config';

import './LGUSchoolAccounts.css';

interface Organization {
  id: string;
  name: string;
  type: string;
  email: string;
  contact: string;
  representative: string;
  address: string;
  status: string;
  rawData: Record<string, unknown>;
}

const LGUSchoolAccounts: React.FC = () => {
  const navigate = useNavigate();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const loadOrganizations = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const snapshot = await getDocs(
        collection(db, 'organizations')
      );

      const organizationList: Organization[] = snapshot.docs.map(
        (document) => {
          const data = document.data();

          return {
            id: document.id,
            name: String(
              data.organizationName ||
                data.orgName ||
                data.name ||
                data.schoolName ||
                data.lguName ||
                'Unnamed Organization'
            ),
            type: String(
              data.organizationType ||
                data.orgType ||
                data.type ||
                data.accountType ||
                'Not specified'
            ),
            email: String(
              data.orgEmail ||
                data.organizationEmail ||
                data.email ||
                data.accountEmail ||
                data.emailAddress ||
                'No email provided'
            ),
            contact: String(
              data.contactNumber ||
                data.contactNo ||
                data.phone ||
                data.phoneNumber ||
                'Not provided'
            ),
            representative: String(
              data.representativeName ||
                data.fullName ||
                data.contactPerson ||
                data.nameOfRepresentative ||
                'Not provided'
            ),
            address: String(
              data.organizationAddress ||
                data.orgAddress ||
                data.address ||
                'Not provided'
            ),
            status: String(data.status || 'Pending approval'),
            rawData: data,
          };
        }
      );

      setOrganizations(organizationList);
    } catch (error) {
      console.error('Error loading organizations:', error);

      setErrorMessage(
        'Unable to load LGU/School accounts. Check your Firebase connection, collection name, and Firestore permissions.'
      );
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrganizations();
  }, []);

  const filteredOrganizations = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return organizations;

    return organizations.filter((organization) =>
      [
        organization.name,
        organization.type,
        organization.email,
        organization.contact,
        organization.representative,
        organization.address,
        organization.status,
      ].some((value) => value.toLowerCase().includes(search))
    );
  }, [organizations, searchTerm]);

  const openDetails = (organization: Organization) => {
    setSelectedOrganization(organization);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedOrganization(null);
  };

  return (
    <IonPage>
      <IonContent
        fullscreen
        className="organizations-content"
      >
        <div className="organizations-page">

          {/* HEADER */}
          <header className="organizations-brand-header">
            <div className="organizations-brand">
              <img
                src="/image/logo3.png"
                alt="GrantAccess Logo"
                className="organizations-brand-logo"
              />

              <div className="organizations-brand-text">
                <h2>GrantAccess</h2>
                <p>ADMIN PORTAL</p>
              </div>
            </div>

            <IonButton
              className="organizations-refresh-button"
              onClick={() => void loadOrganizations()}
              disabled={loading}
            >
              <IonIcon icon={refreshOutline} slot="start" />
              Refresh
            </IonButton>
          </header>

          {/* PAGE TITLE */}
          <section className="organizations-page-heading">
            <p className="organizations-eyebrow">
              ORGANIZATION MANAGEMENT
            </p>

            <h1>LGU/School Accounts</h1>

            <p className="organizations-subtitle">
              View registered local government and school accounts.
            </p>
          </section>

          {/* SUMMARY */}
          <section className="organizations-summary-card">
            <div className="organizations-summary-icon">
              <IonIcon icon={businessOutline} />
            </div>

            <div>
              <p>Total Registered LGU/School Accounts</p>
              <h2>{loading ? '...' : organizations.length}</h2>
            </div>
          </section>

          {/* ORGANIZATION TABLE */}
          <section className="organizations-table-card">
            <div className="organizations-table-heading">
              <div>
                <h2>Organization List</h2>
                <p>Search and view registered organization information.</p>
              </div>

              <div className="organizations-search">
                <IonIcon icon={searchOutline} />

                <IonInput
                  value={searchTerm}
                  placeholder="Search organizations..."
                  clearInput
                  onIonInput={(event) =>
                    setSearchTerm(event.detail.value ?? '')
                  }
                />
              </div>
            </div>

            {loading ? (
              <div className="organizations-state">
                <IonSpinner name="crescent" />
                <p>Loading LGU/School accounts...</p>
              </div>
            ) : errorMessage ? (
              <div className="organizations-state">
                <h3>Unable to load accounts</h3>
                <p>{errorMessage}</p>

                <IonButton onClick={() => void loadOrganizations()}>
                  Try Again
                </IonButton>
              </div>
            ) : filteredOrganizations.length === 0 ? (
              <div className="organizations-state">
                <IonIcon icon={businessOutline} />

                <h3>
                  {organizations.length === 0
                    ? 'No registered organizations yet'
                    : 'No matching organizations found'}
                </h3>

                <p>
                  {organizations.length === 0
                    ? 'Registered LGU and school accounts saved in Firestore will appear here.'
                    : 'Try searching with another organization name, type, or email.'}
                </p>
              </div>
            ) : (
              <div className="organizations-table-wrapper">
                <table className="organizations-table">
                  <thead>
                    <tr>
                      <th>Organization Name</th>
                      <th>Type</th>
                      <th>Email Address</th>
                      <th>Contact Number</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredOrganizations.map((organization) => (
                      <tr key={organization.id}>
                        <td className="organization-name-cell">
                          {organization.name}
                        </td>

                        <td>{organization.type}</td>
                        <td>{organization.email}</td>
                        <td>{organization.contact}</td>

                        <td>
                          <span
                            className={`organization-status ${
                              ['active', 'approved'].includes(
                                organization.status.toLowerCase()
                              )
                                ? 'organization-status-active'
                                : 'organization-status-other'
                            }`}
                          >
                            {organization.status}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="organization-view-button"
                            onClick={() => openDetails(organization)}
                          >
                            <IonIcon icon={eyeOutline} />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading &&
              !errorMessage &&
              organizations.length > 0 && (
                <div className="organizations-table-footer">
                  Showing {filteredOrganizations.length} of{' '}
                  {organizations.length} organizations
                </div>
              )}
          </section>

          {/* BACK TO DASHBOARD */}
          <div className="organizations-bottom-actions">
            <button
              type="button"
              className="organizations-back-button"
              onClick={() => navigate('/admin-dashboard')}
            >
              
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* ORGANIZATION DETAILS MODAL */}
        <IonModal
          isOpen={showDetails}
          onDidDismiss={closeDetails}
          className="organization-details-modal"
        >
          <div className="organization-modal-content">
            <div className="organization-modal-header">
              <div className="organization-modal-brand">
                <img
                  src="public/image/logo3.png"
                  alt="GrantAccess Logo"
                  className="organization-modal-logo"
                />

                <div>
                  <p className="organizations-eyebrow">GRANTACCESS</p>
                  <h2>Organization Details</h2>
                </div>
              </div>

              <button
                type="button"
                className="organization-modal-close"
                onClick={closeDetails}
                aria-label="Close organization details"
              >
                <IonIcon icon={closeOutline} />
              </button>
            </div>

            {selectedOrganization && (
              <>
                <div className="organization-modal-profile">
                  <div className="organization-modal-avatar">
                    <IonIcon icon={businessOutline} />
                  </div>

                  <div>
                    <h3>{selectedOrganization.name}</h3>
                    <p>{selectedOrganization.type}</p>
                  </div>
                </div>

                <div className="organization-details-list">
                  <div className="organization-detail-item">
                    <span>Organization Name</span>
                    <strong>{selectedOrganization.name}</strong>
                  </div>

                  <div className="organization-detail-item">
                    <span>Organization Type</span>
                    <strong>{selectedOrganization.type}</strong>
                  </div>

                  <div className="organization-detail-item">
                    <span>Email Address</span>
                    <strong>{selectedOrganization.email}</strong>
                  </div>

                  <div className="organization-detail-item">
                    <span>Contact Number</span>
                    <strong>{selectedOrganization.contact}</strong>
                  </div>

                  <div className="organization-detail-item">
                    <span>Representative</span>
                    <strong>{selectedOrganization.representative}</strong>
                  </div>

                  <div className="organization-detail-item">
                    <span>Address</span>
                    <strong>{selectedOrganization.address}</strong>
                  </div>

                  <div className="organization-detail-item">
                    <span>Account Status</span>
                    <strong>{selectedOrganization.status}</strong>
                  </div>

                  {Object.entries(selectedOrganization.rawData)
                    .filter(([key, value]) => {
                      const hiddenKeys = [
                        'password',
                        'confirmPassword',
                        'email',
                        'orgEmail',
                        'organizationEmail',
                        'accountEmail',
                        'emailAddress',
                        'organizationName',
                        'orgName',
                        'name',
                        'schoolName',
                        'lguName',
                        'organizationType',
                        'orgType',
                        'type',
                        'accountType',
                        'contactNumber',
                        'contactNo',
                        'phone',
                        'phoneNumber',
                        'representativeName',
                        'fullName',
                        'contactPerson',
                        'nameOfRepresentative',
                        'organizationAddress',
                        'orgAddress',
                        'address',
                        'status',
                      ];

                      return (
                        !hiddenKeys.includes(key) &&
                        (typeof value === 'string' ||
                          typeof value === 'number' ||
                          typeof value === 'boolean')
                      );
                    })
                    .map(([key, value]) => (
                      <div className="organization-detail-item" key={key}>
                        <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                        <strong>{String(value)}</strong>
                      </div>
                    ))}
                </div>

                  <IonButton
                    expand="block"
                    className="organization-modal-done-button"
                    onClick={closeDetails}
                  >
                    Close
                  </IonButton>
              </>
            )}
          </div>
        </IonModal>

        <IonToast
          isOpen={showToast}
          message={errorMessage}
          duration={4000}
          color="danger"
          onDidDismiss={() => setShowToast(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default LGUSchoolAccounts;
