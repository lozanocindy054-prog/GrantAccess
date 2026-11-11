const path = require('node:path');
const { createRequire } = require('node:module');
const backendRequire = createRequire(path.resolve('functions/package.json'));
const cliAuth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth.js'));
const { initializeApp } = backendRequire('firebase-admin/app');
const { getAuth } = backendRequire('firebase-admin/auth');
(async () => {
  const [email, ownerEmail] = process.argv.slice(2);
  if (!email || !ownerEmail) throw new Error('Usage: node scripts/grant-admin.cjs ACCOUNT_EMAIL PROJECT_OWNER_CLI_EMAIL');
  const owner = cliAuth.getAllAccounts().find(item => item.user.email === ownerEmail);
  if (!owner) throw new Error('Sign into the project owner account with the Firebase CLI first.');
  const credential = { getAccessToken: async () => {
    const token = await cliAuth.getAccessToken(owner.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase']);
    return { access_token: token.access_token, expires_in: 3600 };
  } };
  const app = initializeApp({ projectId: 'grand-access', credential });
  const auth = getAuth(app);
  const user = await auth.getUserByEmail(email.trim().toLowerCase());
  if (user.disabled) throw new Error('The designated account is disabled.');
  if (!user.emailVerified) throw new Error('Verify the designated account email before granting admin access.');
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true });
  const updated = await auth.getUser(user.uid);
  if (updated.customClaims?.admin !== true) throw new Error('Administrator role was not applied.');
  console.log(`Administrator role verified for ${updated.email}. Sign in again to refresh the token.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
