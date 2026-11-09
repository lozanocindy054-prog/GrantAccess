
import { useEffect, useRef, useState } from 'react';

import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';

import {
  schoolOutline,
  mailOutline,
  arrowBackOutline,
} from 'ionicons/icons';

import { useNavigate } from 'react-router-dom';

import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../Firebase/config';

import './ForgotPassword.css';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSuccess, setAlertSuccess] = useState(false);

  const backButtonRef = useRef<HTMLButtonElement>(null);
  const alertDismissedRef = useRef(false);

  useEffect(() => {
    // Clear focus only if it is inside a page Ionic has hidden.
    const handlePageTransition = () => {
      const activeElement = document.activeElement;

      if (!(activeElement instanceof HTMLElement)) {
        return;
      }

      const hiddenPage = activeElement.closest(
        '.ion-page-hidden'
      );

      if (hiddenPage) {
        activeElement.blur();
      }
    };

    document.addEventListener(
      'ionRouteWillChange',
      handlePageTransition
    );

    return () => {
      document.removeEventListener(
        'ionRouteWillChange',
        handlePageTransition
      );
    };
  }, []);

  const showAlert = (
    title: string,
    message: string,
    success: boolean
  ) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertSuccess(success);
    alertDismissedRef.current = false;
    setAlertOpen(true);
  };

  const handleResetPassword = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      showAlert(
        'Email Required',
        'Please enter your registered email address.',
        false
      );
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);

      showAlert(
        'Check Your Email',
        'If an account is associated with this email, a password reset link will be sent. Please check your inbox and spam folder.',
        true
      );
    } catch (err: unknown) {
      const errorCode =
        typeof err === 'object' &&
        err !== null &&
        'code' in err
          ? String(err.code)
          : '';

      if (errorCode === 'auth/invalid-email') {
        showAlert(
          'Invalid Email',
          'Please enter a valid email address.',
          false
        );
      } else if (
        errorCode === 'auth/network-request-failed'
      ) {
        showAlert(
          'Connection Error',
          'Please check your internet connection and try again.',
          false
        );
      } else if (
        errorCode === 'auth/too-many-requests'
      ) {
        showAlert(
          'Please Try Again Later',
          'Too many requests have been made. Please wait before trying again.',
          false
        );
      } else {
        showAlert(
          'Unable to Send',
          'We could not process your request. Please try again.',
          false
        );

        console.error('Password reset error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAlertDismiss = () => {
    if (alertDismissedRef.current) {
      return;
    }

    alertDismissedRef.current = true;
    setAlertOpen(false);

    if (alertSuccess) {
      // Avoid navigating while the alert still owns focus.
      window.setTimeout(() => {
        const activeElement = document.activeElement;

        if (activeElement instanceof HTMLElement) {
          activeElement.blur();
        }

        navigate('/login', { replace: true });
      }, 150);
    } else {
      // Return focus to the back button after a regular alert.
      window.setTimeout(() => {
        const backButton = backButtonRef.current;

        if (
          backButton &&
          backButton.isConnected &&
          !backButton.closest('.ion-page-hidden')
        ) {
          backButton.focus();
        }
      }, 50);
    }
  };

  const goToPage = (path: string) => {
    const activeElement = document.activeElement;

    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    navigate(path);
  };

  return (
    <IonPage>
      <IonContent className="forgot-password-content">
        <div className="forgot-password-wrapper">
          {/* HEADER */}
          <header className="forgot-password-header">
            <button
              type="button"
              className="forgot-password-brand"
              onClick={() => goToPage('/register-choice')}
              aria-label="Go to GrantAccess home"
            >
              <span className="forgot-password-logo">
                <IonIcon icon={schoolOutline} />
              </span>

              <span className="forgot-password-brand-text">
                <strong>
                  Grant<span>Access</span>
                </strong>

                <small>YOUR FUTURE STARTS HERE</small>
              </span>
            </button>
          </header>

          {/* BACK ARROW */}
          <div className="forgot-password-back-arrow">
            <button
              ref={backButtonRef}
              type="button"
              onClick={() => goToPage('/login')}
              aria-label="Back to login"
              title="Back to login"
            >
              <IonIcon icon={arrowBackOutline} />
            </button>
          </div>

          {/* MAIN CONTENT */}
          <main className="forgot-password-main">
            <section className="forgot-password-card">
              <div className="forgot-password-heading">
                <span className="forgot-password-eyebrow">
                  ACCOUNT RECOVERY
                </span>

                <h1>Forgot Password?</h1>

                <p>
                  No worries! Enter the email address linked
                  to your GrantAccess account. We'll send you
                  instructions to reset your password.
                </p>
              </div>

              {/* EMAIL FORM */}
              <form onSubmit={handleResetPassword}>
                <div className="forgot-password-field">
                  <label htmlFor="reset-email">
                    Email Address
                  </label>

                  <div className="forgot-password-input-wrap">
                    <IonIcon icon={mailOutline} />

                    <input
                      id="reset-email"
                      type="email"
                      placeholder="Enter your registered email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      required
                    />
                  </div>

                  <small>
                    Use the email address you registered with.
                  </small>
                </div>

                {/* SEND BUTTON */}
                <IonButton
                  type="submit"
                  expand="block"
                  className="forgot-password-submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <IonSpinner name="crescent" />
                      &nbsp; Sending...
                    </>
                  ) : (
                    'Send'
                  )}
                </IonButton>
              </form>
            </section>

            {/* FOOTER */}
            <footer className="forgot-password-footer">
              © {new Date().getFullYear()} GrantAccess.
              All rights reserved.
            </footer>
          </main>
        </div>

        {/* POPUP ALERT */}
        <IonAlert
          isOpen={alertOpen}
          onDidDismiss={handleAlertDismiss}
          header={alertTitle}
          message={alertMessage}
          cssClass="forgot-password-alert"
          buttons={[
            {
              text: 'OK',
              role: 'confirm',
            },
          ]}
          backdropDismiss={false}
        />
      </IonContent>
    </IonPage>
  );
};

export default ForgotPassword;
