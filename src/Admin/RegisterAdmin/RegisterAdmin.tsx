
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonInput,
  IonButton,
  IonIcon,
  IonToast,
  IonSpinner,
} from '@ionic/react';

import {
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';

import {
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import { auth } from '../../Firebase/config';


import './RegisterAdmin.css';

const RegisterAdmin: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState({
    isOpen: false,
    message: '',
    color: 'success',
  });

  const showMessage = (
    message: string,
    color = 'success',
  ) => {
    setToast({
      isOpen: true,
      message,
      color,
    });
  };

  const handleRegister = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password || !confirmPassword) {
      showMessage(
        'Please complete all required fields.',
        'warning',
      );
      return;
    }

    if (password.length < 8) {
      showMessage(
        'Password must contain at least 8 characters.',
        'warning',
      );
      return;
    }

    if (password !== confirmPassword) {
      showMessage(
        'Passwords do not match.',
        'warning',
      );
      return;
    }

    try {
      setLoading(true);

      await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password,
      );

      // This creates a Firebase account only.
      // It does not grant administrator privileges.
      await signOut(auth);

      setEmail('');
      setPassword('');
      setConfirmPassword('');

      showMessage(
        'Account created successfully! Please log in.',
        'success',
      );

      window.setTimeout(() => {
        navigate('/admin-login', { replace: true });
      }, 1200);
    } catch (error: unknown) {
      const errorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? String(error.code)
          : '';

      let message =
        'Unable to create your account. Please try again.';

      if (errorCode === 'auth/email-already-in-use') {
        message =
          'This email is already registered. Please use another email.';
      } else if (errorCode === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (
        errorCode === 'auth/weak-password'
      ) {
        message =
          'Your password is too weak. Please use at least 8 characters.';
      } else if (
        errorCode === 'auth/operation-not-allowed'
      ) {
        message =
          'Email/Password authentication is not enabled in Firebase.';
      } else if (
        errorCode === 'auth/network-request-failed'
      ) {
        message =
          'Network error. Please check your internet connection.';
      }

      showMessage(message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage className="admin-register-page">

      {/* HEADER */}
      <IonHeader className="admin-register-header" mode="md">
        <IonToolbar className="admin-register-toolbar">
          <div className="admin-register-brand">
            <img
              src="/image/logo3.png"
              alt="GrantAccess Logo"
            />

            <div className="admin-register-brand-text">
              <span>
                Grant<span>Access</span>
              </span>

              <small>YOUR FUTURE STARTS HERE</small>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>

      {/* CONTENT */}
      <IonContent
        fullscreen={false}
        className="admin-register-content"
      >
        <main className="admin-register-main">

          {/* PAGE HEADING */}
          <section className="admin-register-intro">
            <span className="admin-register-eyebrow">
              ADMIN REGISTRATION
            </span>

            <h1>
              Create Your <span>Admin Account</span>
            </h1>

            <p>
              Register your account to access the
              GrantAccess administration portal.
            </p>
          </section>

          {/* REGISTRATION FORM */}
          <section className="admin-register-card">

            <div className="admin-register-card-heading">
              <div className="admin-register-card-icon">
                <IonIcon icon={shieldCheckmarkOutline} />
              </div>

              <div>
                <h2>Admin Information</h2>
                <p>Fields marked with * are required.</p>
              </div>
            </div>

            <div className="admin-register-divider" />

            <form
              className="admin-register-form"
              onSubmit={handleRegister}
            >

              {/* EMAIL */}
              <div className="admin-register-field">
                <label htmlFor="admin-register-email">
                  Email Address <span>*</span>
                </label>

                <div className="admin-register-input">
                  <IonIcon icon={mailOutline} />

                  <IonInput
                    id="admin-register-email"
                    name="email"
                    type="email"
                    value={email}
                    placeholder="you@example.com"
                    autocomplete="email"
                    required
                    disabled={loading}
                    onIonInput={(event) =>
                      setEmail(event.detail.value ?? '')
                    }
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div className="admin-register-field">
                <label htmlFor="admin-register-password">
                  Password <span>*</span>
                </label>

                <div className="admin-register-input">
                  <IonIcon icon={lockClosedOutline} />

                  <IonInput
                    id="admin-register-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    placeholder="Create your password"
                    autocomplete="new-password"
                    required
                    disabled={loading}
                    onIonInput={(event) =>
                      setPassword(event.detail.value ?? '')
                    }
                  />

                  <button
                    type="button"
                    className="admin-register-eye"
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                  >
                    <IonIcon
                      icon={
                        showPassword
                          ? eyeOffOutline
                          : eyeOutline
                      }
                    />
                  </button>
                </div>

                <small className="admin-register-hint">
                  Use at least 8 characters.
                </small>
              </div>

              {/* CONFIRM PASSWORD */}
              <div className="admin-register-field">
                <label htmlFor="admin-confirm-password">
                  Confirm Password <span>*</span>
                </label>

                <div className="admin-register-input">
                  <IonIcon icon={lockClosedOutline} />

                  <IonInput
                    id="admin-confirm-password"
                    name="confirmPassword"
                    type={
                      showConfirmPassword ? 'text' : 'password'
                    }
                    value={confirmPassword}
                    placeholder="Re-enter your password"
                    autocomplete="new-password"
                    required
                    disabled={loading}
                    onIonInput={(event) =>
                      setConfirmPassword(
                        event.detail.value ?? '',
                      )
                    }
                  />

                  <button
                    type="button"
                    className="admin-register-eye"
                    aria-label={
                      showConfirmPassword
                        ? 'Hide confirm password'
                        : 'Show confirm password'
                    }
                    onClick={() =>
                      setShowConfirmPassword(
                        (previous) => !previous,
                      )
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

              {/* SUBMIT */}
              <IonButton
                type="submit"
                expand="block"
                className="admin-register-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <IonSpinner name="crescent" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <span>Create Admin Account</span>
                )}
              </IonButton>

              <p className="admin-register-login-prompt">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/admin-login')}
                >
                  Log in
                </button>
              </p>
            </form>
          </section>

          {/* SECURITY NOTICE */}
          <div className="admin-register-notice">
            <IonIcon icon={shieldCheckmarkOutline} />

            <p>
              Administrative access must be authorized separately.
              Creating an account alone does not grant admin privileges.
            </p>
          </div>

          {/* FOOTER */}
          <footer className="admin-register-footer">
            <p>
              © {new Date().getFullYear()} GrantAccess.
              All rights reserved.
            </p>
          </footer>

        </main>

        <IonToast
          isOpen={toast.isOpen}
          message={toast.message}
          color={toast.color}
          duration={2500}
          position="top"
          onDidDismiss={() =>
            setToast((previous) => ({
              ...previous,
              isOpen: false,
            }))
          }
        />
      </IonContent>
    </IonPage>
  );
};

export default RegisterAdmin;
