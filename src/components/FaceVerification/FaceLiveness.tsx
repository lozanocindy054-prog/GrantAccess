
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

import {
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/react';

import {
  cameraOutline,
  checkmarkCircle,
  refreshOutline,
  shieldCheckmarkOutline,
  videocamOutline,
} from 'ionicons/icons';

import './FaceLiveness.css';

// =====================================================
// TYPES
// =====================================================

interface FaceLivenessProps {
  onVerified: () => void;
}

type Challenge = 'blink' | 'left' | 'right' | 'smile';

// =====================================================
// CHALLENGE LABELS
// =====================================================

const challengeLabels: Record<Challenge, string> = {
  blink: 'BLINK YOUR EYES',
  left: 'TURN YOUR HEAD LEFT',
  right: 'TURN YOUR HEAD RIGHT',
  smile: 'SMILE AT THE CAMERA',
};

const challengeInstructions: Record<Challenge, string> = {
  blink: 'Close both eyes briefly, then open them.',
  left: 'Slowly turn your head to your left.',
  right: 'Slowly turn your head to your right.',
  smile: 'Show a natural smile.',
};

// =====================================================
// MEDIAPIPE CONFIGURATION
// =====================================================

const MEDIAPIPE_VERSION = '0.10.14';

const WASM_URL =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// =====================================================
// RANDOM CHALLENGES
// =====================================================

const createRandomChallenges = (): Challenge[] => {
  const all: Challenge[] = [
    'blink',
    'left',
    'right',
    'smile',
  ];

  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  return all.slice(0, 3);
};

// =====================================================
// DEVICE DETECTION
// =====================================================

const isMobileDevice = (): boolean => {
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (
      navigator.maxTouchPoints > 1 &&
      /Macintosh/i.test(navigator.userAgent)
    )
  );
};

// =====================================================
// COMPONENT
// =====================================================

const FaceLiveness: React.FC<FaceLivenessProps> = ({
  onVerified,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);

  const animationRef = useRef<number | null>(null);

  const mountedRef = useRef(false);
  const startRequestRef = useRef(false);

  const challengesRef = useRef<Challenge[]>([]);
  const challengeIndexRef = useRef(0);

  const blinkClosedRef = useRef(false);
  const completedRef = useRef(false);
  const processingRef = useRef(false);

  const lastDetectionRef = useRef(0);
  const statusRef = useRef('');

  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);

  const [challengeList, setChallengeList] = useState<Challenge[]>([]);
  const [challengeIndex, setChallengeIndex] = useState(0);

  const [status, setStatus] = useState(
    'Press Start Face Verification to begin.'
  );

  const [error, setError] = useState('');

  const mobile = isMobileDevice();

  // =====================================================
  // STATUS
  // =====================================================

  const updateStatus = useCallback((message: string) => {
    if (!mountedRef.current) return;

    if (statusRef.current !== message) {
      statusRef.current = message;
      setStatus(message);
    }
  }, []);

  // =====================================================
  // STOP ANALYSIS
  // =====================================================

  const stopAnalysis = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // =====================================================
  // STOP CAMERA
  // =====================================================

  const stopCamera = useCallback(() => {
    stopAnalysis();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    const video = videoRef.current;

    if (video) {
      video.pause();
      video.srcObject = null;
    }

    if (mountedRef.current) {
      setCameraStarted(false);
    }
  }, [stopAnalysis]);

  // =====================================================
  // LOAD MEDIAPIPE MODEL
  // =====================================================

  const loadLandmarker = async (): Promise<FaceLandmarker> => {
    if (landmarkerRef.current) {
      return landmarkerRef.current;
    }

    setModelLoading(true);

    updateStatus('Loading face detection model...');

    try {
      const vision = await FilesetResolver.forVisionTasks(
        WASM_URL
      );

      const commonOptions = {
        runningMode: 'VIDEO' as const,
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      };

      let landmarker: FaceLandmarker;

      // Try CPU first. This is generally a safer starting
      // point for mobile devices.
      try {
        landmarker = await FaceLandmarker.createFromOptions(
          vision,
          {
            ...commonOptions,
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: 'CPU',
            },
          }
        );
      } catch (cpuError) {
        console.warn(
          'MediaPipe CPU initialization failed. Trying GPU.',
          cpuError
        );

        landmarker = await FaceLandmarker.createFromOptions(
          vision,
          {
            ...commonOptions,
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: 'GPU',
            },
          }
        );
      }

      if (!mountedRef.current) {
        landmarker.close();

        throw new Error(
          'Face verification was closed.'
        );
      }

      landmarkerRef.current = landmarker;

      return landmarker;

    } finally {
      if (mountedRef.current) {
        setModelLoading(false);
      }
    }
  };

  // =====================================================
  // GET BLENDSHAPE VALUE
  // =====================================================

  const getBlendshape = (
    result: FaceLandmarkerResult,
    name: string
  ): number => {
    const categories =
      result.faceBlendshapes?.[0]?.categories || [];

    const matched = categories.find(
      (item) => item.categoryName === name
    );

    return matched?.score ?? 0;
  };

  // =====================================================
  // COMPLETE CHALLENGE
  // =====================================================

  const completeCurrentChallenge = () => {
    if (
      completedRef.current ||
      processingRef.current
    ) {
      return;
    }

    processingRef.current = true;

    const nextIndex = challengeIndexRef.current + 1;

    challengeIndexRef.current = nextIndex;

    if (mountedRef.current) {
      setChallengeIndex(nextIndex);
    }

    blinkClosedRef.current = false;

    if (nextIndex >= challengesRef.current.length) {
      completedRef.current = true;

      stopCamera();

      if (mountedRef.current) {
        setFaceVerified(true);

        updateStatus(
          'All liveness challenges completed successfully!'
        );
      }

      onVerified();

      processingRef.current = false;
      return;
    }

    const nextChallenge =
      challengesRef.current[nextIndex];

    updateStatus(
      `Great! Next: ${challengeLabels[nextChallenge]}`
    );

    processingRef.current = false;
  };

  // =====================================================
  // ANALYZE FRAME
  // =====================================================

  const analyzeFrame = (
    result: FaceLandmarkerResult
  ) => {
    if (
      completedRef.current ||
      processingRef.current
    ) {
      return;
    }

    const faces = result.faceLandmarks || [];

    if (faces.length === 0) {
      updateStatus(
        'No face detected. Position your face inside the camera.'
      );
      return;
    }

    if (faces.length > 1) {
      updateStatus(
        'Multiple faces detected. Only one person should be visible.'
      );
      return;
    }

    const challenge =
      challengesRef.current[challengeIndexRef.current];

    if (!challenge) return;

    const landmarks = faces[0];

    // BLINK

    if (challenge === 'blink') {
      const leftEye = getBlendshape(
        result,
        'eyeBlinkLeft'
      );

      const rightEye = getBlendshape(
        result,
        'eyeBlinkRight'
      );

      if (
        leftEye > 0.55 &&
        rightEye > 0.55
      ) {
        blinkClosedRef.current = true;

        updateStatus(
          'Eyes closed detected. Open your eyes now.'
        );
      }

      if (
        blinkClosedRef.current &&
        leftEye < 0.25 &&
        rightEye < 0.25
      ) {
        updateStatus('Blink detected!');
        completeCurrentChallenge();
      }

      return;
    }

    // SMILE

    if (challenge === 'smile') {
      const leftSmile = getBlendshape(
        result,
        'mouthSmileLeft'
      );

      const rightSmile = getBlendshape(
        result,
        'mouthSmileRight'
      );

      if (
        leftSmile > 0.35 &&
        rightSmile > 0.35
      ) {
        updateStatus('Smile detected!');
        completeCurrentChallenge();
      } else {
        updateStatus(
          'Please smile naturally at the camera.'
        );
      }

      return;
    }

    // HEAD TURN

    const nose = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];

    if (!nose || !leftEye || !rightEye) {
      return;
    }

    const eyeCenter =
      (leftEye.x + rightEye.x) / 2;

    const faceWidth = Math.max(
      Math.abs(rightEye.x - leftEye.x),
      0.01
    );

    const yawOffset =
      (nose.x - eyeCenter) / faceWidth;

    if (challenge === 'left') {
      if (yawOffset > 0.12) {
        updateStatus('Head turn detected!');
        completeCurrentChallenge();
      } else {
        updateStatus(
          'Slowly turn your head to your left.'
        );
      }
    }

    if (challenge === 'right') {
      if (yawOffset < -0.12) {
        updateStatus('Head turn detected!');
        completeCurrentChallenge();
      } else {
        updateStatus(
          'Slowly turn your head to your right.'
        );
      }
    }
  };

  // =====================================================
  // START FRAME ANALYSIS
  // =====================================================

  const startAnalysis = () => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker) return;

    stopAnalysis();

    const detectionInterval = mobile ? 120 : 50;

    const loop = () => {
      if (
        !streamRef.current ||
        completedRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      const now = performance.now();

      if (
        now - lastDetectionRef.current >= detectionInterval &&
        video.readyState >=
          HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        lastDetectionRef.current = now;

        try {
          const result = landmarker.detectForVideo(
            video,
            now
          );

          analyzeFrame(result);

        } catch (analysisError) {
          console.error(
            'MediaPipe frame analysis error:',
            analysisError
          );

          updateStatus(
            'Unable to analyze camera frame. Keep your face visible.'
          );
        }
      }

      if (
        streamRef.current &&
        !completedRef.current &&
        mountedRef.current
      ) {
        animationRef.current =
          requestAnimationFrame(loop);
      }
    };

    animationRef.current =
      requestAnimationFrame(loop);
  };

  // =====================================================
  // WAIT FOR VIDEO FRAME
  // =====================================================

  const waitForVideoReady = (
    video: HTMLVideoElement
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const started = Date.now();

      let frameRequest = 0;

      const cleanup = () => {
        if (frameRequest) {
          cancelAnimationFrame(frameRequest);
        }
      };

      const check = () => {
        if (!mountedRef.current) {
          cleanup();

          reject(
            new Error('Verification was closed.')
          );

          return;
        }

        if (
          video.readyState >=
            HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          cleanup();
          resolve();
          return;
        }

        if (Date.now() - started > 20000) {
          cleanup();

          reject(
            new Error(
              'Camera did not provide a video frame. Check camera permission and try again.'
            )
          );

          return;
        }

        frameRequest =
          requestAnimationFrame(check);
      };

      check();
    });
  };

  // =====================================================
  // CAMERA ERROR MESSAGE
  // =====================================================

  const getCameraErrorMessage = (
    cameraError: unknown
  ): string => {
    const errorName =
      cameraError instanceof Error
        ? cameraError.name
        : '';

    if (
      errorName === 'NotAllowedError' ||
      errorName === 'PermissionDeniedError'
    ) {
      return 'Camera permission was denied. Allow camera access in your browser settings, then try again.';
    }

    if (
      errorName === 'NotFoundError' ||
      errorName === 'DevicesNotFoundError'
    ) {
      return 'No camera was found on this device.';
    }

    if (
      errorName === 'NotReadableError' ||
      errorName === 'TrackStartError'
    ) {
      return 'Your camera may already be in use by another application. Close other camera apps and try again.';
    }

    if (errorName === 'OverconstrainedError') {
      return 'The requested camera settings are not supported. Please try again.';
    }

    if (
      errorName === 'SecurityError' ||
      errorName === 'NotSupportedError'
    ) {
      return 'Camera access requires a supported browser and a secure HTTPS connection.';
    }

    if (
      cameraError instanceof TypeError ||
      (
        cameraError instanceof Error &&
        /fetch|network|download/i.test(cameraError.message)
      )
    ) {
      return 'Unable to download the face verification model. Check your internet connection and try again.';
    }

    return cameraError instanceof Error
      ? cameraError.message
      : 'Unable to start face verification. Please try again.';
  };

  // =====================================================
  // START CAMERA
  // =====================================================

  const startCamera = async () => {
    if (
      startRequestRef.current ||
      cameraLoading ||
      cameraStarted ||
      faceVerified
    ) {
      return;
    }

    startRequestRef.current = true;

    setError('');
    setFaceVerified(false);
    setCameraLoading(true);

    completedRef.current = false;
    processingRef.current = false;
    blinkClosedRef.current = false;

    lastDetectionRef.current = 0;

    challengesRef.current = [];
    challengeIndexRef.current = 0;

    setChallengeList([]);
    setChallengeIndex(0);

    try {
      // HTTPS CHECK

      if (
        !window.isSecureContext ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          'Camera access requires HTTPS. Open GrantAccess using its secure HTTPS website. Localhost is also supported for development.'
        );
      }

      stopCamera();

      updateStatus('Requesting camera permission...');

      // REQUEST FRONT CAMERA

      let stream: MediaStream;

      try {
        stream =
          await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: {
                ideal: 'user',
              },
              width: {
                ideal: mobile ? 480 : 640,
              },
              height: {
                ideal: mobile ? 360 : 480,
              },
              frameRate: {
                ideal: 24,
                max: 30,
              },
            },
          });

      } catch (frontCameraError) {
        console.warn(
          'Front camera request failed. Trying default camera.',
          frontCameraError
        );

        stream =
          await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
      }

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });

        return;
      }

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        throw new Error(
          'Camera preview was not found. Refresh the page and try again.'
        );
      }

      // MOBILE BROWSER COMPATIBILITY

      video.pause();

      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;

      video.setAttribute('autoplay', '');
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');

      video.disablePictureInPicture = true;

      video.srcObject = stream;

      updateStatus('Starting camera preview...');

      // WAIT FOR VIDEO METADATA

      await new Promise<void>((resolve, reject) => {
        let finished = false;

        const timeout = window.setTimeout(() => {
          if (finished) return;

          finished = true;

          video.removeEventListener(
            'loadedmetadata',
            handleReady
          );

          video.removeEventListener(
            'loadeddata',
            handleReady
          );

          reject(
            new Error(
              'Camera preview initialization timed out.'
            )
          );
        }, 15000);

        const handleReady = () => {
          if (finished) return;

          finished = true;

          window.clearTimeout(timeout);

          video.removeEventListener(
            'loadedmetadata',
            handleReady
          );

          video.removeEventListener(
            'loadeddata',
            handleReady
          );

          resolve();
        };

        video.addEventListener(
          'loadedmetadata',
          handleReady
        );

        video.addEventListener(
          'loadeddata',
          handleReady
        );

        if (video.readyState >= 2) {
          handleReady();
        }
      });

      // PLAY VIDEO

      await video.play();

      // WAIT FOR REAL VIDEO FRAME

      await waitForVideoReady(video);

      if (!mountedRef.current) return;

      setCameraStarted(true);

      updateStatus(
        'Camera ready. Loading face detection model...'
      );

      // LOAD MEDIAPIPE

      const landmarker = await loadLandmarker();

      if (!mountedRef.current) return;

      if (!landmarker) {
        throw new Error(
          'Face detection model could not be initialized.'
        );
      }

      // CREATE RANDOM CHALLENGES

      const randomChallenges =
        createRandomChallenges();

      challengesRef.current = randomChallenges;
      challengeIndexRef.current = 0;

      setChallengeList(randomChallenges);
      setChallengeIndex(0);

      blinkClosedRef.current = false;
      completedRef.current = false;

      updateStatus(
        `Challenge 1: ${challengeLabels[randomChallenges[0]]}`
      );

      startAnalysis();

    } catch (cameraError: unknown) {
      console.error(
        'Face liveness startup error:',
        cameraError
      );

      stopCamera();

      setError(
        getCameraErrorMessage(cameraError)
      );

      updateStatus(
        'Unable to start face verification.'
      );

    } finally {
      startRequestRef.current = false;

      if (mountedRef.current) {
        setCameraLoading(false);
      }
    }
  };

  // =====================================================
  // RETAKE
  // =====================================================

  const retake = () => {
    stopCamera();

    completedRef.current = false;
    processingRef.current = false;
    blinkClosedRef.current = false;

    challengesRef.current = [];
    challengeIndexRef.current = 0;

    setFaceVerified(false);
    setChallengeList([]);
    setChallengeIndex(0);
    setError('');

    updateStatus(
      'Start your camera to try again.'
    );
  };

  // =====================================================
  // STOP CAMERA
  // =====================================================

  const handleStopCamera = () => {
    stopCamera();

    completedRef.current = false;
    processingRef.current = false;
    blinkClosedRef.current = false;

    updateStatus(
      'Camera stopped. Start again when ready.'
    );
  };

  // =====================================================
  // CLEANUP
  // =====================================================

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

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

      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  // =====================================================
  // ACTIVE CHALLENGE
  // =====================================================

  const activeChallenge =
    challengeList[challengeIndex];

  // =====================================================
  // USER INTERFACE
  // =====================================================

  return (
    <div className="ga-liveness">

      {/* INTRO */}

      <div className="ga-liveness-intro">
        <div className="ga-liveness-icon">
          <IonIcon icon={shieldCheckmarkOutline} />
        </div>

        <h3>Face Liveness Verification</h3>

        <p>
          Follow the instructions shown on your screen
          to complete your face liveness check.
        </p>
      </div>

      {/* CAMERA CARD */}

      <div className="ga-liveness-camera-card">

        <div className="ga-liveness-camera-heading">
          <span>
            <span
              className={
                cameraStarted
                  ? 'ga-liveness-dot active'
                  : 'ga-liveness-dot'
              }
            />

            CAMERA PREVIEW
          </span>

          <small>
            {cameraLoading
              ? 'Preparing...'
              : cameraStarted
                ? 'Camera On'
                : 'Camera Off'}
          </small>
        </div>

        <div
          className={`ga-liveness-preview ${
            cameraStarted ? 'is-active' : ''
          }`}
        >
          <video
            ref={videoRef}
            className="ga-liveness-video"
            autoPlay
            muted
            playsInline
            disablePictureInPicture
          />

          {!cameraStarted && (
            <div className="ga-liveness-placeholder">
              {cameraLoading ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={videocamOutline} />
              )}

              <strong>
                {cameraLoading
                  ? 'Preparing your camera'
                  : 'Camera preview'}
              </strong>

              <span>
                {cameraLoading
                  ? 'Please wait...'
                  : 'Press Start Face Verification'}
              </span>
            </div>
          )}

          {cameraStarted && (
            <div className="ga-liveness-guide">
              <div className="ga-liveness-oval" />
            </div>
          )}

          {faceVerified && (
            <div className="ga-liveness-success-overlay">
              <IonIcon icon={checkmarkCircle} />

              <strong>
                Liveness Check Passed
              </strong>
            </div>
          )}
        </div>

        {/* STATUS */}

        <div className="ga-liveness-status">
          <span
            className={
              faceVerified ? 'verified' : ''
            }
          />

          <p>{status}</p>
        </div>
      </div>

      {/* CHALLENGES */}

      {cameraStarted && activeChallenge && (
        <div className="ga-liveness-challenge">

          <span className="ga-liveness-challenge-label">
            YOUR CURRENT CHALLENGE
          </span>

          <strong>
            {challengeLabels[activeChallenge]}
          </strong>

          <p>
            {challengeInstructions[activeChallenge]}
          </p>

          <div className="ga-liveness-progress">
            {challengeList.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className={
                  index < challengeIndex
                    ? 'done'
                    : index === challengeIndex
                      ? 'current'
                      : ''
                }
              />
            ))}
          </div>

          <small>
            Challenge {challengeIndex + 1} of{' '}
            {challengeList.length}
          </small>
        </div>
      )}

      {/* MODEL LOADING */}

      {modelLoading && (
        <div className="ga-liveness-loading">
          <IonSpinner name="crescent" />

          <span>
            Loading face detection model...
          </span>
        </div>
      )}

      {/* ERROR */}

      {error && (
        <div
          className="ga-liveness-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* START / VERIFIED */}

      {!faceVerified ? (
        <IonButton
          type="button"
          expand="block"
          className="ga-liveness-primary"
          disabled={
            cameraLoading ||
            cameraStarted ||
            modelLoading
          }
          onClick={startCamera}
        >
          {cameraLoading ? (
            <>
              <IonSpinner name="crescent" />
              &nbsp; Preparing Camera...
            </>
          ) : cameraStarted ? (
            'Complete the Challenges'
          ) : (
            <>
              <IonIcon
                slot="start"
                icon={cameraOutline}
              />

              Start Face Verification
            </>
          )}
        </IonButton>
      ) : (
        <div className="ga-liveness-complete">
          <IonIcon icon={checkmarkCircle} />

          <div>
            <strong>
              Verification completed!
            </strong>

            <span>
              You may continue your registration.
            </span>
          </div>
        </div>
      )}

      {/* RETAKE */}

      {faceVerified && (
        <IonButton
          type="button"
          expand="block"
          fill="outline"
          className="ga-liveness-secondary"
          onClick={retake}
        >
          <IonIcon
            slot="start"
            icon={refreshOutline}
          />

          Retake Verification
        </IonButton>
      )}

      {/* STOP CAMERA */}

      {cameraStarted && (
        <IonButton
          type="button"
          expand="block"
          fill="outline"
          className="ga-liveness-secondary"
          onClick={handleStopCamera}
        >
          Stop Camera
        </IonButton>
      )}

      {/* PRIVACY NOTICE */}

      <div className="ga-liveness-privacy">
        <IonIcon icon={shieldCheckmarkOutline} />

        <p>
          This check analyzes facial movements from your
          live camera preview. It does not identify your
          identity or guarantee protection against spoofing.
          This component does not intentionally upload camera
          frames to your application server.
        </p>
      </div>

    </div>
  );
};

export default FaceLiveness;
