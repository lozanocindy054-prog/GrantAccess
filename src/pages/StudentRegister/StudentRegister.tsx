
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
  arrowBackOutline,
  arrowForwardOutline,
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

/* =========================================================
   TYPES
========================================================= */

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

/* =========================================================
   COURSE OPTIONS
========================================================= */

const courseOptions = [
  'BS Information Technology',
  'BS Computer Science',
  'BS Information Systems',
  'BS Computer Engineering',
  'BS Electronics Engineering',
  'BS Electrical Engineering',
  'BS Civil Engineering',
  'BS Mechanical Engineering',
  'BS Industrial Engineering',
  'BS Accountancy',
  'BS Accounting Information System',
  'BS Business Administration',
  'BS Entrepreneurship',
  'BS Hospitality Management',
  'BS Tourism Management',
  'BS Criminology',
  'BS Nursing',
  'BS Medical Technology',
  'BS Pharmacy',
  'BS Psychology',
  'BS Biology',
  'BS Agriculture',
  'BS Agricultural Technology',
  'BS Fisheries',
  'BS Environmental Science',
  'Bachelor of Elementary Education',
  'Bachelor of Secondary Education',
  'Bachelor of Early Childhood Education',
  'Bachelor of Physical Education',
  'Bachelor of Arts in Communication',
  'Bachelor of Arts in English',
  'Bachelor of Arts in Political Science',
  'Bachelor of Arts in Psychology',
  'Other',
];

const yearLevelOptions = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
];

/* =========================================================
   STUDENT REGISTER
========================================================= */

const StudentRegister: React.FC = () => {
  const navigate = useNavigate();

  /* -------------------------------------------------------
     FORM STATES
  ------------------------------------------------------- */

  const [registrationStep, setRegistrationStep] = useState(1);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [studentId, setStudentId] = useState('');
  const [school, setSchool] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('');

  const [acceptedTerms, setAcceptedTerms] = useState(false);

  /* -------------------------------------------------------
     VERIFICATION AND UI STATES
  ------------------------------------------------------- */

  const [faceVerified, setFaceVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /* =========================================================
     VALIDATION
  ========================================================= */

  const validateCurrentStep = (): boolean => {
    setError('');
    setSuccessMessage('');

    if (registrationStep === 1) {
      if (!email.trim()) {
        setError('Please enter your email address.');
        return false;
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email.trim())) {
        setError('Please enter a valid email address.');
        return false;
      }

      return true;
    }

    if (registrationStep === 2) {
      if (!password) {
        setError('Please enter your password.');
        return false;
      }

      if (password.length < 6) {
        setError('Password must contain at least 6 characters.');
        return false;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return false;
      }

      return true;
    }

    if (registrationStep === 3) {
      if (
        !fullName.trim() ||
        !studentId.trim() ||
        !school.trim() ||
        !course ||
        !yearLevel
      ) {
        setError('Please complete all required student information.');
        return false;
      }

      if (!acceptedTerms) {
        setError('Please accept the Terms and Conditions.');
        return false;
      }

      return true;
    }

    return true;
  };

  /* =========================================================
     NEXT STEP
  ========================================================= */

  const handleNextStep = () => {
    if (!validateCurrentStep()) {
      return;
    }

    setRegistrationStep((previousStep) => previousStep + 1);
    setError('');
    setSuccessMessage('');
  };

  /* =========================================================
     PREVIOUS STEP
  ========================================================= */

  const handlePreviousStep = () => {
    if (registrationStep > 1 && !loading) {
      setRegistrationStep((previousStep) => previousStep - 1);
      setError('');
      setSuccessMessage('');
    }
  };

  /* =========================================================
     CREATE FIREBASE ACCOUNT
     AUTOMATICALLY CALLED AFTER FACE LIVENESS
  ========================================================= */

  const createStudentAccount = async (
    faceLivenessPassed = faceVerified
  ) => {
    setError('');
    setSuccessMessage('');

    if (!faceLivenessPassed) {
      setError('Please complete face liveness verification first.');
      return;
    }

    if (
      !email.trim() ||
      !password ||
      !fullName.trim() ||
      !studentId.trim() ||
      !school.trim() ||
      !course ||
      !yearLevel
    ) {
      setError('Some required information is missing.');
      setRegistrationStep(1);
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
      /* CREATE FIREBASE AUTH ACCOUNT */

      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );

      const user: User = userCredential.user;

      /* UPDATE FIREBASE DISPLAY NAME */

      await updateProfile(user, {
        displayName: fullName.trim(),
      });

      /* STUDENT PROFILE DATA */

      const studentProfile: StudentProfile = {
        uid: user.uid,
        fullName: fullName.trim(),
        email: normalizedEmail,
        studentId: studentId.trim(),
        school: school.trim(),
        course,
        yearLevel,
        role: 'student',
        emailVerified: user.emailVerified,
        createdAt: serverTimestamp(),
      };

      /* SAVE STUDENT PROFILE TO FIRESTORE */

      await setDoc(
        doc(db, 'students', user.uid),
        studentProfile
      );

      setSuccessMessage(
        'Your GrantAccess account has been created successfully!'
      );

      /* GO DIRECTLY TO STUDENT DASHBOARD */

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
        setError('Please choose a stronger password.');
      } else if (errorCode === 'auth/network-request-failed') {
        setError(
          'Network error. Please check your internet connection.'
        );
      } else if (
        errorCode === 'permission-denied' ||
        errorCode === 'firestore/permission-denied'
      ) {
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

  /* =========================================================
     FACE LIVENESS SUCCESS
     AUTOMATIC ACCOUNT CREATION
  ========================================================= */

  const handleFaceVerified = async () => {
    setFaceVerified(true);
    setError('');

    setSuccessMessage(
      'Face verification successful! Creating your student account...'
    );

    /*
      Pass true directly because React state updates are asynchronous.
      This avoids reading the previous faceVerified value.
    */

    await createStudentAccount(true);
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="student-register-page">

          {/* HEADER */}

          <div className="student-register-header">
            <div className="student-register-brand">
              <div className="student-register-logo">
                <IonIcon icon={schoolOutline} />
              </div>

              <div>
                <h1>GrantAccess</h1>
                <p>Scholarship Listing and Application System</p>
              </div>
            </div>

            <div className="student-register-header-text">
              <h2>Create Student Account</h2>
              <p>
                Join GrantAccess and discover scholarship opportunities.
              </p>
            </div>
          </div>

          {/* REGISTRATION CARD */}

          <div className="student-register-container">
            <div className="student-register-card">

              {/* STEP INDICATOR */}

              <div className="student-register-steps">

                <div
                  className={`student-register-step ${
                    registrationStep >= 1 ? 'active' : ''
                  }`}
                >
                  <span>1</span>
                  <small>Email</small>
                </div>

                <div className="student-register-step-line" />

                <div
                  className={`student-register-step ${
                    registrationStep >= 2 ? 'active' : ''
                  }`}
                >
                  <span>2</span>
                  <small>Password</small>
                </div>

                <div className="student-register-step-line" />

                <div
                  className={`student-register-step ${
                    registrationStep >= 3 ? 'active' : ''
                  }`}
                >
                  <span>3</span>
                  <small>Information</small>
                </div>

                <div className="student-register-step-line" />

                <div
                  className={`student-register-step ${
                    registrationStep >= 4 ? 'active' : ''
                  }`}
                >
                  <span>
                    {faceVerified ? (
                      <IonIcon icon={checkmarkCircle} />
                    ) : (
                      '4'
                    )}
                  </span>
                  <small>Face Check</small>
                </div>

              </div>

              {/* CARD TITLE */}

              <div className="student-register-title">
                <h2>
                  {registrationStep === 1 && 'Email Address'}
                  {registrationStep === 2 && 'Create Password'}
                  {registrationStep === 3 && 'Student Information'}
                  {registrationStep === 4 && 'Face Liveness Verification'}
                </h2>

                <p>
                  {registrationStep === 1 &&
                    'Enter your email address to get started.'}

                  {registrationStep === 2 &&
                    'Create a secure password for your account.'}

                  {registrationStep === 3 &&
                    'Provide your student details.'}

                  {registrationStep === 4 &&
                    'Complete the face liveness check to create your account.'}
                </p>
              </div>

              {/* ERROR MESSAGE */}

              {error && (
                <div className="student-register-error">
                  {error}
                </div>
              )}

              {/* SUCCESS MESSAGE */}

              {successMessage && (
                <div className="student-register-success">
                  <IonIcon icon={checkmarkCircle} />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* =================================================
                  STEP 1 - EMAIL
              ================================================= */}

              {registrationStep === 1 && (
                <div className="student-register-form">

                  <label>Email Address</label>

                  <div className="student-register-input">
                    <IonIcon icon={mailOutline} />

                    <input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      autoComplete="email"
                    />
                  </div>

                  <p className="student-register-hint">
                    Your email will be used to sign in to GrantAccess.
                    Email verification and OTP are not required.
                  </p>

                  <IonButton
                    expand="block"
                    className="student-register-submit"
                    onClick={handleNextStep}
                  >
                    Continue
                    <IonIcon
                      slot="end"
                      icon={arrowForwardOutline}
                    />
                  </IonButton>

                </div>
              )}

              {/* =================================================
                  STEP 2 - PASSWORD
              ================================================= */}

              {registrationStep === 2 && (
                <div className="student-register-form">

                  <label>Password</label>

                  <div className="student-register-input">
                    <IonIcon icon={lockClosedOutline} />

                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create your password"
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      autoComplete="new-password"
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

                  <label>Confirm Password</label>

                  <div className="student-register-input">
                    <IonIcon icon={lockClosedOutline} />

                    <input
                      type={
                        showConfirmPassword ? 'text' : 'password'
                      }
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      autoComplete="new-password"
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

                  <p className="student-register-hint">
                    Your password must contain at least 6 characters.
                  </p>

                  <div className="student-register-actions">
                    <IonButton
                      fill="outline"
                      className="student-register-back"
                      onClick={handlePreviousStep}
                    >
                      <IonIcon
                        slot="start"
                        icon={arrowBackOutline}
                      />
                      Back
                    </IonButton>

                    <IonButton
                      className="student-register-submit"
                      onClick={handleNextStep}
                    >
                      Continue
                      <IonIcon
                        slot="end"
                        icon={arrowForwardOutline}
                      />
                    </IonButton>
                  </div>

                </div>
              )}

              {/* =================================================
                  STEP 3 - STUDENT INFORMATION
              ================================================= */}

              {registrationStep === 3 && (
                <div className="student-register-form">

                  <label>Full Name</label>

                  <div className="student-register-input">
                    <IonIcon icon={personOutline} />

                    <input
                      type="text"
                      placeholder="Enter your complete name"
                      value={fullName}
                      onChange={(event) =>
                        setFullName(event.target.value)
                      }
                      autoComplete="name"
                    />
                  </div>

                  <label>Student ID</label>

                  <div className="student-register-input">
                    <IonIcon icon={personOutline} />

                    <input
                      type="text"
                      placeholder="Enter your student ID"
                      value={studentId}
                      onChange={(event) =>
                        setStudentId(event.target.value)
                      }
                    />
                  </div>

                  <label>School / University</label>

                  <div className="student-register-input">
                    <IonIcon icon={businessOutline} />

                    <input
                      type="text"
                      placeholder="Enter your school or university"
                      value={school}
                      onChange={(event) =>
                        setSchool(event.target.value)
                      }
                    />
                  </div>

                  <label>Course / Program</label>

                  <div className="student-register-input">
                    <IonIcon icon={bookOutline} />

                    <select
                      value={course}
                      onChange={(event) =>
                        setCourse(event.target.value)
                      }
                    >
                      <option value="">Select your course</option>

                      {courseOptions.map((courseOption) => (
                        <option
                          key={courseOption}
                          value={courseOption}
                        >
                          {courseOption}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label>Year Level</label>

                  <div className="student-register-input">
                    <IonIcon icon={schoolOutline} />

                    <select
                      value={yearLevel}
                      onChange={(event) =>
                        setYearLevel(event.target.value)
                      }
                    >
                      <option value="">Select your year level</option>

                      {yearLevelOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* TERMS */}

                  <label className="student-register-terms">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(event) =>
                        setAcceptedTerms(event.target.checked)
                      }
                    />

                    <span>
                      I agree to the GrantAccess Terms and Conditions
                      and Privacy Policy.
                    </span>
                  </label>

                  <div className="student-register-actions">
                    <IonButton
                      fill="outline"
                      className="student-register-back"
                      onClick={handlePreviousStep}
                    >
                      <IonIcon
                        slot="start"
                        icon={arrowBackOutline}
                      />
                      Back
                    </IonButton>

                    <IonButton
                      className="student-register-submit"
                      onClick={handleNextStep}
                    >
                      Continue
                      <IonIcon
                        slot="end"
                        icon={arrowForwardOutline}
                      />
                    </IonButton>
                  </div>

                </div>
              )}

              {/* =================================================
                  STEP 4 - FACE LIVENESS
              ================================================= */}

              {registrationStep === 4 && (
                <div className="student-register-face-section">

                  <div className="student-register-face-icon">
                    <IonIcon icon={shieldCheckmarkOutline} />
                  </div>

                  <h3>Verify That You Are Present</h3>

                  <p>
                    Follow the instructions on your screen to complete
                    the face liveness verification.
                  </p>

                  {!faceVerified && !loading && (
                    <div className="student-register-face-camera">
                      <FaceLiveness
                        onVerified={handleFaceVerified}
                      />
                    </div>
                  )}

                  {loading && (
                    <div className="student-register-creating">
                      <IonSpinner name="crescent" />

                      <p>
                        Creating your student account...
                        <br />
                        Please wait while we prepare your dashboard.
                      </p>
                    </div>
                  )}

                  {faceVerified && !loading && !error && (
                    <div className="student-register-face-success">
                      <IonIcon icon={checkmarkCircle} />

                      <h3>Face Verification Successful!</h3>

                      <p>
                        Your account is being prepared.
                      </p>
                    </div>
                  )}

                  {faceVerified && !loading && error && (
                    <IonButton
                      expand="block"
                      className="student-register-submit"
                      onClick={() => createStudentAccount(true)}
                    >
                      Retry Account Creation
                    </IonButton>
                  )}

                  {!faceVerified && !loading && (
                    <IonButton
                      fill="outline"
                      expand="block"
                      className="student-register-back"
                      onClick={handlePreviousStep}
                    >
                      <IonIcon
                        slot="start"
                        icon={arrowBackOutline}
                      />
                      Back to Student Information
                    </IonButton>
                  )}

                </div>
              )}

              {/* FOOTER */}

              {registrationStep !== 4 && (
                <div className="student-register-footer">
                  <p>
                    Already have an account?{' '}
                    <Link to="/login">Sign In</Link>
                  </p>
                </div>
              )}

            </div>

            <div className="student-register-security">
              <IonIcon icon={shieldCheckmarkOutline} />
              <span>
                Your information is securely stored in GrantAccess.
              </span>
            </div>

          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default StudentRegister;
