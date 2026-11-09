import React, { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { closeOutline, downloadOutline, eyeOutline } from 'ionicons/icons';
import './StudentDocumentAccess.css';

export interface StudentDownloadableDocument {
  name: string;
  url: string;
  category?: string;
  description?: string;
  driveFileId?: string;
  previewUrl?: string;
  downloadUrl?: string;
  mimeType?: string;
  organizationName?: string;
}

interface StudentDocumentAccessProps {
  document: StudentDownloadableDocument;
}

const getDriveFileId = (
  document: StudentDownloadableDocument,
): string => {
  if (document.driveFileId) return document.driveFileId;

  try {
    const url = new URL(document.url);
    if (url.hostname !== 'drive.google.com') return '';

    const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
    return pathMatch?.[1] || url.searchParams.get('id') || '';
  } catch {
    return '';
  }
};

const getSafeHttpUrl = (value: string): string => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : '';
  } catch {
    return '';
  }
};

const StudentDocumentAccess: React.FC<StudentDocumentAccessProps> = ({
  document,
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const driveFileId = getDriveFileId(document);
  const isPdf =
    document.mimeType?.toLowerCase() === 'application/pdf' ||
    /\.pdf(?:$|[?#])/i.test(document.name) ||
    /\.pdf(?:$|[?#])/i.test(document.url);
  const fileUrl = getSafeHttpUrl(document.url);
  const previewUrl = getSafeHttpUrl(
    document.previewUrl ||
      (driveFileId
        ? `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/preview`
        : fileUrl),
  );
  const downloadUrl = getSafeHttpUrl(
    document.downloadUrl ||
      (driveFileId
        ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`
        : fileUrl),
  );

  if (!fileUrl) return null;

  return (
    <div className="student-document-access">
      <div className="student-document-copy">
        <strong>{document.name}</strong>
        {(document.category || document.organizationName) && (
          <span>
            {[document.category, document.organizationName]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
        {document.description && <small>{document.description}</small>}
      </div>

      <div className="student-document-actions">
        {isPdf && previewUrl && (
          <IonButton
            size="small"
            fill="outline"
            onClick={() => setPreviewOpen(true)}
          >
            <IonIcon icon={eyeOutline} slot="start" />
            Preview
          </IonButton>
        )}
        {downloadUrl && (
          <a
            className="student-document-download"
            href={downloadUrl}
            download={document.name}
            target={driveFileId ? '_blank' : undefined}
            rel={driveFileId ? 'noopener noreferrer' : undefined}
          >
            <IonIcon icon={downloadOutline} />
            Download
          </a>
        )}
      </div>

      <IonModal
        isOpen={previewOpen}
        onDidDismiss={() => setPreviewOpen(false)}
        className="student-document-preview-modal"
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>{document.name}</IonTitle>
            <IonButton
              slot="end"
              fill="clear"
              aria-label="Close document preview"
              onClick={() => setPreviewOpen(false)}
            >
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonToolbar>
        </IonHeader>
        <IonContent className="student-document-preview-content">
          <iframe
            className="student-document-preview-frame"
            src={previewUrl}
            title={`Preview of ${document.name}`}
            referrerPolicy="no-referrer"
          />
        </IonContent>
      </IonModal>
    </div>
  );
};

export default StudentDocumentAccess;
