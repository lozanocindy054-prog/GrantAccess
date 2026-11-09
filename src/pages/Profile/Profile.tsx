
import React, { useEffect, useRef, useState } from 'react';
import {
  IonPage,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/react';
import {
  personOutline,
  createOutline,
  saveOutline,
  cameraOutline,
} from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, db } from '../../Firebase/config';
import StudentHeader from '../../components/StudentHeader';
import StudentBottomNav from '../../components/StudentBottomNav';
import './Profile.css';

interface StudentProfileData {
  fullName: string;
  email: string;
  studentId: string;
  school: string;
  course: string;
  yearLevel: string;
  phone: string;
  address: string;
  photoURL: string;
}

const emptyProfile: StudentProfileData = {
  fullName: '',
  email: '',
  studentId: '',
  school: '',
  course: '',
  yearLevel: '',
  phone: '',
  address: '',
  photoURL: '',
};

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<StudentProfileData>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState('');

  // LOAD PROFILE
  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (active) {
          setProfile(emptyProfile);
          setUserId('');
          setLoading(false);
          navigate('/register-choice', { replace: true });
        }
        return;
      }

      if (!active) return;

      setUserId(user.uid);
      setLoading(true);
      setError('');
      setMessage('');

      try {
        const snapshot = await getDoc(doc(db, 'students', user.uid));

        if (!active) return;

        if (snapshot.exists()) {
          const data = snapshot.data();

          setProfile({
            fullName: data.fullName ?? data.name ?? user.displayName ?? '',
            email: user.email ?? data.email ?? '',
            studentId: data.studentId ?? '',
            school: data.school ?? '',
            course: data.course ?? '',
            yearLevel: data.yearLevel ?? '',
            phone: data.phone ?? '',
            address: data.address ?? '',
            photoURL: data.photoURL ?? user.photoURL ?? '',
          });
        } else {
          setProfile({
            ...emptyProfile,
            fullName: user.displayName ?? '',
            email: user.email ?? '',
            photoURL: user.photoURL ?? '',
          });
        }
      } catch (loadError) {
        console.error('Unable to load student profile:', loadError);
        if (active) {
          setError('Unable to load your profile. Please check your connection and Firestore permissions.');
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  // LOGOUT MODAL ESCAPE KEY
  useEffect(() => {
    if (!showLogoutConfirm) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loggingOut) {
        setShowLogoutConfirm(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showLogoutConfirm, loggingOut]);

  // INPUT CHANGES
  const handleChange = (
    field: keyof StudentProfileData,
    value: string
  ) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
    setError('');
    setMessage('');
  };

  // UPLOAD PROFILE PHOTO
  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please select a JPG, PNG, or WebP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Your image must be 5 MB or smaller.');
      return;
    }

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      setError('Cloudinary is not configured. Check your .env file and restart the app.');
      return;
    }

    const user = auth.currentUser;

    if (!user || user.uid !== userId) {
      setError('Please log in again before uploading a photo.');
      return;
    }

    try {
      setUploadingPhoto(true);
      setError('');
      setMessage('');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'grantaccess/profile-pictures');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Cloudinary upload failed.');
      }

      const photoURL = result.secure_url;

      if (!photoURL) {
        throw new Error('Cloudinary did not return an image URL.');
      }

      await setDoc(
        doc(db, 'students', user.uid),
        {
          photoURL,
          uid: user.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setProfile((current) => ({ ...current, photoURL }));
      setMessage('Your profile picture has been updated successfully.');
    } catch (uploadError) {
      console.error('Profile picture upload failed:', uploadError);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Unable to upload your profile picture.'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  // SAVE PROFILE
  const handleSave = async () => {
    const user = auth.currentUser;

    if (!user || user.uid !== userId) {
      setError('Please log in again to update your profile.');
      return;
    }

    if (!profile.fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      await setDoc(
        doc(db, 'students', user.uid),
        {
          ...profile,
          fullName: profile.fullName.trim(),
          email: user.email ?? profile.email,
          uid: user.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMessage('Your profile has been saved successfully.');
      setEditing(false);
    } catch (saveError) {
      console.error('Unable to save student profile:', saveError);
      setError('Unable to save your profile. Please check your Firestore permissions.');
    } finally {
      setSaving(false);
    }
  };

  // CANCEL EDITING AND RESTORE SAVED DATA
  const handleCancelEditing = async () => {
    setEditing(false);
    setError('');
    setMessage('');

    const user = auth.currentUser;
    if (!user || user.uid !== userId) return;

    try {
      const snapshot = await getDoc(doc(db, 'students', user.uid));

      if (snapshot.exists()) {
        const data = snapshot.data();

        setProfile({
          fullName: data.fullName ?? data.name ?? user.displayName ?? '',
          email: user.email ?? data.email ?? '',
          studentId: data.studentId ?? '',
          school: data.school ?? '',
          course: data.course ?? '',
          yearLevel: data.yearLevel ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
          photoURL: data.photoURL ?? user.photoURL ?? '',
        });
      } else {
        setProfile({
          ...emptyProfile,
          fullName: user.displayName ?? '',
          email: user.email ?? '',
          photoURL: user.photoURL ?? '',
        });
      }
    } catch (cancelError) {
      console.error('Unable to restore profile:', cancelError);
      setError('Unable to reload your saved profile information.');
    }
  };

  // LOGOUT
  const handleLogout = () => {
    setError('');
    setMessage('');
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      setError('');

      await signOut(auth);
      setShowLogoutConfirm(false);
      navigate('/register-choice', { replace: true });
    } catch (logoutError) {
      console.error('Logout failed:', logoutError);
      setError('Unable to log out. Please try again.');
      setShowLogoutConfirm(false);
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = profile.fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <IonPage className="profile-page">
      <StudentHeader />

      <IonContent className="profile-content">
        <main className="profile-container">

          {/* PAGE HEADING */}
          <div className="profile-page-heading">
            <div>
              <p className="profile-eyebrow">STUDENT ACCOUNT</p>
              <h1>My Profile</h1>
              <p className="profile-intro">
                Manage your personal and educational information.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="profile-loading" role="status">
              <IonSpinner name="crescent" />
              <p>Loading your profile...</p>
            </div>
          ) : (
            <>
              {/* PROFILE SUMMARY CARD */}
              <section className="profile-summary-card">

                <div className="profile-avatar-wrapper">
                  <div className="profile-avatar">
                    {profile.photoURL ? (
                      <img
                        src={profile.photoURL}
                        alt="Student profile"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="profile-avatar-placeholder">
                        {initials || <IonIcon icon={personOutline} />}
                      </span>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="profile-file-input"
                    onChange={handlePhotoUpload}
                    aria-label="Choose a profile picture"
                    disabled={uploadingPhoto || loggingOut}
                  />

                  <button
                    type="button"
                    className="profile-photo-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto || loggingOut}
                  >
                    {uploadingPhoto ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <IonIcon icon={cameraOutline} />
                    )}
                    {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
                  </button>
                </div>

                <div className="profile-summary-text">
                  <h2>{profile.fullName || 'Student Name'}</h2>
                  <p>{profile.email || 'No email available'}</p>

                  <span className="profile-account-label">
                    Student Account
                  </span>

                  <p className="profile-photo-hint">
                    JPG, PNG, or WebP · Maximum 5 MB
                  </p>
                </div>

                {/* EDIT BUTTON INSIDE PROFILE CARD */}
                <div className="profile-summary-action">
                  <button
                    type="button"
                    className="profile-edit-button"
                    onClick={() => {
                      if (editing) {
                        handleCancelEditing();
                      } else {
                        setEditing(true);
                        setError('');
                        setMessage('');
                      }
                    }}
                    disabled={saving || loggingOut || uploadingPhoto}
                  >
                    <IonIcon icon={createOutline} />
                    {editing ? 'Cancel' : 'Edit Profile'}
                  </button>
                </div>
              </section>

              {/* ALERT MESSAGES */}
              {error && (
                <div className="profile-alert profile-alert-error" role="alert">
                  {error}
                </div>
              )}

              {message && (
                <div className="profile-alert profile-alert-success" role="status">
                  {message}
                </div>
              )}

              {/* PERSONAL INFORMATION */}
              <section className="profile-details-card">
                <div className="profile-card-heading">
                  <div>
                    <h2>Personal Information</h2>
                    <p>Your account and contact details</p>
                  </div>
                </div>

                <div className="profile-form-grid">
                  <label className="profile-field">
                    <span>Full Name *</span>
                    <input
                      type="text"
                      value={profile.fullName}
                      onChange={(event) => handleChange('fullName', event.target.value)}
                      placeholder="Enter your full name"
                      disabled={!editing || saving || loggingOut}
                      autoComplete="name"
                    />
                  </label>

                  <label className="profile-field">
                    <span>Email Address</span>
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      autoComplete="email"
                    />
                    <small>Your email comes from your authenticated account.</small>
                  </label>

                  <label className="profile-field">
                    <span>Student ID</span>
                    <input
                      type="text"
                      value={profile.studentId}
                      onChange={(event) => handleChange('studentId', event.target.value)}
                      placeholder="Enter student ID"
                      disabled={!editing || saving || loggingOut}
                    />
                  </label>

                  <label className="profile-field">
                    <span>Contact Number</span>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(event) => handleChange('phone', event.target.value)}
                      placeholder="Enter contact number"
                      disabled={!editing || saving || loggingOut}
                      autoComplete="tel"
                    />
                  </label>

                  <label className="profile-field">
                    <span>School / University</span>
                    <input
                      type="text"
                      value={profile.school}
                      onChange={(event) => handleChange('school', event.target.value)}
                      placeholder="Enter school name"
                      disabled={!editing || saving || loggingOut}
                    />
                  </label>

                  <label className="profile-field">
                    <span>Course / Program</span>
                    <input
                      type="text"
                      value={profile.course}
                      onChange={(event) => handleChange('course', event.target.value)}
                      placeholder="Enter course or program"
                      disabled={!editing || saving || loggingOut}
                    />
                  </label>

                  <label className="profile-field">
                    <span>Year Level</span>
                    <select
                      value={profile.yearLevel}
                      onChange={(event) => handleChange('yearLevel', event.target.value)}
                      disabled={!editing || saving || loggingOut}
                    >
                      <option value="">Select year level</option>
                      <option value="Grade 11">Grade 11</option>
                      <option value="Grade 12">Grade 12</option>
                      <option value="1st Year">1st Year College</option>
                      <option value="2nd Year">2nd Year College</option>
                      <option value="3rd Year">3rd Year College</option>
                      <option value="4th Year">4th Year College</option>
                      <option value="5th Year">5th Year College</option>
                      <option value="Graduate">Graduate</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label className="profile-field profile-field-full">
                    <span>Address</span>
                    <textarea
                      value={profile.address}
                      onChange={(event) => handleChange('address', event.target.value)}
                      placeholder="Enter your address"
                      disabled={!editing || saving || loggingOut}
                      rows={3}
                    />
                  </label>
                </div>

                {editing && (
                  <button
                    type="button"
                    className="profile-save-button"
                    onClick={handleSave}
                    disabled={saving || loggingOut}
                  >
                    {saving ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <IonIcon icon={saveOutline} />
                    )}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </section>

              {/* ACCOUNT SETTINGS */}
              <section className="profile-account-card">
                <div>
                  <h2>Account Settings</h2>
                  <p>Sign out of your GrantAccess student account.</p>
                </div>

                <button
                  type="button"
                  className="profile-logout-button"
                  onClick={handleLogout}
                  disabled={loggingOut || saving || uploadingPhoto}
                >
                  Log Out
                </button>
              </section>
            </>
          )}
        </main>

        {/* LOGOUT CONFIRMATION MODAL */}
        {showLogoutConfirm && (
          <div
            className="logout-modal-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !loggingOut) {
                setShowLogoutConfirm(false);
              }
            }}
          >
            <section
              className="logout-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="logout-modal-title"
              aria-describedby="logout-modal-description"
            >
              <h2 id="logout-modal-title">Confirm Logout</h2>
              <p id="logout-modal-description">
                Are you sure you want to log out?
              </p>

              <div className="logout-modal-actions">
                <button
                  type="button"
                  className="logout-cancel-button"
                  onClick={() => setShowLogoutConfirm(false)}
                  disabled={loggingOut}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="logout-confirm-button"
                  onClick={confirmLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? 'Logging Out...' : 'Log Out'}
                </button>
              </div>
            </section>
          </div>
        )}
      </IonContent>

      <StudentBottomNav />
    </IonPage>
  );
};

export default Profile;
