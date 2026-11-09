
import { useState } from 'react';

import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';

import {
  schoolOutline,
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
} from 'ionicons/icons';

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { signInWithEmailAndPassword } from 'firebase/auth';

import { auth } from '../../Firebase/config';

import './LoginStudent.css';

interface LoginLocationState {
  email?: string;
}

const LoginStudent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const locationState =
    location.state as LoginLocationState | null;

  const [email, setEmail] = useState(
    locationState?.email ?? ''
  );

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError('');

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );

      navigate('/student-dashboard', {
        replace: true,
      });
    } catch (err: unknown) {
      const errorCode =
        typeof err === 'object' &&
        err !== null &&
        'code' in err
          ? String(err.code)
          : '';

      if (
        errorCode === 'auth/invalid-credential' ||
        errorCode === 'auth/user-not-found' ||
        errorCode === 'auth/wrong-password'
      ) {
        setError('Incorrect email or password.');
      } else if (errorCode === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (
        errorCode === 'auth/too-many-requests'
      ) {
        setError(
          'Too many login attempts. Please try again later.'
        );
      } else if (
        errorCode === 'auth/network-request-failed'
      ) {
        setError(
          'Network error. Please check your internet connection.'
        );
      } else {
        setError('Unable to sign in. Please try again.');
        console.error('Login error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="grant-login-content">
        <div className="grant-login-wrapper">

          {/* HEADER */}
          <header className="grant-login-header">
            <button
              type="button"
              className="grant-login-brand"
              onClick={() => navigate('/register-choice')}
              aria-label="Go to GrantAccess home"
            >
              <span className="grant-login-logo">
                <IonIcon icon={schoolOutline} />
              </span>

              <span className="grant-login-brand-text">
                <strong>
                  Grant<span>Access</span>
                </strong>

                <small>YOUR FUTURE STARTS HERE</small>
              </span>
            </button>
          </header>

          {/* LOGIN FORM */}
          <main className="grant-login-main">
            <section className="grant-login-card">

              <div className="grant-login-heading">
                <span className="grant-login-eyebrow">
                  WELCOME BACK
                </span>

                <h1>Sign in to GrantAccess</h1>

                <p>
                  Sign in to explore scholarship opportunities
                  and manage your applications.
                </p>
              </div>

              {/* ERROR MESSAGE */}
              {error && (
                <div
                  className="grant-login-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin}>

                {/* EMAIL */}
                <div className="grant-login-field">
                  <label htmlFor="login-email">
                    Email Address
                  </label>

                  <div className="grant-login-input-wrap">
                    <IonIcon
                      icon={mailOutline}
                      className="grant-login-field-icon"
                    />

                    <input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                {/* PASSWORD */}
                <div className="grant-login-field">
                  <label htmlFor="login-password">
                    Password
                  </label>

                  <div className="grant-login-input-wrap">
                    <IonIcon
                      icon={lockClosedOutline}
                      className="grant-login-field-icon"
                    />

                    <input
                      id="login-password"
                      type={
                        showPassword ? 'text' : 'password'
                      }
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      required
                    />

                    <button
                      type="button"
                      className="grant-login-eye"
                      onClick={() =>
                        setShowPassword((previous) => !previous)
                      }
                      aria-label={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
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

                {/* FORGOT PASSWORD LINK */}
                <div className="grant-login-forgot">
                  <Link
                    to="/forgot-password"
                    state={{ email: email.trim() }}
                  >
                    Forgot Password?
                  </Link>
                </div>

                {/* SIGN IN BUTTON */}
                <IonButton
                  type="submit"
                  expand="block"
                  className="grant-login-submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <IonSpinner name="crescent" />
                      &nbsp; Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </IonButton>

              </form>

              {/* REGISTER LINK */}
              <p className="grant-login-register">
                Don't have an account?{' '}
                <Link to="/student-register">
                  Create an account
                </Link>
              </p>

            </section>

            {/* FOOTER */}
            <footer className="grant-login-footer">
              © {new Date().getFullYear()} GrantAccess.
              All rights reserved.
            </footer>
          </main>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LoginStudent;
