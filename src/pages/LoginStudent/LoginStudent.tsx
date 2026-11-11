
import React, { useState } from 'react';

import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';

import {
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

import {
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import {
  doc,
  getDoc,
} from 'firebase/firestore';

import { auth, db } from '../../Firebase/config';

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

    if (loading) return;

    setError('');

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      // 1. Firebase Authentication
      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );

      const user = userCredential.user;

      if (!user) {
        throw new Error('Authentication failed.');
      }

      // 2. Check email verification
      await user.reload();

      if (!user.emailVerified) {
        navigate('/verify-email', { replace: true });

        return;
      }

      // 3. Get student profile from Firestore
      const studentRef = doc(db, 'students', user.uid);
      const studentSnapshot = await getDoc(studentRef);

      if (!studentSnapshot.exists()) {
        await signOut(auth);

        setError(
          'Student profile not found. Please register a student account.'
        );

        return;
      }

      const studentData = studentSnapshot.data();

      // 4. Verify account role
      if (studentData.role !== 'student') {
        await signOut(auth);

        setError(
          'This login is for student accounts only. Please use the correct login page.'
        );

        return;
      }

      // 5. Verify profile ownership
      if (
        studentData.uid &&
        studentData.uid !== user.uid
      ) {
        await signOut(auth);

        setError(
          'Your student profile could not be verified. Please contact support.'
        );

        return;
      }

      // 6. Refresh authentication token
      await user.getIdToken(true);

      console.log(
        'Student successfully logged in:',
        user.uid
      );

      // 7. Navigate to Student Dashboard
      navigate('/student-dashboard', {
        replace: true,
        state: {
          loginSuccess: true,
          message: 'Welcome back to GrantAccess!',
        },
      });

    } catch (err: unknown) {
      console.error('Student login error:', err);

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

      } else if (errorCode === 'auth/too-many-requests') {
        setError(
          'Too many login attempts. Please try again later.'
        );

      } else if (
        errorCode === 'auth/network-request-failed'
      ) {
        setError(
          'Network error. Please check your internet connection.'
        );

      } else if (errorCode === 'auth/user-disabled') {
        setError(
          'This account has been disabled. Please contact the administrator.'
        );

      } else if (
        errorCode === 'permission-denied' ||
        errorCode === 'firestore/permission-denied'
      ) {
        setError(
          'Unable to verify your student profile. Please check your account permissions.'
        );

      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to sign in. Please try again.'
        );
      }

      // Ensure invalid sessions are not left active
      if (
        errorCode === 'permission-denied' ||
        errorCode === 'firestore/permission-denied'
      ) {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error('Sign out error:', signOutError);
        }
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="grant-login-content">

        <div className="grant-login-wrapper">

          <header className="grant-login-header">

            <button
              type="button"
              className="grant-login-brand"
              onClick={() => navigate('/register-choice')}
              aria-label="Go to GrantAccess home"
              disabled={loading}
            >
              <span className="grant-login-logo"><img className="grantaccess-brand-image" src="/mylogo.png" alt="GrantAccess" />
              </span>

              <span className="grant-login-brand-text">
                <strong>
                  Grant<span>Access</span>
                </strong>

                <small>
                  YOUR FUTURE STARTS HERE
                </small>
              </span>
            </button>

          </header>

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

              {error && (
                <div
                  className="grant-login-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin}>

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
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError('');
                      }}
                      required
                      disabled={loading}
                    />

                  </div>

                </div>

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
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError('');
                      }}
                      required
                      disabled={loading}
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
                      disabled={loading}
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

                <div className="grant-login-forgot">
                  <Link
                    to="/forgot-password"
                    state={{
                      email: email.trim(),
                    }}
                  >
                    Forgot Password?
                  </Link>
                </div>

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

              <p className="grant-login-register">
                Don't have an account?{' '}
                <Link to="/student-register">
                  Create an account
                </Link>
              </p>

            </section>

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
