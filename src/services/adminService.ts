import { getIdTokenResult, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { addDoc, collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../Firebase/config';

export const isAdministrator = async (user: User, forceRefresh = false): Promise<boolean> => {
  const token = await getIdTokenResult(user, forceRefresh);
  return token.claims.admin === true;
};
const activityData = (user: User, action: string, description: string) => ({
  userId: user.uid, userName: user.displayName || user.email || 'Administrator',
  userEmail: user.email || '', role: 'admin', action, description: description.slice(0, 1000),
  status: 'Success', createdAt: serverTimestamp(),
});
export const recordAdminActivity = async (action: string, description: string): Promise<void> => {
  if (!auth.currentUser) return;
  await addDoc(collection(db, 'activityLogs'), activityData(auth.currentUser, action, description));
};
export const loginAdministrator = async (email: string, password: string): Promise<User> => {
  const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  if (!(await isAdministrator(credential.user, true))) {
    await signOut(auth);
    throw Object.assign(new Error('This account does not have administrator access. Contact the project owner.'), { code: 'auth/admin-required' });
  }
  if (credential.user.emailVerified) {
    try { await recordAdminActivity('Admin login', 'Signed in to the administration portal.'); }
    catch (error) { console.warn('Unable to record admin login:', error); }
  }
  return credential.user;
};
export const logoutAdministrator = async (): Promise<void> => {
  try { await recordAdminActivity('Admin logout', 'Signed out of the administration portal.'); }
  catch (error) { console.warn('Unable to record admin logout:', error); }
  await signOut(auth);
};
export const reviewApplicationAsAdmin = async (applicationId: string, status: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in before reviewing applications.');
  if (!['Pending', 'Under Review', 'For Compliance', 'Approved', 'Rejected'].includes(status)) throw new Error('Choose a valid application status.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'applications', applicationId), {
    status, reviewedBy: user.uid, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, 'activityLogs')), activityData(user, 'Application reviewed', `Application ${applicationId}: status changed to ${status}.`));
  await batch.commit();
};
