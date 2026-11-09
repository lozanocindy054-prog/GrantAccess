const GOOGLE_IDENTITY_SCRIPT =
  'https://accounts.google.com/gsi/client';
const GOOGLE_DRIVE_SCOPE =
  'https://www.googleapis.com/auth/drive.file';
const GOOGLE_DRIVE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files';
const GOOGLE_DRIVE_API_URL =
  'https://www.googleapis.com/drive/v3/files';

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface GoogleDriveFileResponse {
  id?: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
  error?: {
    message?: string;
  };
}

interface GoogleIdentityServices {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        include_granted_scopes: boolean;
        callback: (response: GoogleTokenResponse) => void;
        error_callback: (error: { message?: string }) => void;
      }) => GoogleTokenClient;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

export interface DrivePdfUploadOptions {
  organizationId: string;
  organizationName: string;
  category: string;
  description: string;
}

export interface DrivePdfUploadResult {
  name: string;
  url: string;
  previewUrl: string;
  downloadUrl: string;
  driveFileId: string;
  mimeType: 'application/pdf';
  provider: 'google-drive';
  size: number;
  category: string;
  description: string;
  available: boolean;
  organizationId: string;
  organizationName: string;
}

let identityScriptPromise: Promise<void> | undefined;
let tokenClient: GoogleTokenClient | undefined;
let cachedAccessToken = '';
let accessTokenExpiresAt = 0;
let cachedAccessTokenOwnerId = '';
let pendingTokenRequest:
  | {
      resolve: (token: string) => void;
      reject: (error: Error) => void;
    }
  | undefined;

const getClientId = (): string => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error(
      'Google Drive is not configured. Set VITE_GOOGLE_CLIENT_ID and restart the app.',
    );
  }
  return clientId;
};

export const loadGoogleDriveIdentity = async (): Promise<void> => {
  getClientId();

  if (window.google?.accounts.oauth2) return;

  if (!identityScriptPromise) {
    identityScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${GOOGLE_IDENTITY_SCRIPT}"]`,
      );
      const script = existingScript || document.createElement('script');

      const clearLoadHandlers = () => {
        clearTimeout(timeoutId);
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onError);
      };

      const onLoad = () => {
        clearLoadHandlers();
        if (!window.google?.accounts.oauth2) {
          reject(new Error('Google Identity Services did not initialize.'));
          return;
        }
        resolve();
      };

      const onError = () => {
        clearLoadHandlers();
        reject(new Error('Unable to load Google Identity Services.'));
      };

      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      const timeoutId = setTimeout(() => {
        clearLoadHandlers();
        reject(new Error('Timed out loading Google Identity Services.'));
      }, 15_000);

      if (!existingScript) {
        script.src = GOOGLE_IDENTITY_SCRIPT;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      } else if (window.google?.accounts.oauth2) {
        onLoad();
      }
    }).catch((error: unknown) => {
      identityScriptPromise = undefined;
      throw error;
    });
  }

  await identityScriptPromise;
};

export const connectGoogleDrive = (
  organizationId: string,
): Promise<string> => {
  if (!window.google?.accounts.oauth2) {
    return Promise.reject(
      new Error('Google Drive is still loading. Please try again.'),
    );
  }
  if (!organizationId) {
    return Promise.reject(
      new Error('Sign in to your organization account first.'),
    );
  }
  if (pendingTokenRequest) {
    return Promise.reject(
      new Error('Google Drive authorization is already in progress.'),
    );
  }

  return new Promise((resolve, reject) => {
    pendingTokenRequest = { resolve, reject };

    try {
      tokenClient = window.google?.accounts.oauth2.initTokenClient({
        client_id: getClientId(),
        scope: GOOGLE_DRIVE_SCOPE,
        include_granted_scopes: true,
        callback: (response) => {
          const pending = pendingTokenRequest;
          pendingTokenRequest = undefined;

          if (response.error || !response.access_token) {
            pending?.reject(
              new Error(
                response.error_description ||
                  response.error ||
                  'Google Drive access was not granted.',
              ),
            );
            return;
          }

          cachedAccessToken = response.access_token;
          cachedAccessTokenOwnerId = organizationId;
          accessTokenExpiresAt =
            Date.now() +
            Math.max((response.expires_in || 3600) - 60, 0) * 1000;
          pending?.resolve(cachedAccessToken);
        },
        error_callback: (error) => {
          const pending = pendingTokenRequest;
          pendingTokenRequest = undefined;
          pending?.reject(
            new Error(
              error.message || 'Google Drive authorization failed.',
            ),
          );
        },
      });

      if (!tokenClient) {
        throw new Error('Google Drive authorization is unavailable.');
      }

      tokenClient.requestAccessToken({ prompt: '' });
    } catch (error) {
      pendingTokenRequest = undefined;
      reject(
        error instanceof Error
          ? error
          : new Error('Unable to authorize Google Drive access.'),
      );
    }
  });
};

export const clearGoogleDriveAccess = (): void => {
  cachedAccessToken = '';
  accessTokenExpiresAt = 0;
  cachedAccessTokenOwnerId = '';
};

const getAccessToken = async (
  organizationId: string,
): Promise<string> => {
  if (
    cachedAccessToken &&
    cachedAccessTokenOwnerId === organizationId &&
    Date.now() < accessTokenExpiresAt
  ) {
    return cachedAccessToken;
  }

  throw new Error(
    'Connect or reconnect Google Drive before uploading PDF documents.',
  );
};

const parseDriveError = async (
  response: Response,
): Promise<string> => {
  try {
    const body = (await response.json()) as GoogleDriveFileResponse;
    return body.error?.message || `Google Drive request failed (${response.status}).`;
  } catch {
    return `Google Drive request failed (${response.status}).`;
  }
};

const deleteDriveFile = async (
  fileId: string,
  accessToken: string,
): Promise<void> => {
  const response = await fetch(
    `${GOOGLE_DRIVE_API_URL}/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(await parseDriveError(response));
  }
};

export const uploadPdfToGoogleDrive = async (
  file: File,
  options: DrivePdfUploadOptions,
): Promise<DrivePdfUploadResult> => {
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files can be uploaded to Google Drive.');
  }

  const accessToken = await getAccessToken(options.organizationId);
  const boundary = `grantaccess_${crypto.randomUUID()}`;
  const metadata = {
    name: file.name,
    mimeType: 'application/pdf',
    description: [
      'Uploaded through GrantAccess.',
      `Category: ${options.category}`,
      `Organization: ${options.organizationName}`,
      options.description.trim()
        ? `Description: ${options.description.trim()}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
  const body = new Blob(
    [
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\n`,
      'Content-Type: application/pdf\r\n\r\n',
      file,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  );

  const uploadResponse = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,webViewLink,webContentLink,size`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!uploadResponse.ok) {
    throw new Error(await parseDriveError(uploadResponse));
  }

  const uploaded = (await uploadResponse.json()) as GoogleDriveFileResponse;
  if (!uploaded.id) {
    throw new Error('Google Drive uploaded the PDF without returning a file ID.');
  }

  try {
    const permissionResponse = await fetch(
      `${GOOGLE_DRIVE_API_URL}/${encodeURIComponent(uploaded.id)}/permissions?supportsAllDrives=true&fields=id`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'anyone',
          role: 'reader',
        }),
      },
    );

    if (!permissionResponse.ok) {
      throw new Error(await parseDriveError(permissionResponse));
    }
  } catch (error) {
    try {
      await deleteDriveFile(uploaded.id, accessToken);
    } catch (cleanupError) {
      console.error(
        'Unable to remove a Drive file after sharing failed:',
        cleanupError,
      );
    }
    throw error;
  }

  const driveFileId = uploaded.id;
  const previewUrl =
    `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/preview`;
  const downloadUrl =
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`;

  return {
    name: uploaded.name || file.name,
    url:
      uploaded.webViewLink ||
      `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/view`,
    previewUrl,
    downloadUrl,
    driveFileId,
    mimeType: 'application/pdf',
    provider: 'google-drive',
    size: Number(uploaded.size) || file.size,
    category: options.category,
    description: options.description.trim(),
    available: true,
    organizationId: options.organizationId,
    organizationName: options.organizationName,
  };
};
