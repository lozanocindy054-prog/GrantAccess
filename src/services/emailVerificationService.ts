import { sendEmailVerification, type User } from 'firebase/auth';

export const sendVerificationEmail = async (user: User): Promise<void> => {
  await sendEmailVerification(user);
};

export const refreshEmailVerification = async (user: User): Promise<boolean> => {
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
};
