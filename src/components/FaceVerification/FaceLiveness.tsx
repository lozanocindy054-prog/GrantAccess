
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

interface FaceLivenessProps {
  onVerified: () => void;
}

type Challenge = 'blink' | 'left' | 'right' | 'smile';

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

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

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

const FaceLiveness: React.FC<FaceLivenessProps> = ({
  onVerified,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationRef = useRef<number | null>(null);

  const challengesRef = useRef<Challenge[]>([]);
  const challengeIndexRef = useRef(0);

  const blinkClosedRef = useRef(false);
  const completedRef = useRef(false);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const statusRef = useRef('');

  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);

  const [challengeList, setChallengeList] = useState<Challenge[]>([]);
  const [challengeIndex, setChallengeIndex] = useState(0);

  const [status, setStatus] = useState(
    'Start your camera to begin verification.'
  );

  const [error, setError] = useState('');

  const updateStatus = useCallback((message: string) => {
    if (statusRef.current !== message) {
      statusRef.current = message;
      setStatus(message);
    }
  }, []);

  const stopCamera = useCallback(() => {
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

    if (mountedRef.current) {
      setCameraStarted(false);
    }
  }, []);

  const loadLandmarker = async (): Promise<FaceLandmarker> => {
    if (landmarkerRef.current) {
      return landmarkerRef.current;
    }

    updateStatus('Loading face liveness model...');

    const vision = await FilesetResolver.forVisionTasks(WASM_URL);

    const commonOptions = {
      runningMode: 'VIDEO' as const,
      numFaces: 2,
      outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.6,
      minFacePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    };

    let landmarker: FaceLandmarker;

    // Try GPU first.
    try {
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
    } catch (gpuError) {
      console.warn(
        'GPU is unavailable. Switching to CPU.',
        gpuError
      );

      // Use CPU if the device does not support GPU delegate.
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
    }

    landmarkerRef.current = landmarker;

    return landmarker;
  };

  const getBlendshape = (
    result: FaceLandmarkerResult,
    name: string
  ): number => {
    const categories = (
      result.faceBlendshapes?.[0]?.categories || []
    ) as Array<{
      categoryName: string;
      score: number;
    }>;

    const matched = categories.find(
      (item) => item.categoryName === name
    );

    return matched?.score ?? 0;
  };

  const completeCurrentChallenge = () => {
    if (completedRef.current) return;

    const nextIndex = challengeIndexRef.current + 1;

    challengeIndexRef.current = nextIndex;
    setChallengeIndex(nextIndex);

    blinkClosedRef.current = false;

    if (nextIndex >= challengesRef.current.length) {
      completedRef.current = true;

      stopCamera();

      setFaceVerified(true);

      updateStatus(
        'All liveness challenges completed successfully!'
      );

      onVerified();

      return;
    }

    const nextChallenge = challengesRef.current[nextIndex];

    updateStatus(
      `Great! Next: ${challengeLabels[nextChallenge]}`
    );
  };

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

    // BLINK CHALLENGE
    if (challenge === 'blink') {
      const leftEye = getBlendshape(
        result,
        'eyeBlinkLeft'
      );

      const rightEye = getBlendshape(
        result,
        'eyeBlinkRight'
      );

      if (leftEye > 0.55 && rightEye > 0.55) {
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
        processingRef.current = true;

        updateStatus('Blink detected!');

        completeCurrentChallenge();

        processingRef.current = false;
      }

      return;
    }

    // SMILE CHALLENGE
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
        processingRef.current = true;

        updateStatus('Smile detected!');

        completeCurrentChallenge();

        processingRef.current = false;
      } else {
        updateStatus(
          'Please smile naturally at the camera.'
        );
      }

      return;
    }

    // HEAD TURN CHALLENGE
    // This is a basic movement estimate, not identity recognition.
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

    /*
      NOTE:
      The video frame is not mirrored during analysis.
      If left/right appears reversed on your phone,
      swap the two comparison signs below.
    */

    if (challenge === 'left') {
      if (yawOffset > 0.12) {
        processingRef.current = true;

        updateStatus('Head turn detected!');

        completeCurrentChallenge();

        processingRef.current = false;
      } else {
        updateStatus(
          'Slowly turn your head to your left.'
        );
      }
    }

    if (challenge === 'right') {
      if (yawOffset < -0.12) {
        processingRef.current = true;

        updateStatus('Head turn detected!');

        completeCurrentChallenge();

        processingRef.current = false;
      } else {
        updateStatus(
          'Slowly turn your head to your right.'
        );
      }
    }
  };

  const startAnalysis = () => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker) return;

    const loop = () => {
      if (
        !streamRef.current ||
        completedRef.current
      ) {
        return;
      }

      if (
        video.readyState >=
          HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0
      ) {
        try {
          const result = landmarker.detectForVideo(
            video,
            performance.now()
          );

          analyzeFrame(result);
        } catch (analysisError) {
          console.error(
            'MediaPipe frame error:',
            analysisError
          );
        }
      }

      if (
        streamRef.current &&
        !completedRef.current
      ) {
        animationRef.current =
          requestAnimationFrame(loop);
      }
    };

    animationRef.current = requestAnimationFrame(loop);
  };

  const waitForVideoReady = (
    video: HTMLVideoElement
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const started = Date.now();

      const check = () => {
        if (
          video.readyState >=
            HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.videoWidth > 0
        ) {
          resolve();
          return;
        }

        if (Date.now() - started > 12000) {
          reject(
            new Error(
              'Camera did not provide a video frame. Please try again.'
            )
          );

          return;
        }

        requestAnimationFrame(check);
      };

      check();
    });
  };

  const startCamera = async () => {
    setError('');
    setFaceVerified(false);

    completedRef.current = false;
    processingRef.current = false;
    blinkClosedRef.current = false;

    setCameraLoading(true);

    try {
      if (
        !window.isSecureContext ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error(
          'Camera access requires HTTPS. Open GrantAccess using its secure website.'
        );
      }

      stopCamera();

      updateStatus('Preparing camera and face detection...');

      const landmarker = await loadLandmarker();

      let stream: MediaStream;

      try {
        stream =
          await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: 'user' },
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
          });
      } catch (firstCameraError) {
        console.warn(
          'Front camera request failed. Trying default camera.',
          firstCameraError
        );

        stream =
          await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
      }

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        throw new Error(
          'Camera preview was not found.'
        );
      }

      video.srcObject = stream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;

      await video.play();

      await waitForVideoReady(video);

      const randomChallenges =
        createRandomChallenges();

      challengesRef.current = randomChallenges;
      challengeIndexRef.current = 0;

      setChallengeList(randomChallenges);
      setChallengeIndex(0);

      blinkClosedRef.current = false;
      completedRef.current = false;

      setCameraStarted(true);

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
        cameraError instanceof Error
          ? cameraError.message
          : 'Unable to start face verification.'
      );

      updateStatus(
        'Unable to start face verification.'
      );
    } finally {
      setCameraLoading(false);
    }
  };

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

  const handleStopCamera = () => {
    stopCamera();

    completedRef.current = false;
    processingRef.current = false;
    blinkClosedRef.current = false;

    updateStatus(
      'Camera stopped. Start again when ready.'
    );
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

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

  const activeChallenge =
    challengeList[challengeIndex];

  return (
    <div className="ga-liveness">
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
            {cameraStarted ? 'Camera On' : 'Camera Off'}
          </small>
        </div>

        <div className="ga-liveness-preview">
          <video
            ref={videoRef}
            className="ga-liveness-video"
            autoPlay
            muted
            playsInline
          />

          {!cameraStarted && !faceVerified && (
            <div className="ga-liveness-placeholder">
              <IonIcon icon={videocamOutline} />

              <strong>Camera preview</strong>

              <span>
                Start your camera to begin
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

        <div className="ga-liveness-status">
          <span
            className={
              faceVerified ? 'verified' : ''
            }
          />

          <p>{status}</p>
        </div>
      </div>

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

      {error && (
        <div
          className="ga-liveness-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {!faceVerified ? (
        <IonButton
          type="button"
          expand="block"
          className="ga-liveness-primary"
          disabled={cameraLoading || cameraStarted}
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

      <div className="ga-liveness-privacy">
        <IonIcon icon={shieldCheckmarkOutline} />

        <p>
          This browser-based check analyzes facial
          movements from the live camera preview. It
          does not identify your identity or guarantee
          protection against spoofing. Camera frames
          are processed locally by this component and
          are not uploaded by this component.
        </p>
      </div>
    </div>
  );
};

export default FaceLiveness;
