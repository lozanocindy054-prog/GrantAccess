# Legacy Google Drive setup

New uploads now use Firestore and do not require a Google OAuth client ID. See [README.md](README.md) for the Spark workflow. These instructions apply only to the retained legacy Drive service.

# Google Drive PDF setup

LGU/School users authorize GrantAccess with Google Identity Services. GrantAccess uploads PDFs to the connected Google account, then stores the file metadata and links in Firestore. Files are shared as **Anyone with the link — Viewer** so students can preview and download them without signing in to the uploader's Google account.

## Configure Google Cloud

1. Select or create a Google Cloud project.
2. Enable the **Google Drive API**.
3. Configure the OAuth consent screen. Add the Google accounts that will test uploads as test users while the app is in testing mode.
4. Create an OAuth client ID with application type **Web application**.
5. Add the app's exact origins under **Authorized JavaScript origins**, including local development (for example, `http://localhost:8100`) and the deployed app origin. Do not include a path.
6. Copy the client ID into a local `.env.local` file in the project root:

   ```env
   VITE_GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
   ```

7. Restart the Vite development server or rebuild/redeploy the app after changing the environment variable.

The OAuth client ID is public configuration; never put a client secret in frontend code. Keep `.env.local` out of source control.

## Verify the workflow

1. Sign in as an LGU/School account and connect Google Drive.
2. Upload a PDF with its category and description, then save the scholarship or organization post.
3. Confirm the Firestore attachment includes the Drive file ID, organization details, category, preview URL, and download URL.
4. Open the student-facing scholarship or organization page and verify that Preview and Download work.

If the organization's Google Workspace administrator blocks public link sharing, Drive will reject the upload's sharing step. The app reports that error and attempts to remove the newly uploaded file.

## Privacy

Anyone who obtains a shared file link can view the PDF. Do not upload confidential, sensitive, or student-personal documents using this workflow.
