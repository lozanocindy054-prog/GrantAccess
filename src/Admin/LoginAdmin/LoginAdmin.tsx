
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

import { loginAdministrator } from '../../services/adminService';


import './LoginAdmin.css';

const LoginAdmin: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleLogin = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (loading) return;
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      showMessage(
        'Please enter your email and password.',
        'warning',
      );
      return;
    }

    try {
      setLoading(true);

      // FIREBASE LOGIN
      const user = await loginAdministrator(
        cleanEmail,
        password,
      );

      if (!user.emailVerified) {
        navigate('/verify-email', { replace: true });
        return;
      }
      // Redirect to Admin Dashboard
      showMessage(
        'Login successful! Opening Admin Dashboard...',
        'success',
      );

      navigate('/admin-dashboard', { replace: true });
    } catch (error: unknown) {
      const errorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? String(error.code)
          : '';

      let message =
        'Unable to log in. Please try again.';

      if (errorCode === 'auth/admin-required') {
        message = 'This account does not have administrator access. Contact the project owner.';
      } else if (
        errorCode === 'auth/invalid-credential' ||
        errorCode === 'auth/wrong-password' ||
        errorCode === 'auth/user-not-found'
      ) {
        message = 'Incorrect email or password.';
      } else if (
        errorCode === 'auth/invalid-email'
      ) {
        message = 'Please enter a valid email address.';
      } else if (
        errorCode === 'auth/too-many-requests'
      ) {
        message =
          'Too many attempts. Please try again later.';
      } else if (
        errorCode === 'auth/network-request-failed'
      ) {
        message =
          'Network error. Please check your internet connection.';
      } else if (
        errorCode === 'auth/user-disabled'
      ) {
        message = 'This account has been disabled.';
      } else if (
        errorCode === 'auth/operation-not-allowed'
      ) {
        message =
          'Email/Password sign-in is not enabled in Firebase.';
      }

      showMessage(message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage className="admin-login-page">
      {/* HEADER */}
      <IonHeader className="admin-login-header" mode="md">
        <IonToolbar className="admin-login-toolbar">
          <div className="admin-login-brand">
            <img
              src="/mylogo.png"
              alt="GrantAccess Logo"
            />

            <div className="admin-login-brand-text">
              <span>
                Grant<span>Access</span>
              </span>
              <small>YOUR FUTURE STARTS HERE</small>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>

      {/* PAGE CONTENT */}
      <IonContent
        fullscreen={false}
        className="admin-login-content"
      >
        <main className="admin-login-main">
          {/* INTRODUCTION */}
          <section className="admin-login-intro">
            <span className="admin-login-eyebrow">
              ADMINISTRATOR LOGIN
            </span>

            <h1>
              Welcome Back, <span>Admin</span>
            </h1>

            <p>
              Sign in to your GrantAccess account to continue
              to the administration portal.
            </p>
          </section>

          {/* LOGIN CARD */}
          <section className="admin-login-card">
            <div className="admin-login-card-heading">
              <div className="admin-login-card-icon">
                <IonIcon icon={shieldCheckmarkOutline} />
              </div>

              <div>
                <h2>Admin Information</h2>
                <p>Enter your registered account details.</p>
              </div>
            </div>

            <div className="admin-login-divider-line" />

            <form
              className="admin-login-form"
              onSubmit={handleLogin}
            >
              {/* EMAIL */}
              <div className="admin-login-field">
                <label htmlFor="admin-login-email">
                  Email Address <span>*</span>
                </label>

                <div className="admin-login-input-wrap">
                  <IonIcon icon={mailOutline} />

                  <IonInput
                    id="admin-login-email"
                    name="email"
                    type="email"
                    value={email}
                    placeholder="you@example.com"
                    autocomplete="username"
                    required
                    disabled={loading}
                    onIonInput={(event) =>
                      setEmail(event.detail.value ?? '')
                    }
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div className="admin-login-field">
                <label htmlFor="admin-login-password">
                  Password <span>*</span>
                </label>

                <div className="admin-login-input-wrap">
                  <IonIcon icon={lockClosedOutline} />

                  <IonInput
                    id="admin-login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    placeholder="Enter your password"
                    autocomplete="current-password"
                    required
                    disabled={loading}
                    onIonInput={(event) =>
                      setPassword(event.detail.value ?? '')
                    }
                  />

                  <button
                    type="button"
                    className="admin-login-password-toggle"
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    disabled={loading}
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
              </div>

              {/* SIGN IN BUTTON */}
              <IonButton
                type="submit"
                expand="block"
                className="admin-login-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <IonSpinner name="crescent" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </IonButton>

            </form>
          </section>

          {/* SECURITY NOTICE */}
          <div className="admin-login-security">
            <IonIcon icon={shieldCheckmarkOutline} />

            <p>
              Administrative access must be authorized
              separately from account registration.
            </p>
          </div>

          {/* FOOTER */}
          <footer className="admin-login-footer">
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

export default LoginAdmin;
