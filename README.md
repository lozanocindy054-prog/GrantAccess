# GrantAccess (Firebase Spark)

## Run locally

Use Node.js 22.12 or later in the Node 22 release line.

```powershell
npm ci
npm run dev
```

Open http://localhost:8100/. Firebase project configuration is in `src/Firebase/config.ts`.

## Registration and email verification

Enable **Email/Password** in Firebase Authentication. Registration creates an Auth account and saves its profile in Firestore. Firebase Authentication sends a verification link; users open that link and return to **I have verified my email**. The verification screen can resend the message if the initial send fails. No Cloud Functions, SMTP secrets, OTP backend, or Blaze upgrade is required for this flow.

Firebase Authentication's verification email quotas still apply. Use Authentication ? Templates to customize the verification email. Student and organization login send unverified users to the verification page.

## Uploaded documents and receipts

New PDFs, Word documents, and receipt images are stored as Base64 in separate `uploadedFiles` Firestore documents. Application documents are private to their uploader, receiving organization, and administrators. Organization attachments are shared with signed-in users only when their post is published publicly. Draft files stay private. Existing Drive and Cloudinary links remain readable.

Limits: **650 KB per document/receipt**, **128 KB per profile, logo, cover, or poster image**. Images are saved inline with their profile/post. Compress larger files before uploading. These limits leave room below Firestore's 1 MiB document cap after Base64 encoding. Firestore's Spark storage/read/write quotas apply; this is intended for modest document volumes.

The file viewer supports PDF/image previews and downloads. Word documents are downloaded for opening in a compatible application.

`firestore.rules` preserves the project's existing deployed rules and adds restrictive `uploadedFiles` rules. `firestore.indexes.json` excludes Base64 payloads from indexing. Deploy these with a project-authorized account:

```powershell
firebase deploy --only firestore:rules,firestore:indexes --project grand-access
```

Automatic scheduled publication requires a backend and is unavailable in this Spark setup. Save a draft and publish it manually. The `functions` directory is retained as optional legacy code; do not deploy it for the Spark workflow.

## Validate

```powershell
npm run lint
npm run test.unit
npm run build
```

Start `npm run dev` in another terminal for `npm run test.e2e`. Use `npm run test.unit.watch` for interactive unit tests. If an Electron-based host sets `ELECTRON_RUN_AS_NODE=1`, unset that variable for the Cypress process before launching its browser.

## Organization applications and student announcements

Organizations review the student details captured in each submitted application. Private `students` profiles remain restricted to their owner and administrators. A validated `organizationApplicants/{organizationId}/students/{studentId}` link grants an organization access to that applicant's online presence; it does not grant access to the student's private profile.

Organization reviews can change only status, remarks, rejection reason, reviewer identity, and review timestamps. The reviewer must be the receiving organization and timestamps use the server time.

Publishing writes one shared `studentAnnouncements/{postId}` record instead of enumerating student accounts. The notification bell merges these announcements with legacy personal notifications. Each student's read state is stored under `studentAnnouncementReads/{studentId}/items/{postId}`. Saving a published post retries announcement delivery using the same document ID.

Run the server-side permission simulations with a project-authorized account already signed into the Firebase CLI:

```powershell
node scripts/check-workflow-rules.cjs account@example.com
```

These simulations evaluate rules with mock requests and do not change production student data.

## Administrator access

Use `/admin-login` to enter the administration portal. Admin access requires the Firebase Authentication custom claim `admin: true`; account creation or a Firestore profile role does not grant it. Protected admin routes wait for authentication and claim checks before mounting data pages. Login refreshes the token so newly assigned access takes effect.

A trusted project owner can grant access to an existing verified account from a terminal after installing the optional backend SDK dependencies (`npm --prefix functions ci`). This does not deploy Cloud Functions or require Blaze:

```powershell
node scripts/grant-admin.cjs ACCOUNT_EMAIL PROJECT_OWNER_CLI_EMAIL
```

The script preserves other custom claims. Sign in again after changing access. All admin logout controls sign out of Firebase. System Settings includes account access refresh and password-reset controls. Administrator sign-ins, sign-outs, and application reviews are recorded in append-only `activityLogs`; application status and review logs commit together.

## Portal navigation and session access

Student and organization routes wait for Firebase Authentication before mounting their interfaces. Signed-out visitors go to the matching login page; verified accounts also need the matching student or organization profile. Verification screens and stored files require an authenticated session. Administrator routes retain their custom-claim checks.

The organization main menu contains Home, Manage Scholarships, Applications, and Messages. Each entire card opens a full page. Student Map is retired from the organization portal. Organization details remain in the profile dropdown, with Settings and Notifications opening dedicated pages.

Back navigation has a reserved bar, accessible touch targets, and dashboard fallbacks for direct visits. It does not return a login page to a private interface from earlier browser history.

## Automatic updates

Student accounts, organization accounts, scholarships, and application lists subscribe to Firestore changes and update without reloading the page. Dashboard totals refresh every minute while the admin dashboard is visible, and when returning to the tab.

Development uses a polling watcher for Windows. Saving React/TypeScript source files automatically reloads the current page so Ionic cached routes refresh; styles update in place through Vite. Run `npm run dev` or `ionic serve` and use `http://localhost:8100`. A static preview or deployed site does not watch local source files. Production builds include `version.json`; the app checks for a new build every 30 seconds and when the tab regains focus or connectivity. It reloads the current route automatically after pending Firestore writes complete, deferring while visible form fields contain edits, a file is selected, a camera is active, or a loading indicator is visible. Firebase Hosting revalidates cached files. These production settings take effect with the next hosting deployment.

To verify production updates locally, build the app, start `npx vite preview --host localhost --port 8101 --strictPort`, then run `npx cypress run --browser electron --spec cypress/e2e/automatic-updates.cy.ts`. The normal navigation tests use the development server on port 8100.

Organization notifications have individual and bulk mark-as-read actions. Read receipts persist in `users/{organizationId}/notifications/application_{applicationId}` under the existing owner-only rules. The LGU dashboard badge subscribes to those receipts and clears when all notifications are read. New applications appear unread automatically.

Development also checks a local revision endpoint every two seconds to recover updates when the Vite WebSocket is disconnected. The fallback waits for pending writes and active edits. Verify it with `npx cypress run --browser electron --spec cypress/e2e/hot-reload.cy.ts` while the dev server runs on port 8100.

Public administrator registration is disabled: the landing page offers only admin login, and `/admin-register` redirects to `/admin-login`. Existing administrators keep their server-issued access.

Access-check placeholders do not register as Ionic pages. Only the admitted screen registers with the outlet, so replacing a loading state cannot leave a cached placeholder as the active page. The organization navigation browser test uses isolated network stubs to click protected menu destinations and return without any document reload or production account changes.

## Install GrantAccess

The HTTPS Firebase site is an installable web app named GrantAccess, using `public/mylogo.png`. Open the landing page and choose **Install app**. Supported browsers show their native installer; on iPhone/iPad use Safari ? Share ? Add to Home Screen. The installed app opens without the browser toolbar.

The production-only service worker caches app assets and a branded offline connection page. It does not cache navigation HTML, version checks, Firebase responses, documents, or account data. Normal account features need internet access. Build IDs version the worker cache, and current HTML/version requests always use the network so automatic app updates remain effective. Development has no service worker.

App icon sizes are in `public/icons`; the generated production worker is `dist/sw.js`. Run the installability smoke tests against a production preview on port 8101 with `npx cypress run --browser electron --spec cypress/e2e/installable-app.cy.ts`, or set `PWA_URL` to the HTTPS deployment via Cypress environment options.
#   G r a n t  
 