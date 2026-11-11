
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
  IonText,
  IonToast,
} from '@ionic/react';

import {
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
} from 'ionicons/icons';

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';

import { auth } from '../../Firebase/config';

import './LoginLGUSchool.css';

type ToastColor = 'success' | 'danger' | 'warning';

const LoginLGUSchool: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] =
    useState<ToastColor>('danger');

  const showToast = (
    message: string,
    color: ToastColor = 'danger'
  ) => {
    setToastMessage(message);
    setToastColor(color);
  };

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      showToast(
        'Please enter your account email and password.',
        'warning'
      );
      return;
    }

    try {
      setLoading(true);

      const credential = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      await credential.user.reload();
      if (!credential.user.emailVerified) {
        navigate('/verify-email', { replace: true });
        return;
      }
      // Firebase Authentication login succeeded.
      // Firestore permissions are checked separately.
      navigate('/lgu-dashboard', { replace: true });
    } catch (error: unknown) {
      const errorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? String(error.code)
          : '';

      switch (errorCode) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
        case 'auth/invalid-login-credentials':
          showToast('Incorrect email or password.');
          break;

        case 'auth/invalid-email':
          showToast('Please enter a valid email address.');
          break;

        case 'auth/user-disabled':
          showToast(
            'This account has been disabled. Please contact the administrator.',
            'warning'
          );
          break;

        case 'auth/too-many-requests':
          showToast(
            'Too many login attempts. Please wait and try again.',
            'warning'
          );
          break;

        case 'auth/network-request-failed':
          showToast(
            'Network error. Please check your internet connection.'
          );
          break;

        default:
          console.error('LGU/School login error:', error);
          showToast('Unable to log in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      showToast(
        'Enter your account email first to reset your password.',
        'warning'
      );
      return;
    }

    try {
      setResetLoading(true);

      await sendPasswordResetEmail(auth, cleanEmail);

      showToast(
        'If this email is registered, a password reset email will be sent.',
        'success'
      );
    } catch (error: unknown) {
      const errorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? String(error.code)
          : '';

      if (errorCode === 'auth/invalid-email') {
        showToast('Please enter a valid email address.');
      } else {
        console.error('Password reset error:', error);

        showToast(
          'Unable to process the password reset. Please try again.'
        );
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="lgu-login-content">
        <main className="lgu-login-page">
          <section className="lgu-login-card">
            <div className="lgu-login-logo"><img className="grantaccess-brand-image" src="/mylogo.png" alt="GrantAccess" />
            </div>

            <p className="lgu-login-brand">
              GrantAccess
            </p>

            <h1>LGU / School Login</h1>

            <p className="lgu-login-subtitle">
              Sign in to manage scholarship listings and student
              applications.
            </p>

            <form onSubmit={handleLogin}>
              <div className="lgu-login-field">
                <label htmlFor="lgu-login-email">
                  Account Email
                </label>

                <div className="lgu-login-input-wrap">
                  <IonIcon
                    className="lgu-login-input-icon"
                    icon={mailOutline}
                    aria-hidden="true"
                  />

                  <IonInput
                    id="lgu-login-email"
                    type="email"
                    name="email"
                    placeholder="Enter your account email"
                    autocomplete="username"
                    inputmode="email"
                    value={email}
                    onIonInput={(event) =>
                      setEmail(
                        String(event.detail.value ?? '')
                      )
                    }
                    required
                    disabled={loading || resetLoading}
                  />
                </div>
              </div>

              <div className="lgu-login-field">
                <label htmlFor="lgu-login-password">
                  Password
                </label>

                <div className="lgu-login-input-wrap">
                  <IonIcon
                    className="lgu-login-input-icon"
                    icon={lockClosedOutline}
                    aria-hidden="true"
                  />

                  <IonInput
                    id="lgu-login-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Enter your password"
                    autocomplete="current-password"
                    value={password}
                    onIonInput={(event) =>
                      setPassword(
                        String(event.detail.value ?? '')
                      )
                    }
                    required
                    disabled={loading || resetLoading}
                  />

                  <button
                    type="button"
                    className="lgu-login-password-toggle"
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    aria-pressed={showPassword}
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    disabled={loading || resetLoading}
                  >
                    <IonIcon
                      icon={
                        showPassword
                          ? eyeOffOutline
                          : eyeOutline
                      }
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              <div className="lgu-login-forgot-row">
                <button
                  type="button"
                  className="lgu-login-link"
                  onClick={handleForgotPassword}
                  disabled={loading || resetLoading}
                >
                  {resetLoading
                    ? 'Sending reset email...'
                    : 'Forgot password?'}
                </button>
              </div>

              <IonButton
                type="submit"
                expand="block"
                className="lgu-login-submit"
                disabled={loading || resetLoading}
              >
                {loading ? (
                  <>
                    <IonSpinner name="crescent" />
                    <span className="lgu-login-loading-text">
                      Signing in...
                    </span>
                  </>
                ) : (
                  'Sign In'
                )}
              </IonButton>
            </form>

            <div className="lgu-login-register">
              <IonText>
                Don't have an account?
              </IonText>

              <button
                type="button"
                className="lgu-login-link lgu-login-register-link"
                disabled={loading || resetLoading}
                onClick={() => navigate('/lgu-register')}
              >
                Register here
              </button>
            </div>

            <div className="lgu-login-security">
              <span className="lgu-login-security-dot" />

              <p>
                Authorized LGU and school representatives only.
              </p>
            </div>
          </section>

          <footer className="lgu-login-footer">
            © {new Date().getFullYear()} GrantAccess · Scholarship
            Listing and Application System
          </footer>
        </main>

        <IonToast
          isOpen={Boolean(toastMessage)}
          message={toastMessage}
          color={toastColor}
          duration={3000}
          position="top"
          onDidDismiss={() => setToastMessage('')}
        />
      </IonContent>
    </IonPage>
  );
};

export default LoginLGUSchool;
