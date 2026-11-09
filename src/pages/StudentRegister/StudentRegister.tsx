
import { useEffect, useState } from 'react';

import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';

import {
  schoolOutline,
  personOutline,
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  businessOutline,
  bookOutline,
} from 'ionicons/icons';

import { Link, useNavigate } from 'react-router-dom';

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  reload,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

import {
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { auth, db } from '../../Firebase/config';

import './StudentRegister.css';

// =====================================================
// COURSE / PROGRAM OPTIONS
// =====================================================

const courses = [
  'BS Information Technology',
  'BS Computer Science',
  'BS Information Systems',
  'BS Computer Engineering',
  'BS Electronics Engineering',
  'BS Electrical Engineering',
  'BS Civil Engineering',
  'BS Mechanical Engineering',
  'BS Industrial Engineering',
  'BS Architecture',
  'BS Accountancy',
  'BS Accounting Information System',
  'BS Business Administration',
  'BS Entrepreneurship',
  'BS Management Accounting',
  'BS Hospitality Management',
  'BS Tourism Management',
  'BS Office Administration',
  'BS Marketing Management',
  'BS Financial Management',
  'BS Real Estate Management',
  'BS Psychology',
  'BS Biology',
  'BS Mathematics',
  'BS Statistics',
  'BS Chemistry',
  'BS Physics',
  'BS Nursing',
  'BS Pharmacy',
  'BS Medical Technology / Medical Laboratory Science',
  'BS Physical Therapy',
  'BS Midwifery',
  'BS Nutrition and Dietetics',
  'BS Public Health',
  'BS Radiologic Technology',
  'BS Respiratory Therapy',
  'BS Social Work',
  'BS Criminology',
  'BS Agriculture',
  'BS Agricultural Technology',
  'BS Fisheries',
  'BS Forestry',
  'BS Environmental Science',
  'BS Development Communication',
  'Bachelor of Elementary Education',
  'Bachelor of Secondary Education',
  'Bachelor of Early Childhood Education',
  'Bachelor of Special Needs Education',
  'Bachelor of Physical Education',
  'Bachelor of Technology and Livelihood Education',
  'Bachelor of Technical-Vocational Teacher Education',
  'BA Communication',
  'BA English Language Studies',
  'BA Political Science',
  'BA Sociology',
  'BA Filipino',
  'BA History',
  'BA Philosophy',
  'Bachelor of Public Administration',
  'BS Marine Transportation',
  'BS Marine Engineering',
  'Bachelor of Library and Information Science',
  'Bachelor of Fine Arts',
  'Bachelor of Multimedia Arts',
  'Bachelor of Music',
  'Bachelor of Science in Entrepreneurship',
  'Other',
];

// =====================================================
// PENDING STUDENT PROFILE
// =====================================================

interface PendingStudentProfile {
  fullName: string;
  email: string;
  studentId: string;
  school: string;
  course: string;
  yearLevel: string;
}

const PENDING_PROFILE_KEY = 'grantAccessPendingStudentProfile';

// =====================================================
// COMPONENT
// =====================================================

const StudentRegister: React.FC = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [school, setSchool] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 1 = Email
  // 2 = Password
  // 3 = Student Information
  // 4 = Email Verification Waiting
  const [registrationStep, setRegistrationStep] = useState(1);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // =====================================================
  // RESTORE PENDING REGISTRATION AFTER PAGE RELOAD
  // =====================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      const savedProfile = sessionStorage.getItem(
        PENDING_PROFILE_KEY
      );

      if (user && savedProfile) {
        try {
          const profile: PendingStudentProfile =
            JSON.parse(savedProfile);

          setFullName(profile.fullName);
          setEmail(profile.email);
          setStudentId(profile.studentId);
          setSchool(profile.school);
          setCourse(profile.course);
          setYearLevel(profile.yearLevel);
          setRegistrationStep(4);
        } catch (restoreError) {
          console.error(
            'Unable to restore pending registration:',
            restoreError
          );
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // =====================================================
  // STEP 1: CONTINUE WITH EMAIL
  // =====================================================

  const continueWithEmail = () => {
    setError('');
    setSuccessMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setEmail(normalizedEmail);
    setRegistrationStep(2);
  };

  // =====================================================
  // STEP 2: VALIDATE PASSWORD
  // =====================================================

  const continueWithPassword = () => {
    setError('');
    setSuccessMessage('');

    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setRegistrationStep(3);
  };

  // =====================================================
  // SAVE STUDENT PROFILE AFTER EMAIL VERIFICATION
  // =====================================================

  const saveVerifiedStudentProfile = async (
    user: User
  ) => {
    const savedProfile = sessionStorage.getItem(
      PENDING_PROFILE_KEY
    );

    if (!savedProfile) {
      throw new Error(
        'Your pending student information was not found. Please contact support.'
      );
    }

    const profile: PendingStudentProfile =
      JSON.parse(savedProfile);

    await setDoc(doc(db, 'students', user.uid), {
      uid: user.uid,
      fullName: profile.fullName,
      email: profile.email,
      studentId: profile.studentId,
      school: profile.school,
      course: profile.course,
      yearLevel: profile.yearLevel,
      role: 'student',
      emailVerified: true,
      createdAt: serverTimestamp(),
    });

    sessionStorage.removeItem(PENDING_PROFILE_KEY);

    await signOut(auth);

    navigate('/login', {
      replace: true,
      state: {
        email: profile.email,
        message:
          'Your email has been verified and your student account has been completed. You may now sign in.',
      },
    });
  };

  // =====================================================
  // STEP 4: CHECK EMAIL VERIFICATION
  // =====================================================

  const checkEmailVerification = async () => {
    setError('');
    setSuccessMessage('');

    const user = auth.currentUser;

    if (!user) {
      setError(
        'Your registration session has expired. Please sign in using the email and password you registered.'
      );
      return;
    }

    setLoading(true);

    try {
      await reload(user);

      const refreshedUser = auth.currentUser;

      if (!refreshedUser?.emailVerified) {
        setError(
          'Your email is not verified yet. Please open the verification link sent to your email, then try again.'
        );
        return;
      }

      await saveVerifiedStudentProfile(refreshedUser);
    } catch (verificationError: unknown) {
      console.error(
        'Email verification check failed:',
        verificationError
      );

      if (
        verificationError instanceof Error &&
        verificationError.message
      ) {
        setError(verificationError.message);
      } else {
        setError(
          'Unable to complete your registration. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // RESEND VERIFICATION EMAIL
  // =====================================================

  const resendVerificationEmail = async () => {
    setError('');
    setSuccessMessage('');

    const user = auth.currentUser;

    if (!user) {
      setError(
        'Your registration session has expired. Please sign in again.'
      );
      return;
    }

    setLoading(true);

    try {
      await reload(user);

      if (auth.currentUser?.emailVerified) {
        setSuccessMessage(
          'Your email is already verified. You can complete your registration.'
        );
        return;
      }

      await sendEmailVerification(user, {
        url: `${window.location.origin}/student-register`,
        handleCodeInApp: false,
      });

      setSuccessMessage(
        'A new verification email has been sent. Please check your inbox and spam folder.'
      );
    } catch (resendError: unknown) {
      console.error(
        'Resend verification email error:',
        resendError
      );

      const errorCode =
        typeof resendError === 'object' &&
        resendError !== null &&
        'code' in resendError
          ? String(resendError.code)
          : '';

      if (errorCode === 'auth/too-many-requests') {
        setError(
          'Too many requests. Please wait before requesting another verification email.'
        );
      } else {
        setError(
          resendError instanceof Error
            ? resendError.message
            : 'Unable to resend verification email.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // STEP 3: CREATE ACCOUNT AND SEND VERIFICATION LINK
  // =====================================================

  const createStudentAccount = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError('');
    setSuccessMessage('');

    if (!fullName.trim() || !school.trim() || !course || !yearLevel) {
      setError('Please complete all required fields.');
      return;
    }

    if (!acceptedTerms) {
      setError('Please accept the Terms and Conditions.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const pendingProfile: PendingStudentProfile = {
      fullName: fullName.trim(),
      email: normalizedEmail,
      studentId: studentId.trim(),
      school: school.trim(),
      course,
      yearLevel,
    };

    setLoading(true);

    try {
      // 1. Create Firebase Authentication account
      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );

      const user = userCredential.user;

      // 2. Set the student's display name
      await updateProfile(user, {
        displayName: fullName.trim(),
      });

      // 3. Temporarily preserve student information
      // until the email has been verified.
      sessionStorage.setItem(
        PENDING_PROFILE_KEY,
        JSON.stringify(pendingProfile)
      );

      // 4. Send Firebase email verification link
      await sendEmailVerification(user, {
        url: `${window.location.origin}/student-register`,
        handleCodeInApp: false,
      });

      // 5. Show email verification instructions
      setCurrentUser(user);
      setRegistrationStep(4);

      setSuccessMessage(
        `A verification link has been sent to ${normalizedEmail}. Please open your email and click the link to verify your account.`
      );
    } catch (registrationError: unknown) {
      console.error(
        'Student registration error:',
        registrationError
      );

      const errorCode =
        typeof registrationError === 'object' &&
        registrationError !== null &&
        'code' in registrationError
          ? String(registrationError.code)
          : '';

      if (errorCode === 'auth/email-already-in-use') {
        setError(
          'This email is already registered. Please sign in instead.'
        );
      } else if (errorCode === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (errorCode === 'auth/weak-password') {
        setError(
          'Please choose a stronger password with at least 6 characters.'
        );
      } else if (errorCode === 'auth/network-request-failed') {
        setError(
          'Network error. Please check your internet connection.'
        );
      } else if (errorCode === 'auth/too-many-requests') {
        setError(
          'Too many requests. Please wait before trying again.'
        );
      } else {
        setError(
          registrationError instanceof Error
            ? registrationError.message
            : 'Registration could not be completed. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // MAIN FORM SUBMISSION
  // =====================================================

  const handleRegister = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (registrationStep === 1) {
      continueWithEmail();
      return;
    }

    if (registrationStep === 2) {
      continueWithPassword();
      return;
    }

    if (registrationStep === 3) {
      await createStudentAccount(event);
    }
  };

  // =====================================================
  // BACK BUTTON
  // =====================================================

  const goBack = () => {
    setError('');
    setSuccessMessage('');

    if (registrationStep === 2) {
      setRegistrationStep(1);
    } else if (registrationStep === 3) {
      setRegistrationStep(2);
    }
  };

  // =====================================================
  // USER INTERFACE
  // =====================================================

  return (
    <IonPage>
      <IonContent className="student-register-content">
        <div className="student-register-wrapper">

          {/* HEADER */}
          <header className="student-register-header">
            <button
              type="button"
              className="student-register-brand"
              onClick={() => navigate('/')}
              aria-label="Go to GrantAccess home"
            >
              <span className="student-register-logo">
                <IonIcon icon={schoolOutline} />
              </span>

              <span className="student-register-brand-text">
                <strong>
                  Grant<span>Access</span>
                </strong>

                <small>YOUR FUTURE STARTS HERE</small>
              </span>
            </button>
          </header>

          {/* MAIN CONTENT */}
          <main className="student-register-main">

            {/* INTRODUCTION */}
            <section className="student-register-intro">
              <span className="student-register-eyebrow">
                STUDENT REGISTRATION
              </span>

              <h1>
                Create Your <span>Student Account</span>
              </h1>

              <p>
                Join GrantAccess to discover scholarship
                opportunities and manage your applications
                in one place.
              </p>
            </section>

            {/* REGISTRATION FORM */}
            <form
              className="student-register-form"
              onSubmit={handleRegister}
            >
              <div className="student-register-form-heading">
                <h2>
                  {registrationStep === 1
                    ? 'Enter Your Email'
                    : registrationStep === 2
                    ? 'Create Your Password'
                    : registrationStep === 3
                    ? 'Student Information'
                    : 'Verify Your Email'}
                </h2>

                <p>
                  {registrationStep === 1
                    ? 'Enter your active email address to get started.'
                    : registrationStep === 2
                    ? 'Create a secure password for your account.'
                    : registrationStep === 3
                    ? 'Complete your student information. Fields marked with * are required.'
                    : 'Please check your email and click the verification link we sent you.'}
                </p>
              </div>

              {/* ERROR MESSAGE */}
              {error && (
                <div
                  className="student-register-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {/* SUCCESS MESSAGE */}
              {successMessage && (
                <div
                  className="student-register-success"
                  role="status"
                >
                  {successMessage}
                </div>
              )}

              {/* STEP 1: EMAIL */}
              {registrationStep === 1 && (
                <div className="student-register-field">
                  <label htmlFor="email">
                    Email Address *
                  </label>

                  <div className="student-register-input-wrap">
                    <IonIcon icon={mailOutline} />

                    <input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      disabled={loading}
                      required
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: PASSWORD */}
              {registrationStep === 2 && (
                <>
                  <div className="student-register-field">
                    <label htmlFor="password">
                      Password *
                    </label>

                    <div className="student-register-input-wrap">
                      <IonIcon icon={lockClosedOutline} />

                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        required
                      />

                      <button
                        type="button"
                        className="student-register-eye"
                        onClick={() =>
                          setShowPassword(!showPassword)
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

                  <div className="student-register-field">
                    <label htmlFor="confirmPassword">
                      Confirm Password *
                    </label>

                    <div className="student-register-input-wrap">
                      <IonIcon icon={lockClosedOutline} />

                      <input
                        id="confirmPassword"
                        type={
                          showConfirmPassword ? 'text' : 'password'
                        }
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        required
                      />

                      <button
                        type="button"
                        className="student-register-eye"
                        onClick={() =>
                          setShowConfirmPassword(
                            !showConfirmPassword
                          )
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
                </>
              )}

              {/* STEP 3: STUDENT INFORMATION */}
              {registrationStep === 3 && (
                <>
                  <div className="student-register-field">
                    <label htmlFor="fullName">
                      Full Name *
                    </label>

                    <div className="student-register-input-wrap">
                      <IonIcon icon={personOutline} />

                      <input
                        id="fullName"
                        type="text"
                        placeholder="Enter your full name"
                        autoComplete="name"
                        value={fullName}
                        onChange={(event) =>
                          setFullName(event.target.value)
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="student-register-field">
                    <label htmlFor="studentId">
                      Student ID <span>(Optional)</span>
                    </label>

                    <div className="student-register-input-wrap">
                      <IonIcon icon={personOutline} />

                      <input
                        id="studentId"
                        type="text"
                        placeholder="Enter your student ID"
                        value={studentId}
                        onChange={(event) =>
                          setStudentId(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="student-register-field">
                    <label htmlFor="school">
                      School / University *
                    </label>

                    <div className="student-register-input-wrap">
                      <IonIcon icon={businessOutline} />

                      <input
                        id="school"
                        type="text"
                        placeholder="Enter your school or university"
                        autoComplete="organization"
                        value={school}
                        onChange={(event) =>
                          setSchool(event.target.value)
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="student-register-field">
                    <label htmlFor="course">
                      Course / Program *
                    </label>

                    <div className="student-register-select-wrap">
                      <IonIcon icon={bookOutline} />

                      <select
                        id="course"
                        value={course}
                        onChange={(event) =>
                          setCourse(event.target.value)
                        }
                        required
                      >
                        <option value="">
                          Select your course or program
                        </option>

                        {courses.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="student-register-field">
                    <label htmlFor="yearLevel">
                      Year Level *
                    </label>

                    <select
                      id="yearLevel"
                      value={yearLevel}
                      onChange={(event) =>
                        setYearLevel(event.target.value)
                      }
                      required
                    >
                      <option value="">
                        Select your year level
                      </option>

                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                      <option value="5th Year">5th Year</option>
                      <option value="Graduate Student">
                        Graduate Student
                      </option>
                    </select>
                  </div>

                  <label className="student-register-terms">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(event) =>
                        setAcceptedTerms(event.target.checked)
                      }
                    />

                    <span>
                      I agree to the Terms and Conditions
                      and Privacy Policy.
                    </span>
                  </label>
                </>
              )}

              {/* STEP 4: EMAIL VERIFICATION */}
              {registrationStep === 4 && (
                <div className="student-register-verification">
                  <div className="student-register-verification-icon">
                    <IonIcon icon={mailOutline} />
                  </div>

                  <h3>Check Your Email</h3>

                  <p>
                    We sent a verification link to:
                  </p>

                  <strong>
                    {currentUser?.email || email}
                  </strong>

                  <p>
                    Open the email from Firebase Authentication
                    and click the verification link. After that,
                    return here and press the button below.
                  </p>

                  <IonButton
                    type="button"
                    expand="block"
                    className="student-register-submit"
                    disabled={loading}
                    onClick={checkEmailVerification}
                  >
                    {loading ? (
                      <>
                        <IonSpinner name="crescent" />
                        &nbsp; Checking...
                      </>
                    ) : (
                      'I Have Verified My Email'
                    )}
                  </IonButton>

                  <IonButton
                    type="button"
                    expand="block"
                    fill="outline"
                    className="student-register-back"
                    disabled={loading}
                    onClick={resendVerificationEmail}
                  >
                    Resend Verification Email
                  </IonButton>
                </div>
              )}

              {/* BACK BUTTON */}
              {registrationStep > 1 &&
                registrationStep < 4 && (
                  <IonButton
                    type="button"
                    expand="block"
                    fill="outline"
                    className="student-register-back"
                    disabled={loading}
                    onClick={goBack}
                  >
                    Back
                  </IonButton>
                )}

              {/* CONTINUE / CREATE ACCOUNT */}
              {registrationStep < 4 && (
                <IonButton
                  type="submit"
                  expand="block"
                  className="student-register-submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <IonSpinner name="crescent" />
                      &nbsp; Processing...
                    </>
                  ) : registrationStep === 1 ? (
                    'Continue'
                  ) : registrationStep === 2 ? (
                    'Continue'
                  ) : (
                    'Create Student Account'
                  )}
                </IonButton>
              )}

              {/* SIGN IN LINK */}
              <p className="student-register-login-link">
                Already have an account?{' '}
                <Link to="/login">Sign in here</Link>
              </p>
            </form>

            {/* FOOTER */}
            <footer className="student-register-footer">
              © {new Date().getFullYear()} GrantAccess.
              All rights reserved.
            </footer>

          </main>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default StudentRegister;
