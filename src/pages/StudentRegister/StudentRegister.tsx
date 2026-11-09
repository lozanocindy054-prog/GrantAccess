import React, { useEffect, useRef, useState } from 'react';

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
  cameraOutline,
  scanOutline,
  checkmarkCircle,
  shieldCheckmarkOutline,
  refreshOutline,
  videocamOutline,
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

import * as blazeface from '@tensorflow-models/blazeface';
import * as tf from '@tensorflow/tfjs';

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
// TYPES
// =====================================================

interface PendingStudentProfile {
  fullName: string;
  email: string;
  studentId: string;
  school: string;
  course: string;
  yearLevel: string;
}

type FaceModel = Awaited<ReturnType<typeof blazeface.load>>;

const PENDING_PROFILE_KEY = 'grantAccessPendingStudentProfile';

// =====================================================
// COMPONENT
// =====================================================

const StudentRegister: React.FC = () => {
  const navigate = useNavigate();

  // Student information
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [school, setSchool] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Registration steps
  const [registrationStep, setRegistrationStep] = useState(1);

  // General states
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Face verification
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<FaceModel | null>(null);

  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [faceChecking, setFaceChecking] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);
  const [faceStatus, setFaceStatus] = useState(
    'Position your face inside the guide.'
  );

  // =====================================================
  // STOP CAMERA
  // =====================================================

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraStarted(false);
  };

  // =====================================================
  // WAIT FOR MOBILE VIDEO TO BE READY
  // =====================================================

  const waitForVideoReady = async (
    video: HTMLVideoElement
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkVideo = () => {
        if (
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          resolve();
          return;
        }

        if (Date.now() - startTime > 10000) {
          reject(
            new Error(
              'Camera opened, but no video frame was received. Please try again.'
            )
          );
          return;
        }

        requestAnimationFrame(checkVideo);
      };

      checkVideo();
    });
  };

  // =====================================================
  // RESTORE PENDING REGISTRATION
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

          setRegistrationStep(5);
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
  // CAMERA CLEANUP WHEN CHANGING STEP
  // =====================================================

  useEffect(() => {
    if (registrationStep !== 4) {
      stopCamera();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });

        streamRef.current = null;
      }
    };
  }, [registrationStep]);

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
  // START CAMERA - MOBILE AND DESKTOP
  // =====================================================

  const startCamera = async () => {
    setError('');
    setFaceVerified(false);
    setCameraLoading(true);
    setFaceStatus('Requesting camera permission...');

    try {
      if (
        !window.isSecureContext ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error(
          'Camera access requires HTTPS. Please open GrantAccess using its secure HTTPS website.'
        );
      }

      stopCamera();

      let stream: MediaStream;

      try {
        // Preferred: front-facing camera
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
      } catch (firstError) {
        console.warn(
          'Preferred camera settings failed. Trying fallback:',
          firstError
        );

        // Fallback for devices with different camera constraints
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        throw new Error('Camera preview element was not found.');
      }

      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;

      // Important for mobile Safari and mobile Chrome
      await video.play();

      // Wait for real video frames before enabling face detection
      await waitForVideoReady(video);

      setCameraStarted(true);
      setFaceStatus(
        'Camera is ready. Position your face inside the guide.'
      );
    } catch (cameraError: unknown) {
      console.error('Camera error:', cameraError);

      stopCamera();

      const errorName =
        typeof cameraError === 'object' &&
        cameraError !== null &&
        'name' in cameraError
          ? String(cameraError.name)
          : '';

      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        setError(
          'Camera permission was denied. Please allow camera access in your browser settings.'
        );
      } else if (errorName === 'NotFoundError') {
        setError(
          'No camera was found on this device.'
        );
      } else if (errorName === 'NotReadableError') {
        setError(
          'Your camera may be in use by another application. Close other camera apps and try again.'
        );
      } else {
        setError(
          cameraError instanceof Error
            ? cameraError.message
            : 'Unable to access your camera. Please try again.'
        );
      }

      setFaceStatus('Camera could not be started.');
    } finally {
      setCameraLoading(false);
    }
  };

  // =====================================================
  // LOAD TENSORFLOW AND BLAZEFACE MODEL
  // =====================================================

  const loadFaceModel = async () => {
    if (modelRef.current) {
      return modelRef.current;
    }

    setFaceStatus('Preparing face detection system...');

    // Try WebGL first. If unavailable, use CPU.
    try {
      await tf.setBackend('webgl');
      await tf.ready();
    } catch (webglError) {
      console.warn(
        'WebGL backend unavailable. Trying CPU backend:',
        webglError
      );

      await tf.setBackend('cpu');
      await tf.ready();
    }

    setFaceStatus('Loading face detection model...');

    const model = await blazeface.load();

    modelRef.current = model;

    return model;
  };

  // =====================================================
  // VERIFY FACE
  // =====================================================

  const verifyFace = async () => {
    setError('');
    setSuccessMessage('');

    const video = videoRef.current;

    if (!cameraStarted || !video) {
      setError('Please start your camera first.');
      return;
    }

    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      setError(
        'Camera is not ready yet. Please wait for the preview and try again.'
      );
      return;
    }

    setFaceChecking(true);
    setFaceStatus('Analyzing your face...');

    try {
      const model = await loadFaceModel();

      // Recheck video after model loading
      if (
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0
      ) {
        throw new Error(
          'The camera preview stopped. Please restart your camera.'
        );
      }

      const predictions = await model.estimateFaces(
        video,
        false
      );

      if (predictions.length === 0) {
        setFaceVerified(false);
        setFaceStatus(
          'No face detected. Move closer and face the camera directly.'
        );
        return;
      }

      if (predictions.length > 1) {
        setFaceVerified(false);
        setFaceStatus(
          'Multiple faces detected. Make sure only one person is visible.'
        );
        return;
      }

      setFaceVerified(true);

      setFaceStatus(
        'One face detected successfully. You may continue.'
      );

      stopCamera();
    } catch (faceError: unknown) {
      console.error('Face detection error:', faceError);

      setFaceVerified(false);

      setFaceStatus(
        'Unable to analyze your face. Please try again.'
      );

      setError(
        faceError instanceof Error
          ? faceError.message
          : 'Face detection failed. Please try again.'
      );
    } finally {
      setFaceChecking(false);
    }
  };

  // =====================================================
  // RETAKE FACE VERIFICATION
  // =====================================================

  const retakeFaceVerification = () => {
    setFaceVerified(false);
    setFaceStatus('Start your camera to try again.');
    setError('');
    setSuccessMessage('');
  };

  // =====================================================
  // SAVE STUDENT AFTER EMAIL VERIFICATION
  // =====================================================

  const saveVerifiedStudentProfile = async (user: User) => {
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
  // CHECK EMAIL VERIFICATION
  // =====================================================

  const checkEmailVerification = async () => {
    setError('');
    setSuccessMessage('');

    const user = auth.currentUser;

    if (!user) {
      setError(
        'Your registration session has expired. Please sign in using your registered email and password.'
      );
      return;
    }

    setLoading(true);

    try {
      await reload(user);

      const refreshedUser = auth.currentUser;

      if (!refreshedUser?.emailVerified) {
        setError(
          'Your email is not verified yet. Open the verification link sent to your email, then try again.'
        );
        return;
      }

      await saveVerifiedStudentProfile(refreshedUser);
    } catch (verificationError: unknown) {
      console.error(
        'Email verification check failed:',
        verificationError
      );

      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'Unable to complete your registration. Please try again.'
      );
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

      setError(
        errorCode === 'auth/too-many-requests'
          ? 'Too many requests. Please wait before requesting another verification email.'
          : resendError instanceof Error
          ? resendError.message
          : 'Unable to resend verification email.'
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // CREATE STUDENT ACCOUNT
  // =====================================================

  const createStudentAccount = async () => {
    setError('');
    setSuccessMessage('');

    if (!faceVerified) {
      setError('Please complete face verification first.');
      return;
    }

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
      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );

      const user = userCredential.user;

      await updateProfile(user, {
        displayName: fullName.trim(),
      });

      sessionStorage.setItem(
        PENDING_PROFILE_KEY,
        JSON.stringify(pendingProfile)
      );

      await sendEmailVerification(user, {
        url: `${window.location.origin}/student-register`,
        handleCodeInApp: false,
      });

      setCurrentUser(user);
      setRegistrationStep(5);

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

  const handleRegister = (
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
      setError('');

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

      setRegistrationStep(4);
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
    } else if (registrationStep === 4) {
      stopCamera();
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

          {/* MAIN */}
          <main className="student-register-main">

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

            <form
              className="student-register-form"
              onSubmit={handleRegister}
              noValidate
            >
              {/* STEP HEADING */}
              <div className="student-register-form-heading">
                <div className="student-register-step-label">
                  STEP {registrationStep} OF 5
                </div>

                <div className="student-register-progress">
                  <span
                    style={{
                      width: `${registrationStep * 20}%`,
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
                    : registrationStep === 4
                    ? 'Face Verification'
                    : 'Verify Your Email'}
                </h2>

                <p>
                  {registrationStep === 1
                    ? 'Enter your active email address to get started.'
                    : registrationStep === 2
                    ? 'Create a secure password for your account.'
                    : registrationStep === 3
                    ? 'Complete your student information. Fields marked with * are required.'
                    : registrationStep === 4
                    ? 'We will check that one face is visible through your camera.'
                    : 'Please check your email and click the verification link we sent you.'}
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

              {/* STEP 1 */}
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

              {/* STEP 2 */}
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

              {/* STEP 3 */}
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

              {/* STEP 4: FACE VERIFICATION */}
              {registrationStep === 4 && (
                <div className="face-verification">

                  <div className="face-verification-intro">
                    <div className="face-verification-main-icon">
                      <IonIcon icon={shieldCheckmarkOutline} />
                    </div>

                    <h3>Let's verify your face</h3>

                    <p>
                      Make sure your face is clearly visible.
                      Look directly at the camera and stay in
                      a well-lit area.
                    </p>
                  </div>

                  <div className="face-verification-camera-card">

                    <div className="face-verification-camera-top">
                      <span>
                        <span className="face-live-dot" />
                        CAMERA PREVIEW
                      </span>

                      <span className="face-camera-label">
                        {cameraStarted ? 'Camera On' : 'Camera Off'}
                      </span>
                    </div>

                    <div className="face-verification-camera">
                      <video
                        ref={videoRef}
                        className="face-verification-video"
                        autoPlay
                        muted
                        playsInline
                      />

                      {!cameraStarted && (
                        <div className="face-camera-placeholder">
                          <div className="face-placeholder-icon">
                            <IonIcon icon={videocamOutline} />
                          </div>

                          <strong>Camera preview</strong>

                          <span>
                            Start your camera to begin
                          </span>
                        </div>
                      )}

                      {cameraStarted && !faceVerified && (
                        <div className="face-guide">
                          <div className="face-guide-oval" />
                          <span>Position your face here</span>
                        </div>
                      )}

                      {faceVerified && (
                        <div className="face-camera-success-overlay">
                          <IonIcon icon={checkmarkCircle} />
                          <strong>Face detected</strong>
                        </div>
                      )}
                    </div>

                    <div className="face-camera-status">
                      <span
                        className={
                          faceVerified
                            ? 'face-status-indicator verified'
                            : 'face-status-indicator'
                        }
                      />

                      <p>{faceStatus}</p>
                    </div>
                  </div>

                  <div className="face-verification-instructions">
                    <div className="face-instruction">
                      <span>01</span>
                      <div>
                        <strong>Face the camera</strong>
                        <small>
                          Look directly at your device camera.
                        </small>
                      </div>
                    </div>

                    <div className="face-instruction">
                      <span>02</span>
                      <div>
                        <strong>Good lighting</strong>
                        <small>
                          Make sure your face is well-lit.
                        </small>
                      </div>
                    </div>

                    <div className="face-instruction">
                      <span>03</span>
                      <div>
                        <strong>One person only</strong>
                        <small>
                          Only your face should appear.
                        </small>
                      </div>
                    </div>
                  </div>

                  {faceVerified ? (
                    <div className="face-verification-complete">
                      <IonIcon icon={checkmarkCircle} />

                      <div>
                        <strong>Face check completed!</strong>
                        <span>
                          You can now continue to create your account.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="face-verification-actions">
                      {!cameraStarted ? (
                        <IonButton
                          type="button"
                          expand="block"
                          className="face-primary-button"
                          disabled={cameraLoading || loading}
                          onClick={startCamera}
                        >
                          {cameraLoading ? (
                            <>
                              <IonSpinner name="crescent" />
                              &nbsp; Starting Camera...
                            </>
                          ) : (
                            <>
                              <IonIcon
                                slot="start"
                                icon={cameraOutline}
                              />
                              Start Camera
                            </>
                          )}
                        </IonButton>
                      ) : (
                        <>
                          <IonButton
                            type="button"
                            expand="block"
                            className="face-primary-button"
                            disabled={faceChecking || cameraLoading}
                            onClick={verifyFace}
                          >
                            {faceChecking ? (
                              <>
                                <IonSpinner name="crescent" />
                                &nbsp; Checking Face...
                              </>
                            ) : (
                              <>
                                <IonIcon
                                  slot="start"
                                  icon={scanOutline}
                                />
                                Verify My Face
                              </>
                            )}
                          </IonButton>

                          <IonButton
                            type="button"
                            expand="block"
                            fill="outline"
                            className="face-secondary-button"
                            onClick={() => {
                              stopCamera();
                              setFaceStatus(
                                'Camera stopped. Start again when ready.'
                              );
                            }}
                          >
                            Stop Camera
                          </IonButton>
                        </>
                      )}
                    </div>
                  )}

                  {faceVerified && (
                    <IonButton
                      type="button"
                      expand="block"
                      fill="outline"
                      className="face-secondary-button"
                      onClick={retakeFaceVerification}
                    >
                      <IonIcon
                        slot="start"
                        icon={refreshOutline}
                      />
                      Retake Face Check
                    </IonButton>
                  )}

                  <div className="face-privacy-note">
                    <IonIcon icon={shieldCheckmarkOutline} />

                    <p>
                      <strong>Your privacy matters.</strong>
                      This basic face check analyzes the camera
                      preview to detect whether a face is visible.
                      It does not identify the person or perform
                      liveness detection. The captured image is
                      not uploaded or saved by this page.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 5: EMAIL VERIFICATION */}
              {registrationStep === 5 && (
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
                registrationStep < 5 && (
                  <IonButton
                    type="button"
                    expand="block"
                    fill="outline"
                    className="student-register-back"
                    disabled={
                      loading ||
                      cameraLoading ||
                      faceChecking
                    }
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
                  {loading ? (
                    <>
                      <IonSpinner name="crescent" />
                      &nbsp; Processing...
                    </>
                  ) : (
                    'Continue'
                  )}
                </IonButton>
              )}

              {/* CREATE ACCOUNT AFTER FACE CHECK */}
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
                    'Continue to Email Verification'
                  )}
                </IonButton>
              )}

              {/* SIGN IN LINK */}
              <p className="student-register-login-link">
                Already have an account?{' '}
                <Link to="/login">Sign in here</Link>
              </p>
            </form>

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