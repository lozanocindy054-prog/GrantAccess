import { useEffect, useState } from 'react';
import { IonContent, IonPage, IonSpinner } from '@ionic/react';
import { onAuthStateChanged } from 'firebase/auth';
import { useParams } from 'react-router-dom';
import { auth } from '../../Firebase/config';
import { loadFirestoreFile } from '../../services/firestoreFileService';

const StoredFile: React.FC = () => {
  const { fileId = '' } = useParams();
  const [file, setFile] = useState<{ name: string; url: string; type: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let url = '';
    let requestId = 0;
    const unsubscribe = onAuthStateChanged(auth, () => {
      const currentRequest = ++requestId;
      setFile(null); setError('');
      if (url) { URL.revokeObjectURL(url); url = ''; }
      void loadFirestoreFile(fileId).then(result => {
        if (!active || currentRequest !== requestId) return;
        url = URL.createObjectURL(result.blob);
        setFile({ name: result.name, url, type: result.blob.type });
      }).catch(() => { if (active && currentRequest === requestId) setError('Unable to open this document. Sign in with the account that can access it, or ask the uploader for help.'); });
    });
    return () => { active = false; unsubscribe(); if (url) URL.revokeObjectURL(url); };
  }, [fileId]);
  return <IonPage><IonContent className="ion-padding">
    {error ? <p role="alert">{error}</p> : !file ? <IonSpinner /> : <>
      <h1>{file.name}</h1><p><a href={file.url} download={file.name}>Download {file.name}</a></p>
      {file.type === 'application/pdf' ? <iframe title={file.name} src={file.url} style={{ width: '100%', height: '80vh', border: 0 }} /> : file.type.startsWith('image/') ? <img src={file.url} alt={file.name} style={{ maxWidth: '100%' }} /> : <p>Download this document to open it.</p>}
    </>}
  </IonContent></IonPage>;
};
export default StoredFile;
