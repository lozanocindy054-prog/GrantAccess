
import React, { useEffect, useRef, useState } from 'react';
import {
  IonContent,
  IonPage,
  IonToast,
  IonIcon,
} from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import {
  businessOutline,
  locationOutline,
  mailOutline,
  callOutline,
  personOutline,
  briefcaseOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import './Register.css';

import {
  createUserWithEmailAndPassword,
  deleteUser,
  type User,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../Firebase/config';
import { sendVerificationEmail } from '../../services/emailVerificationService';

const Register: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const contentRef = useRef<HTMLIonContentElement>(null);
  useEffect(() => { void contentRef.current?.scrollToTop?.(200); }, [step]);
  const [organizationType, setOrganizationType] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [address, setAddress] = useState('');
  const [organizationEmail, setOrganizationEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const [representativeName, setRepresentativeName] = useState('');
  const [position, setPosition] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  const validateOrganization = () => {
    if (
      !organizationType ||
      !organizationName.trim() ||
      !address.trim() ||
      !contactNumber.trim()
    ) {
      showMessage('Please complete all organization information.');
      return false;
    }

    const phoneRegex = /^[0-9+\-()\s]{7,20}$/;

    if (!phoneRegex.test(contactNumber.trim())) {
      showMessage('Please enter a valid contact number.');
      return false;
    }

    return true;
  };

  const validateRepresentative = () => {
    if (!representativeName.trim() || !position.trim()) {
      showMessage('Please complete the representative information.');
      return false;
    }

    return true;
  };

  const validatePassword = () => {
    if (!password || !confirmPassword) {
      showMessage('Please enter and confirm your password.');
      return false;
    }

    if (password.length < 8) {
      showMessage('Password must contain at least 8 characters.');
      return false;
    }

    if (password !== confirmPassword) {
      showMessage('Passwords do not match.');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (isSubmitting) return;
    if (step === 1) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organizationEmail.trim())) {
        showMessage('Please enter a valid organization email.'); return;
      }
      setStep(2);
    } else if (step === 2 && validatePassword()) setStep(3);
    else if (step === 3 && validateOrganization()) setStep(4);
  };

  const handlePrevious = () => {
    if (step > 1) {

      setStep(step === 2 ? 1 : step - 1);
      }
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (isSubmitting) return;
    if (step < 4) {
      await handleNext();
      return;
    }

    if (
      !validatePassword() ||
      !validateOrganization() ||
      !validateRepresentative()
    ) return;
    if (!acceptedTerms) {
      showMessage('Please accept the terms and conditions.');
      return;
    }


    setIsSubmitting(true);

    let createdUser: User | null = null;
    let profileSaved = false;

    try {
      const email = organizationEmail.trim().toLowerCase();



      // Create account in Firebase Authentication.
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      createdUser = credential.user;

      // Save organization information in Firestore.
      await setDoc(doc(db, 'organizations', createdUser.uid), {
        uid: createdUser.uid,
        organizationType,
        organizationName: organizationName.trim(),
        address: address.trim(),
        organizationEmail: email,
        contactNumber: contactNumber.trim(),
        representativeName: representativeName.trim(),
        position: position.trim(),
        role: 'lgu_school',
        status: 'active',
        emailVerified: false,
        createdAt: serverTimestamp(),
      });

      profileSaved = true;

      try { await sendVerificationEmail(createdUser); }
      catch { /* The verification page allows retrying without recreating the account. */ }
      navigate('/verify-email', { replace: true });
    } catch (error: unknown) {
      console.error('LGU/School registration error:', error);

      const firebaseError = error as {
        code?: string;
        message?: string;
      };

      if (firebaseError.code === 'auth/email-already-in-use') {
        showMessage(
          'This email is already registered. Please use another email.'
        );
      } else if (firebaseError.code === 'auth/invalid-email') {
        showMessage('Please enter a valid email address.');
      } else if (firebaseError.code === 'auth/weak-password') {
        showMessage(
          'Password is too weak. Please use at least 8 characters.'
        );
      } else if (
        firebaseError.code === 'auth/operation-not-allowed'
      ) {
        showMessage(
          'Email/Password sign-in is not enabled in Firebase.'
        );
      } else if (
        firebaseError.code === 'permission-denied' ||
        firebaseError.code === 'firestore/permission-denied'
      ) {
        showMessage(
          'Firestore permission denied. Please check your database rules.'
        );
      } else if (firebaseError.message) {
        showMessage(firebaseError.message);
      } else {
        showMessage(
          'Registration failed. Check the browser console for details.'
        );
      }

      // If profile saving failed after account creation,
      // try removing the newly created account so registration can be retried.
      if (createdUser && !profileSaved) {
        try {
          await deleteUser(createdUser);
        } catch (cleanupError) {
          console.error(
            'Account cleanup failed:',
            cleanupError
          );

          showMessage(
            'The account may have been created, but its profile was not saved. Contact the administrator before retrying.'
          );
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToLogin = () => {
    navigate('/lgu-login');
  };

  return (
    <IonPage>
      <IonContent ref={contentRef} className="lgu-register-content">
        <div className="lgu-register-container">
          <header className="lgu-register-header">
            <div className="lgu-brand">
              <div className="lgu-brand-icon"><img className="grantaccess-brand-image" src="/mylogo.png" alt="GrantAccess" />
              </div>

              <div className="lgu-header-copy">
                <h1>GrantAccess</h1>
                <p>Scholarship Listing and Application System</p>
              </div>
            </div>
          </header>

          <main className="lgu-register-card">
            <div className="lgu-card-heading">
              <p className="lgu-eyebrow">
                LGU / SCHOOL REGISTRATION
              </p>
              <h2>Create your organization account</h2>
              <p>
                Complete the following steps to register your
                organization with GrantAccess.
              </p>
            </div>

            <div className="lgu-step-progress">
              {[1, 2, 3, 4].map((number) => (
                <React.Fragment key={number}>
                  <div
                    className={`lgu-step-item ${
                      step === number
                        ? 'active'
                        : step > number
                        ? 'completed'
                        : ''
                    }`}
                  >
                    <div className="lgu-step-circle">
                      {step > number ? (
                        <IonIcon icon={checkmarkCircleOutline} />
                      ) : (
                        number
                      )}
                    </div>

                    <span>
                      {number === 1
                        ? 'Email'
                        : number === 2
                        ? 'Password'
                        : number === 3
                        ? 'Organization'
                        : 'Representative'}
                    </span>
                  </div>

                  {number < 4 && (
                    <div
                      className={`lgu-step-line ${
                        step > number ? 'completed' : ''
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <section className="lgu-form-section">
                  <div className="lgu-section-heading">
                    <IonIcon icon={mailOutline} />
                    <div>
                      <h3>Organization email</h3>
                      <p>
                        Enter your official organization email. After registration,
                        we will email a link to verify it.
                      </p>
                    </div>
                  </div>
                  <div className="lgu-field">
                    <label className="lgu-field-label">
                      Official Organization Email <span>*</span>
                    </label>
                    <div className="lgu-input-wrapper">
                      <IonIcon icon={mailOutline} />
                      <input
                        className="lgu-input"
                        type="email"
                        autoComplete="email"
                        placeholder="organization@example.com"
                        value={organizationEmail}
                        onChange={(event) =>
                          setOrganizationEmail(event.target.value)
                        }
                        required
                      />
                    </div>
                    <p className="lgu-field-hint">
                      Use this email to sign in and receive your verification link.
                    </p>
                  </div>
                </section>
              )}

              {step === 3 && (
                <section className="lgu-form-section">
                  <div className="lgu-section-heading">
                    <IonIcon icon={businessOutline} />
                    <div>
                      <h3>Organization Information</h3>
                      <p>
                        Enter your school's or LGU's official details.
                      </p>
                    </div>
                  </div>

                  <label className="lgu-field-label">
                    Organization Type <span>*</span>
                  </label>

                  <div className="lgu-type-grid">
                    <button
                      type="button"
                      className={`lgu-type-option ${
                        organizationType === 'School' ? 'selected' : ''
                      }`}
                      onClick={() => setOrganizationType('School')}
                    >
                      <IonIcon
                        className="lgu-type-main-icon"
                        icon={businessOutline}
                      />

                      <span className="lgu-type-copy">
                        <strong>School</strong>
                        <small>Educational institution</small>
                      </span>

                      {organizationType === 'School' && (
                        <IonIcon
                          className="lgu-type-check"
                          icon={checkmarkCircleOutline}
                        />
                      )}
                    </button>

                    <button
                      type="button"
                      className={`lgu-type-option ${
                        organizationType === 'LGU' ? 'selected' : ''
                      }`}
                      onClick={() => setOrganizationType('LGU')}
                    >
                      <IonIcon
                        className="lgu-type-main-icon"
                        icon={locationOutline}
                      />

                      <span className="lgu-type-copy">
                        <strong>LGU</strong>
                        <small>Local government unit</small>
                      </span>

                      {organizationType === 'LGU' && (
                        <IonIcon
                          className="lgu-type-check"
                          icon={checkmarkCircleOutline}
                        />
                      )}
                    </button>
                  </div>

                  <div className="lgu-field">
                    <label className="lgu-field-label">
                      Organization Name <span>*</span>
                    </label>

                    <div className="lgu-input-wrapper">
                      <IonIcon icon={businessOutline} />
                      <input
                        className="lgu-input"
                        type="text"
                        placeholder="Enter official organization name"
                        value={organizationName}
                        onChange={(event) =>
                          setOrganizationName(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="lgu-field">
                    <label className="lgu-field-label">
                      Complete Address <span>*</span>
                    </label>

                    <div className="lgu-input-wrapper">
                      <IonIcon icon={locationOutline} />
                      <input
                        className="lgu-input"
                        type="text"
                        placeholder="Street, barangay, municipality, province"
                        value={address}
                        onChange={(event) =>
                          setAddress(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="lgu-field">
                    <label className="lgu-field-label">
                      Contact Number <span>*</span>
                    </label>

                    <div className="lgu-input-wrapper">
                      <IonIcon icon={callOutline} />
                      <input
                        className="lgu-input"
                        type="tel"
                        placeholder="e.g. 09123456789"
                        value={contactNumber}
                        onChange={(event) =>
                          setContactNumber(event.target.value)
                        }
                      />
                    </div>
                  </div>
                </section>
              )}

              {step === 4 && (
                <section className="lgu-form-section">
                  <div className="lgu-section-heading">
                    <IonIcon icon={personOutline} />
                    <div>
                      <h3>Representative Information</h3>
                      <p>
                        Provide the details of the person responsible for
                        this organization account.
                      </p>
                    </div>
                  </div>

                  <div className="lgu-field">
                    <label className="lgu-field-label">
                      Representative Full Name <span>*</span>
                    </label>

                    <div className="lgu-input-wrapper">
                      <IonIcon icon={personOutline} />
                      <input
                        className="lgu-input"
                        type="text"
                        placeholder="Enter full name"
                        value={representativeName}
                        onChange={(event) =>
                          setRepresentativeName(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="lgu-field">
                    <label className="lgu-field-label">
                      Position / Designation <span>*</span>
                    </label>

                    <div className="lgu-input-wrapper">
                      <IonIcon icon={briefcaseOutline} />
                      <input
                        className="lgu-input"
                        type="text"
                        placeholder="e.g. Scholarship Coordinator"
                        value={position}
                        onChange={(event) =>
                          setPosition(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="lgu-security-note">
                    <IonIcon icon={checkmarkCircleOutline} />
                    <p>
                      Make sure the representative information is accurate
                      and belongs to an authorized representative.
                    </p>
                  </div>
                </section>
              )}

              {step === 2 && (
                <section className="lgu-form-section">
                  <div className="lgu-section-heading">
                    <IonIcon icon={lockClosedOutline} />
                    <div>
                      <h3>Account Setup</h3>
                      <p>
                        Create a secure password for your organization
                        account.
                      </p>
                    </div>
                  </div>

                  <div className="lgu-account-summary">
                    <span>Registration email</span>
                    <strong>
                      {organizationEmail || 'No email entered'}
                    </strong>
                  </div>

                  <div className="lgu-field">
                    <label className="lgu-field-label">
                      Password <span>*</span>
                    </label>

                    <div className="lgu-input-wrapper lgu-password-wrapper">
                      <IonIcon icon={lockClosedOutline} />
                      <input
                        className="lgu-input"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a password"
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                      />

                      <button
                        type="button"
                        className="lgu-password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                      >
                        <IonIcon
                          icon={showPassword ? eyeOffOutline : eyeOutline}
                        />
                      </button>
                    </div>

                    <p className="lgu-field-hint">
                      Use at least 8 characters.
                    </p>
                  </div>

                  <div className="lgu-field">
                    <label className="lgu-field-label">
                      Confirm Password <span>*</span>
                    </label>

                    <div className="lgu-input-wrapper lgu-password-wrapper">
                      <IonIcon icon={lockClosedOutline} />
                      <input
                        className="lgu-input"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                      />

                      <button
                        type="button"
                        className="lgu-password-toggle"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        aria-label={
                          showConfirmPassword
                            ? 'Hide confirm password'
                            : 'Show confirm password'
                        }
                      >
                        <IonIcon
                          icon={
                            showConfirmPassword
                              ? eyeOffOutline
                              : eyeOutline
                          }
                        />
                      </button>
                    </div>
                  </div>

                  <div className="lgu-security-note">
                    <IonIcon icon={lockClosedOutline} />
                    <p>
                      Keep your password private. Do not share it with
                      other people.
                    </p>
                  </div>
                </section>
              )}

              {step === 4 && (
                <label className="lgu-terms">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) =>
                      setAcceptedTerms(event.target.checked)
                    }
                    required
                  />
                  <span>
                    I confirm that the information provided is accurate
                    and I agree to the terms and conditions.
                  </span>
                </label>
              )}

              <div
                className={`lgu-step-actions ${
                  step === 1 ? 'first-step' : ''
                }`}
              >
                {step > 1 && (
                  <button
                    type="button"
                    className="lgu-step-button lgu-previous-button"
                    onClick={handlePrevious}
                    disabled={isSubmitting}
                  >
                    Previous
                  </button>
                )}

                {step < 4 ? (
                  <button
                    type="button"
                    className="lgu-step-button lgu-next-button"
                    onClick={handleNext}
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? 'Please wait...'
                      : 'Continue'}
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="lgu-step-button lgu-finish-button"
                    disabled={isSubmitting}
                  >
                    <span>
                      {isSubmitting
                        ? 'Creating Account...'
                        : 'Submit Registration'}
                    </span>
                    <IonIcon icon={checkmarkCircleOutline} />
                  </button>
                )}
              </div>
            </form>

            <div className="lgu-login-prompt">
              <span>Already have an account?</span>
              <button
                type="button"
                className="lgu-login-link"
                onClick={goToLogin}
              >
                Sign in
              </button>
            </div>
          </main>

          <footer className="lgu-footer">
            GrantAccess · Scholarship Listing and Application System
          </footer>
        </div>

        <IonToast
          isOpen={showToast}
          message={toastMessage}
          duration={3500}
          position="top"
          onDidDismiss={() => setShowToast(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default Register;
