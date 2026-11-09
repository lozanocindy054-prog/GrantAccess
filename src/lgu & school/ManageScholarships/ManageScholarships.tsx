import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  IonPage,
  IonContent,
  IonIcon,
  IonSpinner,
  IonToast,
  IonModal,
  IonButton,
  IonInput,
  IonTextarea,
  IonBadge,
  IonAlert,
} from '@ionic/react';

import {
  schoolOutline,
  searchOutline,
  addOutline,
  eyeOutline,
  createOutline,
  trashOutline,
  closeOutline,
  documentTextOutline,
  calendarOutline,
  cashOutline,
  refreshOutline,
  homeOutline,
  logOutOutline,
  businessOutline,
  checkmarkCircleOutline,
  timeOutline,
  alertCircleOutline,
  downloadOutline,
} from 'ionicons/icons';

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';

import {
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';

import { auth, db } from '../../Firebase/config';
import './ManageScholarships.css';

const MAX_REQUIRED_DOCUMENTS = 10;

const parseRequiredDocuments = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

// ==========================================
// INTERFACES
// ==========================================

interface Scholarship {
  id: string;
  title: string;
  description: string;
  provider: string;
  amount: string;
  deadline: string;
  academicYear: string;
  qualifications: string;
  eligibility: string;
  requirements: string;
  requiredDocuments: string[];
  attachments: { name: string; url: string }[];
  status: string;
  organizationId: string;
}

interface ScholarshipForm {
  title: string;
  description: string;
  provider: string;
  amount: string;
  deadline: string;
  academicYear: string;
  qualifications: string;
  eligibility: string;
  requirements: string;
  requiredDocuments: string;
}

interface ManageScholarshipsProps {
  isModal?: boolean;
  onClose?: () => void;
}

const EMPTY_FORM: ScholarshipForm = {
  title: '',
  description: '',
  provider: '',
  amount: '',
  deadline: '',
  academicYear: '',
  qualifications: '',
  eligibility: '',
  requirements: '',
  requiredDocuments: '',
};

// ==========================================
// COMPONENT
// ==========================================

const ManageScholarships: React.FC<ManageScholarshipsProps> = ({
  isModal = false,
  onClose,
}) => {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');

  const [selectedScholarship, setSelectedScholarship] =
    useState<Scholarship | null>(null);

  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const [form, setForm] = useState<ScholarshipForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState({
    isOpen: false,
    message: '',
    color: 'success' as 'success' | 'danger' | 'warning',
  });

  // ==========================================
  // TOAST
  // ==========================================

  const showMessage = useCallback(
    (
      message: string,
      color: 'success' | 'danger' | 'warning' = 'success'
    ) => {
      setToast({
        isOpen: true,
        message,
        color,
      });
    },
    []
  );

  // ==========================================
  // FIREBASE AUTH + LIVE SCHOLARSHIP DATA
  // ==========================================

  useEffect(() => {
    let active = true;
    let unsubscribeScholarships: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeScholarships?.();
      unsubscribeScholarships = undefined;

      if (!active) return;

      setCurrentUser(user);
      setScholarships([]);
      setLoading(Boolean(user));

      if (!user) {
        setLoading(false);
        return;
      }

      const scholarshipQuery = query(
        collection(db, 'scholarships'),
        where('organizationId', '==', user.uid)
      );

      unsubscribeScholarships = onSnapshot(
        scholarshipQuery,
        (snapshot) => {
          if (!active) return;

          const scholarshipData: Scholarship[] = snapshot.docs.map(
            (document) => {
              const data = document.data();

              return {
                id: document.id,
                title: String(data.title ?? data.name ?? 'Untitled Scholarship'),
                description: String(data.description ?? ''),
                provider: String(data.provider ?? data.organizationName ?? ''),
                amount: String(data.amount ?? ''),
                deadline: String(data.deadline ?? ''),
                academicYear: String(data.academicYear ?? ''),
                qualifications: String(data.qualifications ?? ''),
                eligibility: String(data.eligibility ?? ''),
                requirements: String(data.requirements ?? ''),
                requiredDocuments: Array.isArray(data.requiredDocuments)
                  ? data.requiredDocuments.filter(
                      (item): item is string => typeof item === 'string'
                    )
                  : String(data.requirements ?? '')
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean),
                attachments: Array.isArray(data.attachments)
                  ? data.attachments.filter(
                      (item): item is { name: string; url: string } =>
                        typeof item === 'object' &&
                        item !== null &&
                        'name' in item &&
                        typeof item.name === 'string' &&
                        'url' in item &&
                        typeof item.url === 'string'
                    )
                  : [],
                status: String(data.status ?? 'Pending'),
                organizationId: String(data.organizationId ?? ''),
              };
            }
          );

          scholarshipData.sort((a, b) =>
            a.title.localeCompare(b.title)
          );

          setScholarships(scholarshipData);
          setLoading(false);
        },
        (error) => {
          console.error('Scholarships loading error:', error);

          if (!active) return;

          setLoading(false);
          showMessage(
            'Unable to load scholarships. Please check your Firestore Rules.',
            'danger'
          );
        }
      );
    });

    return () => {
      active = false;
      unsubscribeAuth();
      unsubscribeScholarships?.();
    };
  }, [showMessage]);

  // ==========================================
  // SEARCH + FILTER
  // ==========================================

  const filteredScholarships = useMemo(() => {
    const keyword = searchTerm.toLowerCase().trim();

    return scholarships.filter((scholarship) => {
      const matchesSearch =
        scholarship.title.toLowerCase().includes(keyword) ||
        scholarship.description.toLowerCase().includes(keyword) ||
        scholarship.provider.toLowerCase().includes(keyword) ||
        scholarship.status.toLowerCase().includes(keyword);

      const matchesFilter =
        selectedFilter === 'All' ||
        scholarship.status.toLowerCase() === selectedFilter.toLowerCase();

      return matchesSearch && matchesFilter;
    });
  }, [scholarships, searchTerm, selectedFilter]);

  // ==========================================
  // STATISTICS
  // ==========================================

  const totalCount = scholarships.length;

  const publishedCount = scholarships.filter(
    (item) => item.status.toLowerCase() === 'published'
  ).length;

  const pendingCount = scholarships.filter(
    (item) => item.status.toLowerCase() === 'pending'
  ).length;

  const rejectedCount = scholarships.filter(
    (item) => item.status.toLowerCase() === 'rejected'
  ).length;

  // ==========================================
  // NAVIGATION
  // ==========================================

  const handleNavigation = (path: string) => {
    if (isModal) {
      onClose?.();
    }

    navigate(path);
  };

  // ==========================================
  // VIEW SCHOLARSHIP
  // ==========================================

  const openViewModal = (scholarship: Scholarship) => {
    setSelectedScholarship(scholarship);
    setShowViewModal(true);
  };

  // ==========================================
  // OPEN EDIT MODAL
  // ==========================================

  const openEditModal = (scholarship: Scholarship) => {
    if (scholarship.organizationId !== currentUser?.uid) {
      showMessage('You are not authorized to edit this scholarship.', 'danger');
      return;
    }

    setSelectedScholarship(scholarship);

    setForm({
      title: scholarship.title,
      description: scholarship.description,
      provider: scholarship.provider,
      amount: scholarship.amount,
      deadline: scholarship.deadline,
      academicYear: scholarship.academicYear,
      qualifications: scholarship.qualifications,
      eligibility: scholarship.eligibility,
      requirements: scholarship.requirements,
      requiredDocuments: scholarship.requiredDocuments.join('\n'),
    });

    setShowEditModal(true);
  };

  // ==========================================
  // FORM CHANGE
  // ==========================================

  const updateForm = (field: keyof ScholarshipForm, value: string) => {
    if (field === 'requiredDocuments') {
      const requiredDocuments = parseRequiredDocuments(value);
      if (requiredDocuments.length > MAX_REQUIRED_DOCUMENTS) {
        showMessage(
          `You can add up to ${MAX_REQUIRED_DOCUMENTS} required documents.`,
          'warning'
        );
        setForm((previous) => ({
          ...previous,
          requiredDocuments: requiredDocuments
            .slice(0, MAX_REQUIRED_DOCUMENTS)
            .join('\n'),
        }));
        return;
      }
    }

    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  // ==========================================
  // SAVE EDIT
  // ==========================================

  const saveEdit = async () => {
    if (!selectedScholarship || !currentUser) {
      showMessage('Unable to identify the scholarship.', 'danger');
      return;
    }

    if (selectedScholarship.organizationId !== currentUser.uid) {
      showMessage('You are not authorized to edit this scholarship.', 'danger');
      return;
    }

    if (!form.title.trim()) {
      showMessage('Please enter the scholarship title.', 'warning');
      return;
    }

    const requiredDocuments = parseRequiredDocuments(
      form.requiredDocuments
    );
    if (requiredDocuments.length > MAX_REQUIRED_DOCUMENTS) {
      showMessage(
        `You can add up to ${MAX_REQUIRED_DOCUMENTS} required documents.`,
        'warning'
      );
      return;
    }

    try {
      setSaving(true);

      await updateDoc(
        doc(db, 'scholarships', selectedScholarship.id),
        {
          title: form.title.trim(),
          description: form.description.trim(),
          provider: form.provider.trim(),
          amount: form.amount.trim(),
          deadline: form.deadline,
          academicYear: form.academicYear.trim(),
          qualifications: form.qualifications.trim(),
          eligibility: form.eligibility.trim(),
          requirements: form.requirements.trim(),
          requiredDocuments,
          updatedAt: new Date(),
        }
      );

      setShowEditModal(false);
      showMessage('Scholarship updated successfully.', 'success');
    } catch (error) {
      console.error('Update scholarship error:', error);
      showMessage('Unable to update scholarship. Please try again.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // DELETE SCHOLARSHIP
  // ==========================================

  const openDeleteAlert = (scholarship: Scholarship) => {
    if (scholarship.organizationId !== currentUser?.uid) {
      showMessage('You are not authorized to delete this scholarship.', 'danger');
      return;
    }

    setSelectedScholarship(scholarship);
    setShowDeleteAlert(true);
  };

  const deleteScholarship = async () => {
    if (!selectedScholarship || !currentUser) return;

    if (selectedScholarship.organizationId !== currentUser.uid) {
      showMessage('You are not authorized to delete this scholarship.', 'danger');
      return;
    }

    try {
      setDeleting(true);

      await deleteDoc(
        doc(db, 'scholarships', selectedScholarship.id)
      );

      setShowDeleteAlert(false);
      setSelectedScholarship(null);
      showMessage('Scholarship deleted successfully.', 'success');
    } catch (error) {
      console.error('Delete scholarship error:', error);
      showMessage('Unable to delete scholarship. Please try again.', 'danger');
    } finally {
      setDeleting(false);
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = async () => {
    try {
      await signOut(auth);

      if (isModal) {
        onClose?.();
      }

      navigate('/lgu-login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      showMessage('Unable to log out. Please try again.', 'danger');
    }
  };

  // ==========================================
  // STATUS CLASS
  // ==========================================

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'published':
        return 'published';
      case 'approved':
        return 'approved';
      case 'rejected':
        return 'rejected';
      default:
        return 'pending';
    }
  };

  // ==========================================
  // DISPLAY
  // ==========================================

  return (
    <IonPage className={isModal ? 'ms-page ms-page-modal' : 'ms-page'}>
      <IonContent fullscreen className="ms-content">
        <div className="ms-layout">

          {/* TOP BAR */}

          <header className="ms-topbar">
            <div className="ms-brand">
              <span className="ms-brand-icon">
                <IonIcon icon={schoolOutline} />
              </span>

              <div>
                <strong>GrantAccess</strong>
                <small>LGU / School Portal</small>
              </div>
            </div>

            <div className="ms-topbar-actions">
              <span className="ms-account">
                <IonIcon icon={businessOutline} />
                {currentUser?.email ?? 'Organization Account'}
              </span>

              <button
                type="button"
                className="ms-logout-button"
                onClick={handleLogout}
              >
                <IonIcon icon={logOutOutline} />
                Log Out
              </button>
            </div>
          </header>

          {/* MAIN CONTENT */}

          <main className="ms-main">

            {/* WELCOME BANNER */}

            <section className="ms-welcome">
              <div>
                <span className="ms-eyebrow">
                  <IonIcon icon={schoolOutline} />
                  ORGANIZATION PORTAL
                </span>

                <h1>Manage Scholarships</h1>

                <p>
                  Create, view, update, and manage your organization's
                  scholarship opportunities in one place.
                </p>

                <button
                  type="button"
                  className="ms-primary-button"
                  onClick={() => handleNavigation('/lgu-add-scholarship')}
                >
                  <IonIcon icon={addOutline} />
                  Add Scholarship
                </button>
              </div>

              <div className="ms-welcome-art">
                <IonIcon icon={documentTextOutline} />
                <strong>Scholarship Management</strong>
                <span>Support students through education.</span>
              </div>
            </section>

            {/* BREADCRUMB + TITLE */}

            <div className="ms-heading-row">
              <div>
                <div className="ms-breadcrumb">
                  <button
                    type="button"
                    onClick={() => handleNavigation('/lgu-dashboard')}
                  >
                    <IonIcon icon={homeOutline} />
                    Dashboard
                  </button>
                  <span>/</span>
                  <strong>Manage Scholarships</strong>
                </div>

                <h2>Scholarship Listings</h2>
                <p>View and manage all scholarship listings posted by your organization.</p>
              </div>

              <span className="ms-live">
                <span />
                Live Data
              </span>
            </div>

            {/* SUMMARY CARDS */}

            <section className="ms-summary-grid">
              <article className="ms-summary-card">
                <span className="ms-summary-icon green">
                  <IonIcon icon={documentTextOutline} />
                </span>
                <div>
                  <small>Total Scholarships</small>
                  <strong>{loading ? <IonSpinner name="crescent" /> : totalCount}</strong>
                </div>
              </article>

              <article className="ms-summary-card">
                <span className="ms-summary-icon blue">
                  <IonIcon icon={checkmarkCircleOutline} />
                </span>
                <div>
                  <small>Published</small>
                  <strong>{loading ? <IonSpinner name="crescent" /> : publishedCount}</strong>
                </div>
              </article>

              <article className="ms-summary-card">
                <span className="ms-summary-icon orange">
                  <IonIcon icon={timeOutline} />
                </span>
                <div>
                  <small>Pending</small>
                  <strong>{loading ? <IonSpinner name="crescent" /> : pendingCount}</strong>
                </div>
              </article>

              <article className="ms-summary-card">
                <span className="ms-summary-icon red">
                  <IonIcon icon={alertCircleOutline} />
                </span>
                <div>
                  <small>Rejected</small>
                  <strong>{loading ? <IonSpinner name="crescent" /> : rejectedCount}</strong>
                </div>
              </article>
            </section>

            {/* SCHOLARSHIP LIST */}

            <section className="ms-list-section" id="ms-scholarship-list">
              <div className="ms-list-heading">
                <div>
                  <h2>My Scholarship Listings</h2>
                  <p>Search and manage your scholarship opportunities.</p>
                </div>

                <button
                  type="button"
                  className="ms-add-button"
                  onClick={() => handleNavigation('/lgu-add-scholarship')}
                >
                  <IonIcon icon={addOutline} />
                  Add Scholarship
                </button>
              </div>

              {/* SEARCH + FILTER */}

              <div className="ms-toolbar">
                <div className="ms-search-box">
                  <IonIcon icon={searchOutline} />
                  <IonInput
                    value={searchTerm}
                    placeholder="Search scholarship title, provider, or status..."
                    onIonInput={(event) =>
                      setSearchTerm(String(event.detail.value ?? ''))
                    }
                    clearInput
                  />
                </div>

                <div className="ms-filter-group">
                  {['All', 'Published', 'Pending', 'Rejected'].map((filter) => (
                    <button
                      type="button"
                      key={filter}
                      className={selectedFilter === filter ? 'active' : ''}
                      onClick={() => setSelectedFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* LOADING */}

              {loading ? (
                <div className="ms-state">
                  <IonSpinner name="crescent" />
                  <p>Loading your scholarships...</p>
                </div>
              ) : !currentUser ? (
                <div className="ms-state">
                  <IonIcon icon={alertCircleOutline} />
                  <h3>Account not found</h3>
                  <p>Please log in using your LGU / School account.</p>
                </div>
              ) : filteredScholarships.length === 0 ? (
                <div className="ms-empty">
                  <span>
                    <IonIcon icon={schoolOutline} />
                  </span>

                  <h3>
                    {scholarships.length === 0
                      ? 'No Scholarships Yet'
                      : 'No Matching Scholarships'}
                  </h3>

                  <p>
                    {scholarships.length === 0
                      ? 'You have not posted any scholarship opportunities yet. Add your first scholarship to get started.'
                      : 'No scholarship listings match your search or selected status.'}
                  </p>

                  {scholarships.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => handleNavigation('/lgu-add-scholarship')}
                    >
                      <IonIcon icon={addOutline} />
                      Add Your First Scholarship
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedFilter('All');
                      }}
                    >
                      <IonIcon icon={refreshOutline} />
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="ms-scholarship-grid">
                  {filteredScholarships.map((scholarship) => (
                    <article className="ms-scholarship-card" key={scholarship.id}>
                      <div className="ms-card-top">
                        <span className="ms-card-icon">
                          <IonIcon icon={schoolOutline} />
                        </span>

                        <IonBadge className={`ms-status ${getStatusClass(scholarship.status)}`}>
                          {scholarship.status}
                        </IonBadge>
                      </div>

                      <h3>{scholarship.title}</h3>

                      <p className="ms-card-description">
                        {scholarship.description || 'No description provided.'}
                      </p>

                      <div className="ms-card-details">
                        <div>
                          <IonIcon icon={businessOutline} />
                          <span>{scholarship.provider || 'Organization'}</span>
                        </div>

                        <div>
                          <IonIcon icon={cashOutline} />
                          <span>{scholarship.amount || 'Amount not specified'}</span>
                        </div>

                        <div>
                          <IonIcon icon={calendarOutline} />
                          <span>
                            {scholarship.deadline || 'No deadline specified'}
                          </span>
                        </div>
                      </div>

                      <div className="ms-card-actions">
                        <button
                          type="button"
                          className="ms-view-button"
                          onClick={() => openViewModal(scholarship)}
                        >
                          <IonIcon icon={eyeOutline} />
                          View
                        </button>

                        <button
                          type="button"
                          className="ms-edit-button"
                          onClick={() => openEditModal(scholarship)}
                        >
                          <IonIcon icon={createOutline} />
                          Edit
                        </button>

                        <button
                          type="button"
                          className="ms-delete-button"
                          onClick={() => openDeleteAlert(scholarship)}
                        >
                          <IonIcon icon={trashOutline} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* FOOTER */}

            <footer className="ms-footer">
              <span>© {new Date().getFullYear()} GrantAccess. All rights reserved.</span>
              <span>
                <IonIcon icon={checkmarkCircleOutline} />
                LGU / School Portal
              </span>
            </footer>
          </main>
        </div>
      </IonContent>

      {/* VIEW SCHOLARSHIP MODAL */}

      <IonModal
        isOpen={showViewModal}
        onDidDismiss={() => setShowViewModal(false)}
        className="ms-modal"
      >
        <div className="ms-modal-container">
          <div className="ms-modal-header">
            <div>
              <span>Scholarship Information</span>
              <h2>Scholarship Details</h2>
            </div>

            <button
              type="button"
              onClick={() => setShowViewModal(false)}
              aria-label="Close details"
            >
              <IonIcon icon={closeOutline} />
            </button>
          </div>

          {selectedScholarship && (
            <div className="ms-modal-body">
              <div className="ms-detail-title">
                <span><IonIcon icon={schoolOutline} /></span>
                <div>
                  <h3>{selectedScholarship.title}</h3>
                  <IonBadge className={`ms-status ${getStatusClass(selectedScholarship.status)}`}>
                    {selectedScholarship.status}
                  </IonBadge>
                </div>
              </div>

              <div className="ms-detail-grid">
                <div>
                  <small>Provider</small>
                  <strong>{selectedScholarship.provider || 'Not specified'}</strong>
                </div>
                <div>
                  <small>Scholarship Amount</small>
                  <strong>{selectedScholarship.amount || 'Not specified'}</strong>
                </div>
                <div>
                  <small>Deadline</small>
                  <strong>{selectedScholarship.deadline || 'Not specified'}</strong>
                </div>
                <div>
                  <small>Academic Year</small>
                  <strong>{selectedScholarship.academicYear || 'Not specified'}</strong>
                </div>
              </div>

              <div className="ms-detail-section">
                <h4>Description</h4>
                <p>{selectedScholarship.description || 'No description provided.'}</p>
              </div>

              <div className="ms-detail-section">
                <h4>Qualifications</h4>
                <p>
                  {selectedScholarship.qualifications ||
                    selectedScholarship.eligibility ||
                    'No qualifications provided.'}
                </p>
              </div>

              <div className="ms-detail-section">
                <h4>Documents Students Must Submit</h4>
                {selectedScholarship.requiredDocuments.length > 0 ? (
                  selectedScholarship.requiredDocuments.map((requirement) => (
                    <p key={requirement}>{requirement}</p>
                  ))
                ) : (
                  <p>No required documents listed.</p>
                )}
              </div>

              <div className="ms-detail-section">
                <h4>Additional Requirements</h4>
                <p>{selectedScholarship.requirements || 'No requirements provided.'}</p>
              </div>

              {selectedScholarship.attachments.length > 0 && (
                <div className="ms-detail-section">
                  <h4>Downloadable Forms</h4>
                  {selectedScholarship.attachments.map((file, index) => (
                    <a
                      className="ms-document-link"
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={`${file.url}-${index}`}
                    >
                      <IonIcon icon={downloadOutline} />
                      {file.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="ms-modal-footer">
            <IonButton expand="block" onClick={() => setShowViewModal(false)}>
              Close
            </IonButton>
          </div>
        </div>
      </IonModal>

      {/* EDIT SCHOLARSHIP MODAL */}

      <IonModal
        isOpen={showEditModal}
        onDidDismiss={() => setShowEditModal(false)}
        className="ms-modal"
      >
        <div className="ms-modal-container">
          <div className="ms-modal-header">
            <div>
              <span>Update Listing</span>
              <h2>Edit Scholarship</h2>
            </div>

            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              aria-label="Close edit form"
            >
              <IonIcon icon={closeOutline} />
            </button>
          </div>

          <div className="ms-modal-body ms-edit-form">
            <label>Scholarship Title *</label>
            <IonInput
              value={form.title}
              placeholder="Enter scholarship title"
              onIonInput={(event) =>
                updateForm('title', String(event.detail.value ?? ''))
              }
            />

            <label>Description</label>
            <IonTextarea
              value={form.description}
              placeholder="Enter scholarship description"
              autoGrow
              onIonInput={(event) =>
                updateForm('description', String(event.detail.value ?? ''))
              }
            />

            <label>Provider / Organization</label>
            <IonInput
              value={form.provider}
              placeholder="Enter provider name"
              onIonInput={(event) =>
                updateForm('provider', String(event.detail.value ?? ''))
              }
            />

            <div className="ms-form-two-columns">
              <div>
                <label>Scholarship Amount</label>
                <IonInput
                  value={form.amount}
                  placeholder="e.g. ₱10,000"
                  onIonInput={(event) =>
                    updateForm('amount', String(event.detail.value ?? ''))
                  }
                />
              </div>

              <div>
                <label>Application Deadline</label>
                <IonInput
                  type="date"
                  value={form.deadline}
                  onIonInput={(event) =>
                    updateForm('deadline', String(event.detail.value ?? ''))
                  }
                />
              </div>
            </div>

            <label>Academic Year</label>
            <IonInput
              value={form.academicYear}
              placeholder="e.g. 2026-2027"
              onIonInput={(event) =>
                updateForm('academicYear', String(event.detail.value ?? ''))
              }
            />

            <label>Qualifications</label>
            <IonTextarea
              value={form.qualifications}
              placeholder="Enter qualifications"
              autoGrow
              onIonInput={(event) =>
                updateForm('qualifications', String(event.detail.value ?? ''))
              }
            />

            <label>Eligibility</label>
            <IonTextarea
              value={form.eligibility}
              placeholder="Enter eligibility requirements"
              autoGrow
              onIonInput={(event) =>
                updateForm('eligibility', String(event.detail.value ?? ''))
              }
            />

            <label>Requirements</label>
            <IonTextarea
              value={form.requirements}
              placeholder="Enter additional requirements or application notes"
              autoGrow
              onIonInput={(event) =>
                updateForm('requirements', String(event.detail.value ?? ''))
              }
            />

            <label>Documents Students Must Submit</label>
            <IonTextarea
              value={form.requiredDocuments}
              placeholder={'One required document per line\nCertificate of Registration\nLatest grades'}
              autoGrow
              onIonInput={(event) =>
                updateForm(
                  'requiredDocuments',
                  String(event.detail.value ?? '')
                )
              }
            />
            <small className="ms-requirements-count">
              {parseRequiredDocuments(form.requiredDocuments).length}/
              {MAX_REQUIRED_DOCUMENTS} required documents
            </small>
          </div>

          <div className="ms-modal-footer ms-edit-footer">
            <IonButton
              fill="outline"
              color="medium"
              onClick={() => setShowEditModal(false)}
              disabled={saving}
            >
              Cancel
            </IonButton>

            <IonButton
              onClick={saveEdit}
              disabled={saving}
            >
              {saving ? <IonSpinner name="crescent" /> : 'Save Changes'}
            </IonButton>
          </div>
        </div>
      </IonModal>

      {/* DELETE CONFIRMATION */}

      <IonAlert
        isOpen={showDeleteAlert}
        header="Delete Scholarship"
        message={`Are you sure you want to delete "${selectedScholarship?.title ?? 'this scholarship'}"? This action cannot be undone.`}
        buttons={[
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => setShowDeleteAlert(false),
          },
          {
            text: deleting ? 'Deleting...' : 'Delete',
            role: 'destructive',
            handler: () => {
              void deleteScholarship();
            },
          },
        ]}
        onDidDismiss={() => setShowDeleteAlert(false)}
      />

      {/* TOAST */}

      <IonToast
        isOpen={toast.isOpen}
        message={toast.message}
        color={toast.color}
        duration={3500}
        position="top"
        onDidDismiss={() =>
          setToast((previous) => ({
            ...previous,
            isOpen: false,
          }))
        }
      />
    </IonPage>
  );
};

export default ManageScholarships;