
import React, { useEffect, useRef, useState } from 'react';
import '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

interface FaceVerificationProps {
  onVerified: () => void;
}

const FaceVerification: React.FC<FaceVerificationProps> = ({
  onVerified,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const [loading, setLoading] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStarted(false);
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startVerification = async () => {
    setError('');
    setFaceDetected(false);
    setVerified(false);
    setLoading(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera is unavailable. Please use HTTPS or localhost and allow camera access.'
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        throw new Error('Camera preview could not be initialized.');
      }

      video.srcObject = stream;
      await video.play();

      setCameraStarted(true);

      const model = await blazeface.load();

      let consecutiveDetections = 0;

      const detectFace = async () => {
        if (!mountedRef.current || !streamRef.current) return;

        try {
          const predictions = await model.estimateFaces(
            video,
            false
          );

          if (predictions.length > 0) {
            consecutiveDetections += 1;
            setFaceDetected(true);

            if (consecutiveDetections >= 3) {
              setVerified(true);
              stopCamera();
              onVerified();
              return;
            }
          } else {
            consecutiveDetections = 0;
            setFaceDetected(false);
          }

          timerRef.current = window.setTimeout(detectFace, 500);
        } catch (detectionError) {
          console.error('Face detection error:', detectionError);
          setError('Unable to detect your face. Please try again.');
          stopCamera();
        }
      };

      await detectFace();
    } catch (cameraError: unknown) {
      console.error('Face verification error:', cameraError);

      const errorName =
        typeof cameraError === 'object' &&
        cameraError !== null &&
        'name' in cameraError
          ? String(cameraError.name)
          : '';

      if (errorName === 'NotAllowedError') {
        setError('Please allow camera access in your browser settings.');
      } else if (errorName === 'NotFoundError') {
        setError('No camera was found on your device.');
      } else {
        setError(
          cameraError instanceof Error
            ? cameraError.message
            : 'Unable to start face verification.'
        );
      }

      stopCamera();
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="face-verification">
      <div className="face-verification-camera">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="face-verification-video"
        />

        {!cameraStarted && (
          <div className="face-verification-placeholder">
            <span>◎</span>
            <p>Camera preview will appear here</p>
          </div>
        )}

        {cameraStarted && (
          <div className="face-verification-frame">
            <span />
          </div>
        )}
      </div>

      <div className="face-verification-status">
        {verified ? (
          <p className="face-status-success">
            ✓ Face detected successfully!
          </p>
        ) : faceDetected ? (
          <p className="face-status-success">
            Face detected. Please keep your face centered.
          </p>
        ) : cameraStarted ? (
          <p>Looking for your face...</p>
        ) : (
          <p>Position your face in front of the camera.</p>
        )}
      </div>

      {error && (
        <div className="student-register-error" role="alert">
          {error}
        </div>
      )}

      {!verified && (
        <button
          type="button"
          className="face-verification-button"
          onClick={startVerification}
          disabled={loading || cameraStarted}
        >
          {loading
            ? 'Starting camera...'
            : cameraStarted
            ? 'Scanning face...'
            : 'Start Face Verification'}
        </button>
      )}

      {verified && (
        <div className="face-verification-complete">
          Face verification completed.
        </div>
      )}

      {cameraStarted && (
        <button
          type="button"
          className="face-verification-cancel"
          onClick={stopCamera}
        >
          Cancel Camera
        </button>
      )}

      <small className="face-verification-note">
        GrantAccess uses your camera to check for a visible face.
        This basic check does not confirm your identity or detect
        spoofing using photos and videos.
      </small>
    </div>
  );
};

export default FaceVerification;
