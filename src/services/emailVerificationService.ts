
// =====================================================
// GRANTACCESS - EMAIL OTP VERIFICATION SERVICE
// Firebase Cloud Functions Region: us-central1
// =====================================================

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../Firebase/config';

// Explicitly connect to the deployed Firebase Functions region
const functions = getFunctions(app, 'us-central1');

// =====================================================
// RESPONSE INTERFACE
// =====================================================

interface VerificationResponse {
  sent?: boolean;
  token?: string;
  verified?: boolean;
}

// =====================================================
// STEP 1: SEND 6-DIGIT EMAIL VERIFICATION CODE
// =====================================================

export const sendEmailVerificationCode = async (
  email: string
): Promise<void> => {
  const sendCode = httpsCallable<
    { email: string },
    VerificationResponse
  >(functions, 'sendEmailVerificationCode');

  await sendCode({
    email: email.trim().toLowerCase(),
  });
};

// =====================================================
// STEP 2: VERIFY THE 6-DIGIT EMAIL CODE
// =====================================================

export const verifyEmailVerificationCode = async (
  email: string,
  code: string
): Promise<string> => {
  const verifyCode = httpsCallable<
    { email: string; code: string },
    VerificationResponse
  >(functions, 'verifyEmailVerificationCode');

  const response = await verifyCode({
    email: email.trim().toLowerCase(),
    code: code.trim(),
  });

  if (!response.data.token) {
    throw new Error(
      'Email verification failed. Please request a new code.'
    );
  }

  return response.data.token;
};

// =====================================================
// STEP 3: CONSUME VERIFIED EMAIL TOKEN
// =====================================================

export const consumeEmailVerificationToken = async (
  email: string,
  token: string
): Promise<void> => {
  const consumeToken = httpsCallable<
    { email: string; token: string },
    VerificationResponse
  >(functions, 'consumeEmailVerificationToken');

  await consumeToken({
    email: email.trim().toLowerCase(),
    token: token.trim(),
  });
};
