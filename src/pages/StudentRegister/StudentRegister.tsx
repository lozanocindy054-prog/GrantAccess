
import React, { useState } from 'react';

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
  checkmarkCircle,
  shieldCheckmarkOutline,
} from 'ionicons/icons';

import { Link, useNavigate } from 'react-router-dom';

import {
  createUserWithEmailAndPassword,
  updateProfile,
  type User,
} from 'firebase/auth';

import {
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { auth, db } from '../../Firebase/config';

import FaceLiveness from '../../components/FaceVerification/FaceLiveness';

import './StudentRegister.css';

// =====================================================
// COURSE OPTIONS
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
// TYPES
// =====================================================

interface StudentProfile {
  uid: string;
  fullName: string;
  email: string;
  studentId: string;
  school: string;
  course: string;
  yearLevel: string;
  role: 'student';
  emailVerified: boolean;
  createdAt: ReturnType<typeof serverTimestamp>;
}

// =====================================================
// COMPONENT
// =====================================================

const StudentRegister: React.FC = () => {
  const navigate = useNavigate();

  // STUDENT ACCOUNT INFORMATION
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // STUDENT DETAILS
  const [studentId, setStudentId] = useState('');
  const [school, setSchool] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('');

  // PASSWORD VISIBILITY
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  // REGISTRATION STATE
  const [registrationStep, setRegistrationStep] = useState(1);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  // MESSAGES
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // =====================================================
  // STEP 1: EMAIL
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
  // STEP 2: PASSWORD
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
  // STEP 3: STUDENT INFORMATION
  // =====================================================

  const continueWithStudentInformation = () => {
    setError('');
    setSuccessMessage('');

    if (
      !fullName.trim() ||
      !school.trim() ||
      !course ||
      !yearLevel
    ) {
      setError('Please complete all required fields.');
      return;
    }

    if (!acceptedTerms) {
      setError('Please accept the Terms and Conditions.');
      return;
    }

    setFaceVerified(false);
    setRegistrationStep(4);
  };

  // =====================================================
  // CREATE FIREBASE ACCOUNT AND SAVE STUDENT PROFILE
  // =====================================================

  const createStudentAccount = async () => {
    setError('');
    setSuccessMessage('');

    if (!faceVerified) {
      setError(
        'Please complete face liveness verification first.'
      );
      return;
    }

    if (
      !fullName.trim() ||
      !school.trim() ||
      !course ||
      !yearLevel
    ) {
      setError('Please complete all required student information.');
      setRegistrationStep(3);
      return;
    }

    if (!acceptedTerms) {
      setError('Please accept the Terms and Conditions.');
      setRegistrationStep(3);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setLoading(true);

    try {
      let user: User;

      // If a previous attempt already created the Firebase account,
      // reuse the current account instead of creating another one.
      const existingUser = auth.currentUser;

      if (existingUser) {
        if (
          existingUser.email?.toLowerCase() !== normalizedEmail
        ) {
          throw new Error(
            'Another account is currently signed in. Please sign out first.'
          );
        }

        user = existingUser;
      } else {
        const userCredential =
          await createUserWithEmailAndPassword(
            auth,
            normalizedEmail,
            password
          );

        user = userCredential.user;
      }

      // UPDATE FIREBASE AUTH DISPLAY NAME
      await updateProfile(user, {
        displayName: fullName.trim(),
      });

      // STUDENT FIRESTORE PROFILE
      const studentProfile: StudentProfile = {
        uid: user.uid,
        fullName: fullName.trim(),
        email: normalizedEmail,
        studentId: studentId.trim(),
        school: school.trim(),
        course,
        yearLevel,
        role: 'student',

        // No email verification is required in this registration flow.
        // This field reflects Firebase Auth's actual verification state.
        emailVerified: user.emailVerified,

        createdAt: serverTimestamp(),
      };

      // SAVE STUDENT INFORMATION
      await setDoc(
        doc(db, 'students', user.uid),
        studentProfile
      );

      setSuccessMessage(
        'Your student account has been created successfully!'
      );

      // DIRECT TO STUDENT DASHBOARD
      navigate('/student-home', {
        replace: true,
        state: {
          registrationSuccess: true,
          message: 'Welcome to GrantAccess!',
        },
      });

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

      } else if (errorCode === 'permission-denied') {
        setError(
          'Unable to save your student profile. Please check your Firestore security rules.'
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
  // FORM SUBMISSION
  // =====================================================

  const handleRegister = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (loading) return;

    if (registrationStep === 1) {
      continueWithEmail();
      return;
    }

    if (registrationStep === 2) {
      continueWithPassword();
      return;
    }

    if (registrationStep === 3) {
      continueWithStudentInformation();
    }
  };

  // =====================================================
  // FACE LIVENESS CALLBACK
  // =====================================================

  const handleFaceVerified = () => {
    setFaceVerified(true);
    setError('');

    setSuccessMessage(
      'Face liveness verification completed successfully.'
    );
  };

  // =====================================================
  // BACK BUTTON
  // =====================================================

  const goBack = () => {
    if (loading) return;

    setError('');
    setSuccessMessage('');

    if (registrationStep === 2) {
      setRegistrationStep(1);

    } else if (registrationStep === 3) {
      setRegistrationStep(2);

    } else if (registrationStep === 4) {
      setFaceVerified(false);
      setRegistrationStep(3);
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

          <main className="student-register-main">

            {/* INTRO */}

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
              noValidate
            >

              {/* STEP HEADING */}

              <div className="student-register-form-heading">
                <div className="student-register-step-label">
                  STEP {registrationStep} OF 4
                </div>

                <div className="student-register-progress">
                  <span
                    style={{
                      width: `${registrationStep * 25}%`,
                    }}
                  />
                </div>

                <h2>
                  {registrationStep === 1
                    ? 'Enter Your Email'
                    : registrationStep === 2
                    ? 'Create Your Password'
                    : registrationStep === 3
                    ? 'Student Information'
                    : 'Face Liveness Verification'}
                </h2>

                <p>
                  {registrationStep === 1
                    ? 'Enter your active email address to get started.'
                    : registrationStep === 2
                    ? 'Create a secure password for your account.'
                    : registrationStep === 3
                    ? 'Complete your student information. Fields marked with * are required.'
                    : 'Complete the face liveness challenges using your front camera.'}
                </p>
              </div>

              {/* ERROR */}

              {error && (
                <div
                  className="student-register-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {/* SUCCESS */}

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
                      />

                      <button
                        type="button"
                        className="student-register-eye"
                        onClick={() =>
                          setShowPassword(!showPassword)
                        }
                        aria-label="Toggle password visibility"
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
                      />

                      <button
                        type="button"
                        className="student-register-eye"
                        onClick={() =>
                          setShowConfirmPassword(
                            !showConfirmPassword
                          )
                        }
                        aria-label="Toggle confirm password visibility"
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

              {/* STEP 4: FACE LIVENESS */}

              {registrationStep === 4 && (
                <div className="face-verification">

                  <div className="face-verification-intro">
                    <div className="face-verification-main-icon">
                      <IonIcon icon={shieldCheckmarkOutline} />
                    </div>

                    <h3>Let's verify your face</h3>

                    <p>
                      Complete the face movement challenges
                      using your front camera. Follow the
                      instructions shown on screen.
                    </p>
                  </div>

                  <FaceLiveness
                    key="grantaccess-student-face-verification"
                    onVerified={handleFaceVerified}
                  />

                  {faceVerified && (
                    <div className="face-verification-complete">
                      <IonIcon icon={checkmarkCircle} />

                      <div>
                        <strong>
                          Face liveness verification completed!
                        </strong>

                        <span>
                          Your student account is ready to be created.
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* BACK BUTTON */}

              {registrationStep > 1 && (
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

              {/* CONTINUE BUTTON */}

              {registrationStep < 4 && (
                <IonButton
                  type="submit"
                  expand="block"
                  className="student-register-submit"
                  disabled={loading}
                >
                  Continue
                </IonButton>
              )}

              {/* CREATE ACCOUNT AFTER FACE LIVENESS */}

              {registrationStep === 4 && faceVerified && (
                <IonButton
                  type="button"
                  expand="block"
                  className="student-register-submit"
                  disabled={loading}
                  onClick={createStudentAccount}
                >
                  {loading ? (
                    <>
                      <IonSpinner name="crescent" />
                      &nbsp; Creating Account...
                    </>
                  ) : (
                    'Create Account and Go to Dashboard'
                  )}
                </IonButton>
              )}

              {/* LOGIN LINK */}

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
