import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';

import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';

import {
  businessOutline,
  schoolOutline,
  peopleOutline,
  chatbubblesOutline,
  notificationsOutline,
  settingsOutline,
  logOutOutline,
  createOutline,
  locationOutline,
  mailOutline,
  callOutline,
  calendarOutline,
  cashOutline,
  documentTextOutline,
  imageOutline,
  informationCircleOutline,
  chevronForwardOutline,
  saveOutline,
  closeCircleOutline,
  checkmarkCircleOutline,
  personCircleOutline,
  addOutline,
  cloudUploadOutline,
  downloadOutline,
  megaphoneOutline,
  trashOutline,
  eyeOutline,
} from 'ionicons/icons';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { auth, db } from '../../Firebase/config';
import {
  clearGoogleDriveAccess,
  connectGoogleDrive,
  loadGoogleDriveIdentity,
  uploadPdfToGoogleDrive,
} from '../../services/googleDriveService';
import './LGUSchoolProfile.css';

// ======================================================
// CLOUDINARY CONFIGURATION
// ======================================================

const CLOUDINARY_CLOUD_NAME = 'verlmdcg';

const PROFILE_UPLOAD_PRESET = 'grantaccess_profile';

const CLOUDINARY_UPLOAD_URL =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const MAX_REQUIRED_DOCUMENTS = 10;
const MAX_DOWNLOADABLE_DOCUMENTS = 10;

const ALLOWED_IMAGES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

// ======================================================
// STUDENT NOTIFICATION CONFIGURATION
// ======================================================

// Collection that the student home notification bell reads from.
// The student side should query:
//   where('studentId', '==', currentStudent.uid)
const STUDENT_NOTIFICATIONS_COLLECTION = 'studentNotifications';

// Firestore allows max 500 writes per batch.
const NOTIFICATION_BATCH_SIZE = 400;

// ======================================================
// TYPES
// ======================================================

interface OrgProfile {
  uid?: string;
  role?: string;
  status?: string;
  organizationName?: string;
  name?: string;
  organizationType?: string;
  organizationEmail?: string;
  email?: string;
  contactNumber?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  representativeName?: string;
  position?: string;
  description?: string;
  logoUrl?: string;
  coverPhotoUrl?: string;
}

interface UploadedFile {
  name: string;
  url: string;
  publicId?: string;
  resourceType?: string;
  format?: string;
  size: number;
  category?: string;
  description?: string;
  available?: boolean;
  mimeType?: string;
  provider?: 'google-drive' | 'cloudinary';
  driveFileId?: string;
  previewUrl?: string;
  downloadUrl?: string;
  organizationId?: string;
  organizationName?: string;
}

interface Scholarship {
  id: string;
  title?: string;
  category?: string;
  amount?: number | string;
  description?: string;
  eligibility?: string;
  applicationStart?: string;
  deadline?: string;
  contactInfo?: string;
  location?: string;
  status?: string;
  bannerUrl?: string;
  requiredDocuments?: string[];
  attachments?: UploadedFile[];
  organizationId?: string;
  organizationName?: string;
  organizationLogo?: string;
  applicationStatus?: "open" | "closed" | "upcoming";
  benefits?: string;
  applicationMethod?: string;
  externalApplicationUrl?: string;
  requireEligibilityAssessment?: boolean;
  requireDocumentSubmission?: boolean;
  allowOptionalDocuments?: boolean;
  allowEditSubmittedApplication?: boolean;
  viewCount?: number;
  reactionCount?: number;
  commentCount?: number;
  shareCount?: number;
  createdAt?: Timestamp | Date | string | null;
  updatedAt?: Timestamp | Date | string | null;
}

interface OrganizationPost {
  id: string;
  title?: string;
  category?: string;
  description?: string;
  status?: string;
  imageUrl?: string;
  attachments?: UploadedFile[];
  organizationId?: string;
  organizationName?: string;
  organizationType?: string;
  visibility?: 'public' | 'students';
  scheduledAt?: Timestamp | Date | string | null;
  isPinned?: boolean;
  allowComments?: boolean;
  allowReactions?: boolean;
  scholarshipId?: string;
  benefits?: string;
  applicationStatus?: 'open' | 'closed' | 'upcoming';
  applicationMethod?: string;
  externalApplicationUrl?: string;
  requireEligibilityAssessment?: boolean;
  requireDocumentSubmission?: boolean;
  allowOptionalDocuments?: boolean;
  allowEditSubmittedApplication?: boolean;
  viewCount?: number;
  reactionCount?: number;
  commentCount?: number;
  shareCount?: number;
  createdAt?: Timestamp | Date | string | null;
  updatedAt?: Timestamp | Date | string | null;
}

type TabName = 'Posts' | 'Scholarships' | 'About';

type PostType =
  | 'General Announcement'
  | 'Scholarship Announcement'
  | 'Scholarship Update'
  | 'Document Sharing'
  | 'Events and Activities'
  | 'Important Reminders'
  | 'News and Updates';

interface EditForm {
  organizationName: string;
  organizationType: string;
  email: string;
  contactNumber: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  representativeName: string;
  description: string;
  logoUrl: string;
  coverPhotoUrl: string;
}

interface PostForm {
  title: string;
  category: PostType;
  description: string;
  amount: string;
  eligibility: string;
  requiredDocuments: string;
  applicationStart: string;
  deadline: string;
  contactInfo: string;
  location: string;
  benefits: string;
  applicationStatus: 'open' | 'closed' | 'upcoming';
  applicationMethod: 'step-by-step' | 'direct' | 'external';
  externalApplicationUrl: string;
  requireEligibilityAssessment: boolean;
  requireDocumentSubmission: boolean;
  allowOptionalDocuments: boolean;
  allowEditSubmittedApplication: boolean;
  visibility: 'public' | 'students';
  scheduledAt: string;
  isPinned: boolean;
  allowComments: boolean;
  allowReactions: boolean;
}

interface DocumentFileSelection {
  file: File;
  category: string;
  description: string;
  available: boolean;
}

interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  resource_type: string;
  format?: string;
}

interface StudentNotificationPayload {
  organizationId: string;
  organizationName: string;
  organizationLogo: string;
  title: string;
  message: string;
  type: 'scholarship' | 'announcement';
  scholarshipId: string;
  postId: string;
  scholarshipTitle: string;
  amount: string;
  deadline: string;
  imageUrl: string;
}

// ======================================================
// DEFAULT VALUES
// ======================================================

const DEFAULT_LOGO =
  'https://placehold.co/160x160/e7f4ed/24783b?text=LOGO';

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=85';

const DEFAULT_BANNER =
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=85';

const initialForm: EditForm = {
  organizationName: '',
  organizationType: '',
  email: '',
  contactNumber: '',
  address: '',
  latitude: null,
  longitude: null,
  representativeName: '',
  description: '',
  logoUrl: '',
  coverPhotoUrl: '',
};

const initialPostForm: PostForm = {
  title: '',
  category: 'General Announcement',
  description: '',
  amount: '',
  eligibility: '',
  requiredDocuments: '',
  applicationStart: '',
  deadline: '',
  contactInfo: '',
  location: '',
  benefits: '',
  applicationStatus: 'open',
  applicationMethod: 'step-by-step',
  externalApplicationUrl: '',
  requireEligibilityAssessment: false,
  requireDocumentSubmission: true,
  allowOptionalDocuments: false,
  allowEditSubmittedApplication: false,
  visibility: 'public',
  scheduledAt: '',
  isPinned: false,
  allowComments: true,
  allowReactions: true,
};

const getRequiredDocumentNames = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

// ======================================================
// HELPER FUNCTIONS
// ======================================================

const uploadToCloudinary = async (
  file: File,
  preset: string
): Promise<UploadedFile> => {
  const formData = new FormData();

  formData.append('file', file);
  formData.append('upload_preset', preset);

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message || 'Cloudinary upload failed.'
    );
  }

  const uploaded = result as CloudinaryResponse;

  if (!uploaded.secure_url || !uploaded.public_id) {
    throw new Error('Cloudinary returned an incomplete upload response.');
  }

  return {
    name: file.name,
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    resourceType: uploaded.resource_type || 'raw',
    format: uploaded.format || '',
    size: file.size,
  };
};

const getTimestamp = (
  value?: Timestamp | Date | string | null
): number => {
  if (!value) return 0;

  if (
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  ) {
    return value.toMillis();
  }

  if (
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return value.toDate().getTime();
  }

  const date = new Date(value as string | Date);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const formatDate = (
  value?: Timestamp | Date | string | null
): string => {
  if (!value) return 'Recently added';

  const timestamp = getTimestamp(value);

  if (!timestamp) return 'Recently added';

  return new Date(timestamp).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatAmount = (amount?: number | string): string => {
  if (amount === undefined || amount === null || amount === '') {
    return 'Not specified';
  }

  const value = Number(amount);

  if (!Number.isFinite(value)) return String(amount);

  return `₱${value.toLocaleString('en-PH')}`;
};

const getViewCount = (value?: number): number => {
  const count = Number(value ?? 0);

  return Number.isFinite(count) && count > 0
    ? Math.floor(count)
    : 0;
};

const isPublished = (status?: string): boolean =>
  String(status || '').toLowerCase() === 'published';

// ======================================================
// STUDENT NOTIFICATION HELPERS
// ======================================================

/**
 * Collects the UID of every student account.
 * 1) Reads the "students" collection (document id = student uid).
 * 2) If that collection is empty, falls back to "users" with role == "student".
 */
const getAllStudentIds = async (): Promise<string[]> => {
  const ids = new Set<string>();

  const studentsSnapshot = await getDocs(collection(db, 'students'));
  studentsSnapshot.docs.forEach((student) => ids.add(student.id));

  if (ids.size === 0) {
    try {
      const usersSnapshot = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'student'))
      );
      usersSnapshot.docs.forEach((student) => ids.add(student.id));
    } catch (fallbackError) {
      console.warn('Fallback student lookup (users) failed:', fallbackError);
    }
  }

  return Array.from(ids);
};

/**
 * Creates one notification document per student so the notification
 * bell on the student home page can show it (and mark it as read per student).
 * Returns how many notifications were created.
 */
const sendNotificationsToAllStudents = async (
  payload: StudentNotificationPayload
): Promise<number> => {
  const studentIds = await getAllStudentIds();

  for (let offset = 0; offset < studentIds.length; offset += NOTIFICATION_BATCH_SIZE) {
    const batch = writeBatch(db);

    studentIds
      .slice(offset, offset + NOTIFICATION_BATCH_SIZE)
      .forEach((studentId) => {
        const notificationRef = doc(
          collection(db, STUDENT_NOTIFICATIONS_COLLECTION)
        );

        batch.set(notificationRef, {
          studentId,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          organizationId: payload.organizationId,
          organizationName: payload.organizationName,
          organizationLogo: payload.organizationLogo,
          scholarshipId: payload.scholarshipId,
          scholarshipTitle: payload.scholarshipTitle,
          amount: payload.amount,
          deadline: payload.deadline,
          imageUrl: payload.imageUrl,
          postId: payload.postId,
          isRead: false,
          read: false,
          createdAt: serverTimestamp(),
        });
      });

    await batch.commit();
  }

  return studentIds.length;
};

// ======================================================
// MAIN COMPONENT
// ======================================================

interface LGUSchoolProfileProps {
  openLocationEditor?: boolean;
  onLocationEditorOpened?: () => void;
}

const LGUSchoolProfile: React.FC<LGUSchoolProfileProps> = ({
  openLocationEditor = false,
  onLocationEditorOpened,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const organizationLocationMapContainerRef =
    useRef<HTMLDivElement | null>(null);
  const organizationLocationMapRef = useRef<L.Map | null>(null);
  const organizationLocationMarkerRef = useRef<L.CircleMarker | null>(null);

  const [user, setUser] = useState<User | null>(null);

  const [profile, setProfile] = useState<OrgProfile>({});
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [organizationPosts, setOrganizationPosts] =
    useState<OrganizationPost[]>([]);
  const [applicationCounts, setApplicationCounts] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [activeTab, setActiveTab] = useState<TabName>('Posts');

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState('');
  const [editingScholarshipId, setEditingScholarshipId] = useState('');

  const [form, setForm] = useState<EditForm>(initialForm);
  const [locationMapStatus, setLocationMapStatus] = useState('');
  const [findingAddress, setFindingAddress] = useState(false);
  const [postForm, setPostForm] = useState<PostForm>(initialPostForm);
  const organizationCoordinatesRef = useRef({
    latitude: form.latitude,
    longitude: form.longitude,
  });
  organizationCoordinatesRef.current = {
    latitude: form.latitude,
    longitude: form.longitude,
  };

  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [existingPosterUrl, setExistingPosterUrl] = useState('');
  const [existingDocuments, setExistingDocuments] = useState<UploadedFile[]>([]);
  const [documentFiles, setDocumentFiles] = useState<DocumentFileSelection[]>([]);

  const [toast, setToast] = useState({
    open: false,
    message: '',
    color: 'success' as 'success' | 'danger' | 'warning',
  });
  const [driveReady, setDriveReady] = useState(false);
  const [driveConnectedFor, setDriveConnectedFor] = useState('');
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveSetupMessage, setDriveSetupMessage] = useState('');
  const driveConnected = Boolean(user?.uid && driveConnectedFor === user.uid);

  const organizationName =
    profile.organizationName || profile.name || 'Your Organization';

  const logo = profile.logoUrl || DEFAULT_LOGO;
  const cover = profile.coverPhotoUrl || DEFAULT_COVER;

  // ------------------------------------------------------
  // FILTERED CONTENT
  // ------------------------------------------------------

  const publishedScholarships = useMemo(
    () => scholarships.filter((item) => isPublished(item.status)),
    [scholarships]
  );

  const draftScholarships = useMemo(
    () => scholarships.filter((item) => String(item.status).toLowerCase() === 'draft'),
    [scholarships]
  );

  const scheduledScholarships = useMemo(
    () => scholarships.filter((item) => String(item.status).toLowerCase() === 'scheduled'),
    [scholarships]
  );

  const publishedPosts = useMemo(
    () => organizationPosts.filter((item) => isPublished(item.status)),
    [organizationPosts]
  );

  const draftPosts = useMemo(
    () => organizationPosts.filter((item) => String(item.status).toLowerCase() === 'draft'),
    [organizationPosts]
  );

  const scheduledPosts = useMemo(
    () => organizationPosts.filter((item) => String(item.status).toLowerCase() === 'scheduled'),
    [organizationPosts]
  );

  const totalPublishedViews = useMemo(() => {
    const scholarshipViews = publishedScholarships.reduce(
      (total, item) => total + getViewCount(item.viewCount),
      0
    );

    const postViews = publishedPosts.reduce(
      (total, item) => total + getViewCount(item.viewCount),
      0
    );

    return scholarshipViews + postViews;
  }, [publishedScholarships, publishedPosts]);

  const totalDrafts = draftScholarships.length + draftPosts.length;
  const totalScheduled = scheduledScholarships.length + scheduledPosts.length;

  const totalPublishedContent =
    publishedScholarships.length + publishedPosts.length;

  const posterPreviewUrl = useMemo(
    () => (posterFile ? URL.createObjectURL(posterFile) : existingPosterUrl),
    [existingPosterUrl, posterFile]
  );

  useEffect(
    () => () => {
      if (posterPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(posterPreviewUrl);
      }
    },
    [posterPreviewUrl]
  );

  // ------------------------------------------------------
  // NOTIFICATION
  // ------------------------------------------------------

  const notify = (
    message: string,
    color: 'success' | 'danger' | 'warning' = 'success'
  ) => {
    setToast({
      open: true,
      message,
      color,
    });
  };

  useEffect(() => {
    let active = true;

    void loadGoogleDriveIdentity()
      .then(() => {
        if (active) {
          setDriveReady(true);
          setDriveSetupMessage('');
        }
      })
      .catch((error: unknown) => {
        if (!active) return;

        setDriveSetupMessage(
          error instanceof Error
            ? error.message
            : 'Google Drive could not be initialized.'
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const handleConnectGoogleDrive = () => {
    if (!driveReady || driveConnecting || !user) return;

    const organizationId = user.uid;
    setDriveConnecting(true);
    void connectGoogleDrive(organizationId)
      .then(() => {
        if (auth.currentUser?.uid === organizationId) {
          setDriveConnectedFor(organizationId);
        }
        notify(
          'Google Drive connected. Uploaded PDFs will be available to anyone with their link.'
        );
      })
      .catch((error: unknown) => {
        setDriveConnectedFor('');
        notify(
          error instanceof Error
            ? error.message
            : 'Unable to connect Google Drive.',
          'danger'
        );
      })
      .finally(() => setDriveConnecting(false));
  };

  // ------------------------------------------------------
  // FIREBASE AUTH AND REAL-TIME LISTENERS
  // ------------------------------------------------------

  useEffect(() => {
    let unsubscribeOrganization: (() => void) | undefined;
    let unsubscribeScholarships: (() => void) | undefined;
    let unsubscribePosts: (() => void) | undefined;
    let unsubscribeApplications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      unsubscribeOrganization?.();
      unsubscribeScholarships?.();
      unsubscribePosts?.();
      unsubscribeApplications?.();

      unsubscribeOrganization = undefined;
      unsubscribeScholarships = undefined;
      unsubscribePosts = undefined;
      unsubscribeApplications = undefined;

      if (!currentUser) {
        clearGoogleDriveAccess();
        setDriveConnectedFor('');
        setProfile({});
        setScholarships([]);
        setOrganizationPosts([]);
        setApplicationCounts({});
        setLoading(false);
        navigate('/lgu-login');
        return;
      }

      setLoading(true);

      // ORGANIZATION PROFILE
      unsubscribeOrganization = onSnapshot(
        doc(db, 'organizations', currentUser.uid),
        (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as OrgProfile);
          } else {
            setProfile({});
            notify(
              'Organization profile was not found. Please complete your profile.',
              'warning'
            );
          }
        },
        (error) => {
          console.error('Organization loading error:', error);
          notify(
            `Unable to load organization information: ${error.message}`,
            'danger'
          );
        }
      );

      // SCHOLARSHIPS
      const scholarshipQuery = query(
        collection(db, 'scholarships'),
        where('organizationId', '==', currentUser.uid)
      );

      unsubscribeScholarships = onSnapshot(
        scholarshipQuery,
        (snapshot) => {
          const rows = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
            applicationStatus:
              ["open", "closed", "upcoming"].includes(
                String(item.data().applicationStatus || "open").toLowerCase()
              )
                ? String(item.data().applicationStatus || "open").toLowerCase()
                : "open",
          })) as Scholarship[];

          rows.sort(
            (a, b) =>
              getTimestamp(b.createdAt) - getTimestamp(a.createdAt)
          );

          setScholarships(rows);
          setLoading(false);
        },
        (error) => {
          console.error('Scholarship loading error:', error);
          setLoading(false);
          notify(
            `Unable to load scholarships: ${error.message}`,
            'danger'
          );
        }
      );

      // ORGANIZATION POSTS
      const postsQuery = query(
        collection(db, 'organizationPosts'),
        where('organizationId', '==', currentUser.uid)
      );

      unsubscribePosts = onSnapshot(
        postsQuery,
        (snapshot) => {
          const rows = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as OrganizationPost[];

          rows.sort(
            (a, b) =>
              getTimestamp(b.createdAt) - getTimestamp(a.createdAt)
          );

          setOrganizationPosts(rows);
        },
        (error) => {
          console.error('Organization posts loading error:', error);
          notify(
            `Unable to load organization posts: ${error.message}`,
            'danger'
          );
        }
      );

      // APPLICATION COUNTS (separate listener, not nested inside posts)
      unsubscribeApplications = onSnapshot(
        query(
          collection(db, 'applications'),
          where('organizationId', '==', currentUser.uid)
        ),
        (snapshot) => {
          const counts: Record<string, number> = {};
          snapshot.docs.forEach((application) => {
            const scholarshipId = String(application.data().scholarshipId || '');
            if (scholarshipId) {
              counts[scholarshipId] = (counts[scholarshipId] || 0) + 1;
            }
          });
          setApplicationCounts(counts);
        },
        (error) => {
          console.error('Application analytics loading error:', error);
          notify('Unable to load application analytics.', 'warning');
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeOrganization?.();
      unsubscribeScholarships?.();
      unsubscribePosts?.();
      unsubscribeApplications?.();
    };
  }, [navigate]);

  useEffect(() => {
    if (
      !user ||
      new URLSearchParams(location.search).get('createScholarship') !== '1'
    ) {
      return;
    }

    setPostForm({
      ...initialPostForm,
      category: 'Scholarship Announcement',
    });
    setPosterFile(null);
    setDocumentFiles([]);
    setPostModalOpen(true);
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate, user]);

  // ------------------------------------------------------
  // SYNC PROFILE TO FORM
  // ------------------------------------------------------

  useEffect(() => {
    setForm({
      organizationName: profile.organizationName || profile.name || '',
      organizationType: profile.organizationType || '',
      email:
        profile.organizationEmail ||
        profile.email ||
        user?.email ||
        '',
      contactNumber: profile.contactNumber || '',
      address: profile.address || '',
      latitude: profile.latitude ?? profile.lat ?? null,
      longitude: profile.longitude ?? profile.lng ?? null,
      representativeName: profile.representativeName || '',
      description: profile.description || '',
      logoUrl: profile.logoUrl || '',
      coverPhotoUrl: profile.coverPhotoUrl || '',
    });
  }, [profile, user?.email]);

  useEffect(() => {
    if (!editOpen || !organizationLocationMapContainerRef.current) return;

    const map = L.map(organizationLocationMapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    });
    const { latitude, longitude } = organizationCoordinatesRef.current;
    const hasSavedCoordinates =
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);

    map.setView(
      hasSavedCoordinates
        ? [latitude, longitude]
        : [12.8797, 121.774],
      hasSavedCoordinates ? 15 : 5
    );

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; <a href="https://www.esri.com/">Esri</a> | Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, and the GIS User Community',
        maxZoom: 19,
      }
    ).addTo(map);

    organizationLocationMapRef.current = map;

    const placeMarker = (nextLatitude: number, nextLongitude: number) => {
      organizationLocationMarkerRef.current?.remove();
      organizationLocationMarkerRef.current = L.circleMarker(
        [nextLatitude, nextLongitude],
        {
          radius: 10,
          color: '#ffffff',
          weight: 3,
          fillColor: '#24783b',
          fillOpacity: 1,
        }
      )
        .addTo(map)
        .bindPopup('Organization map pin')
        .openPopup();
    };

    if (hasSavedCoordinates) {
      placeMarker(latitude, longitude);
      setLocationMapStatus('Saved organization pin is shown.');
    } else {
      setLocationMapStatus(
        'Search your address or tap the map to set the organization pin.'
      );
    }

    map.on('click', (event: L.LeafletMouseEvent) => {
      const nextLatitude = Number(event.latlng.lat.toFixed(6));
      const nextLongitude = Number(event.latlng.lng.toFixed(6));
      setForm((current) => ({
        ...current,
        latitude: nextLatitude,
        longitude: nextLongitude,
      }));
      setLocationMapStatus('Map pin selected. Save changes to publish it.');
    });

    const frame = window.requestAnimationFrame(() =>
      map.invalidateSize({ animate: false })
    );
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            if (
              organizationLocationMapRef.current === map &&
              organizationLocationMapContainerRef.current?.isConnected &&
              map.getPane('mapPane')
            ) {
              map.invalidateSize({ animate: false });
            }
          });
    resizeObserver?.observe(organizationLocationMapContainerRef.current);
    const resizeTimeout = window.setTimeout(
      () => {
        if (
          organizationLocationMapRef.current === map &&
          map.getPane('mapPane')
        ) {
          map.invalidateSize({ animate: false });
        }
      },
      300
    );

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(resizeTimeout);
      resizeObserver?.disconnect();
      organizationLocationMarkerRef.current = null;
      organizationLocationMapRef.current = null;
      map.remove();
    };
  }, [editOpen]);

  useEffect(() => {
    const map = organizationLocationMapRef.current;
    const latitude = form.latitude;
    const longitude = form.longitude;

    if (!map) return;

    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      organizationLocationMarkerRef.current?.remove();
      organizationLocationMarkerRef.current = null;
      map.setView([12.8797, 121.774], 5);
      return;
    }

    organizationLocationMarkerRef.current?.remove();
    organizationLocationMarkerRef.current = L.circleMarker(
      [latitude, longitude],
      {
        radius: 10,
        color: '#ffffff',
        weight: 3,
        fillColor: '#24783b',
        fillOpacity: 1,
      }
    )
      .addTo(map)
      .bindPopup('Organization map pin')
      .openPopup();
    map.panTo([latitude, longitude]);
  }, [form.latitude, form.longitude]);

  const updateForm = (key: keyof EditForm, value: string) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const updateOrganizationAddress = (address: string) => {
    setForm((previous) => ({
      ...previous,
      address,
      latitude: null,
      longitude: null,
    }));
    setLocationMapStatus(
      'Address changed. Search it again or tap the map to set the updated pin.'
    );
  };

  const findOrganizationAddressOnMap = async () => {
    const address = form.address.trim();

    if (!address) {
      setLocationMapStatus('Enter the organization address first.');
      return;
    }

    setFindingAddress(true);
    setLocationMapStatus('Finding the address on the map...');

    try {
      // Search the address only. Adding the organization name can make
      // Nominatim return no result when the organization is not indexed.
      const searchQuery = `${address}, Philippines`;
      const searchUrl = new URL(
        'https://nominatim.openstreetmap.org/search'
      );
      searchUrl.searchParams.set('format', 'jsonv2');
      searchUrl.searchParams.set('q', searchQuery);
      searchUrl.searchParams.set('limit', '1');
      searchUrl.searchParams.set('countrycodes', 'ph');
      searchUrl.searchParams.set('addressdetails', '1');

      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Address lookup failed with status ${response.status}.`
        );
      }

      const results = (await response.json()) as Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
      }>;

      const firstResult = results[0];
      const latitude = Number(firstResult?.lat);
      const longitude = Number(firstResult?.lon);

      if (
        !firstResult ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        setLocationMapStatus(
          'Address not found. You can still tap the map to manually set your organization pin.'
        );
        return;
      }

      setForm((previous) => ({
        ...previous,
        latitude,
        longitude,
      }));

      setLocationMapStatus(
        'Address found! Review the map pin and save your changes.'
      );
    } catch (error) {
      console.error('Unable to find organization address on map:', error);
      setLocationMapStatus(
        'Address search is temporarily unavailable. You can still tap the map to set your pin.'
      );
    } finally {
      setFindingAddress(false);
    }
  };

  const updatePostForm = <Key extends keyof PostForm>(
    key: Key,
    value: PostForm[Key]
  ) => {
    if (key === 'requiredDocuments' && typeof value === 'string') {
      const requiredDocuments = getRequiredDocumentNames(value);
      if (requiredDocuments.length > MAX_REQUIRED_DOCUMENTS) {
        notify(
          `You can add up to ${MAX_REQUIRED_DOCUMENTS} required documents.`,
          'warning'
        );
        setPostForm((previous) => ({
          ...previous,
          requiredDocuments: requiredDocuments
            .slice(0, MAX_REQUIRED_DOCUMENTS)
            .join('\n'),
        }));
        return;
      }
    }

    setPostForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const go = (path: string) => {
    setProfileMenuOpen(false);
    navigate(path);
  };

  // ------------------------------------------------------
  // FILE VALIDATION
  // ------------------------------------------------------

  const validateImage = (file: File): boolean => {
    if (!ALLOWED_IMAGES.includes(file.type)) {
      notify('Please select a JPG, PNG, or WEBP image.', 'warning');
      return false;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      notify('Image size must not exceed 5 MB.', 'warning');
      return false;
    }

    return true;
  };

  const validateDocument = (file: File): boolean => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension !== 'pdf' || file.type !== 'application/pdf') {
      notify(
        `${file.name}: Only PDF files can be uploaded to Google Drive.`,
        'warning'
      );
      return false;
    }

    if (file.size > MAX_DOCUMENT_SIZE) {
      notify(`${file.name} exceeds the 10 MB file limit.`, 'warning');
      return false;
    }

    return true;
  };

  // ------------------------------------------------------
  // PROFILE IMAGE UPLOAD
  // ------------------------------------------------------

  const uploadProfileImage = async (
    event: ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'coverPhotoUrl'
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!validateImage(file)) {
      event.target.value = '';
      return;
    }

    setUploading(true);

    try {
      const uploaded = await uploadToCloudinary(
        file,
        PROFILE_UPLOAD_PRESET
      );

      updateForm(field, uploaded.url);

      notify(
        field === 'logoUrl'
          ? 'Organization logo uploaded successfully.'
          : 'Cover photo uploaded successfully.'
      );
    } catch (error) {
      console.error('Profile image upload error:', error);

      notify(
        error instanceof Error
          ? error.message
          : 'Unable to upload image. Please check Cloudinary settings.',
        'danger'
      );
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  // ------------------------------------------------------
  // EDIT PROFILE
  // ------------------------------------------------------

  const openEditProfile = () => {
    if (!user) {
      notify('Please log in again.', 'warning');
      return;
    }

    setForm({
      organizationName: profile.organizationName || profile.name || '',
      organizationType: profile.organizationType || '',
      email:
        profile.organizationEmail ||
        profile.email ||
        user.email ||
        '',
      contactNumber: profile.contactNumber || '',
      address: profile.address || '',
      latitude: profile.latitude ?? profile.lat ?? null,
      longitude: profile.longitude ?? profile.lng ?? null,
      representativeName: profile.representativeName || '',
      description: profile.description || '',
      logoUrl: profile.logoUrl || '',
      coverPhotoUrl: profile.coverPhotoUrl || '',
    });

    setProfileMenuOpen(false);
    setEditOpen(true);
  };

  useEffect(() => {
    if (!openLocationEditor || !user) return;

    setForm({
      organizationName: profile.organizationName || profile.name || '',
      organizationType: profile.organizationType || '',
      email:
        profile.organizationEmail ||
        profile.email ||
        user.email ||
        '',
      contactNumber: profile.contactNumber || '',
      address: profile.address || '',
      latitude: profile.latitude ?? profile.lat ?? null,
      longitude: profile.longitude ?? profile.lng ?? null,
      representativeName: profile.representativeName || '',
      description: profile.description || '',
      logoUrl: profile.logoUrl || '',
      coverPhotoUrl: profile.coverPhotoUrl || '',
    });
    setProfileMenuOpen(false);
    setEditOpen(true);
    onLocationEditorOpened?.();
  }, [openLocationEditor, onLocationEditorOpened, profile, user]);

  // ------------------------------------------------------
  // SAVE PROFILE
  // ------------------------------------------------------

  const saveProfile = async () => {
    if (!user) {
      notify('Please log in again.', 'warning');
      return;
    }

    if (!form.organizationName.trim()) {
      notify('Organization name is required.', 'warning');
      return;
    }

    if (!['LGU', 'School'].includes(form.organizationType)) {
      notify('Please select LGU or School as organization type.', 'warning');
      return;
    }

    if (
      typeof form.latitude !== 'number' ||
      typeof form.longitude !== 'number' ||
      !Number.isFinite(form.latitude) ||
      !Number.isFinite(form.longitude) ||
      form.latitude < -90 ||
      form.latitude > 90 ||
      form.longitude < -180 ||
      form.longitude > 180
    ) {
      notify(
        'Please set the organization map pin so students can find your location.',
        'warning'
      );
      setLocationMapStatus(
        'A valid map pin is required. Search your address or tap the map, then save changes.'
      );
      return;
    }

    if (
      form.contactNumber.trim() &&
      !/^[0-9+\-\s()]{7,20}$/.test(form.contactNumber.trim())
    ) {
      notify('Please enter a valid contact number.', 'warning');
      return;
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      notify('Please enter a valid email address.', 'warning');
      return;
    }

    setSaving(true);

    try {
      await setDoc(
        doc(db, 'organizations', user.uid),
        {
          uid: user.uid,
          organizationName: form.organizationName.trim(),
          name: form.organizationName.trim(),
          organizationType: form.organizationType,
          organizationEmail: form.email.trim(),
          email: form.email.trim(),
          contactNumber: form.contactNumber.trim(),
          address: form.address.trim(),
          latitude: form.latitude,
          longitude: form.longitude,
          representativeName: form.representativeName.trim(),
          description: form.description.trim(),
          logoUrl: form.logoUrl.trim(),
          coverPhotoUrl: form.coverPhotoUrl.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setEditOpen(false);
      notify('Organization profile updated successfully!');
    } catch (error) {
      console.error('Profile update error:', error);

      notify(
        error instanceof Error
          ? `Unable to update profile: ${error.message}`
          : 'Unable to update organization profile.',
        'danger'
      );
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------
  // CREATE CONTENT MODALS
  // ------------------------------------------------------

  const resetPostForm = () => {
    setPostForm(initialPostForm);
    setPosterFile(null);
    setExistingPosterUrl('');
    setExistingDocuments([]);
    setDocumentFiles([]);
    setEditingPostId('');
    setEditingScholarshipId('');
  };

  const openCreatePost = () => {
    if (!user) {
      notify('Please log in again.', 'warning');
      return;
    }

    resetPostForm();
    setPostModalOpen(true);
  };

  const openCreateScholarship = () => {
    if (!user) {
      notify('Please log in again.', 'warning');
      return;
    }

    resetPostForm();

    setPostForm({
      ...initialPostForm,
      category: 'Scholarship Announcement',
    });

    setPostModalOpen(true);
  };

  const openEditContent = (
    item: OrganizationPost | Scholarship,
    scholarshipItem?: Scholarship
  ) => {
    const itemPost = 'scholarshipId' in item ? item as OrganizationPost : undefined;
    const scholarship =
      scholarshipItem ||
      ('requiredDocuments' in item ? item as Scholarship : undefined) ||
      (itemPost?.scholarshipId
        ? scholarships.find((candidate) => candidate.id === itemPost.scholarshipId)
        : undefined);
    const post = scholarship
      ? organizationPosts.find((candidate) => candidate.scholarshipId === scholarship.id)
      : itemPost;
    const source = (post || scholarship || item) as OrganizationPost & Scholarship;
    const documentList = source.attachments || scholarship?.attachments || [];
    const scheduledTimestamp = getTimestamp(source.scheduledAt);
    const scheduledDate = scheduledTimestamp
      ? new Date(scheduledTimestamp - new Date(scheduledTimestamp).getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : '';

    setEditingPostId(post?.id || '');
    setEditingScholarshipId(scholarship?.id || '');
    setExistingPosterUrl(
      source.imageUrl ||
      scholarship?.bannerUrl ||
      ''
    );
    setExistingDocuments(documentList);
    setDocumentFiles([]);
    setPosterFile(null);
    setPostForm({
      ...initialPostForm,
      title: source.title || '',
      category: (source.category || 'General Announcement') as PostType,
      description: source.description || '',
      amount: String(scholarship?.amount ?? source.amount ?? ''),
      eligibility: scholarship?.eligibility || source.eligibility || '',
      requiredDocuments: (scholarship?.requiredDocuments || source.requiredDocuments || []).join('\n'),
      applicationStart: scholarship?.applicationStart || source.applicationStart || '',
      deadline: scholarship?.deadline || source.deadline || '',
      contactInfo: scholarship?.contactInfo || '',
      location: scholarship?.location || source.location || '',
      benefits: scholarship?.benefits || source.benefits || '',
      applicationStatus:
      ['open', 'closed', 'upcoming'].includes(
        String(scholarship?.applicationStatus || source.applicationStatus || 'open')
      )
        ? String(scholarship?.applicationStatus || source.applicationStatus || 'open') as PostForm['applicationStatus']
        : 'open',
      applicationMethod:
      ['direct', 'external', 'step-by-step'].includes(
        String(scholarship?.applicationMethod || source.applicationMethod || 'step-by-step')
      )
        ? String(scholarship?.applicationMethod || source.applicationMethod || 'step-by-step') as PostForm['applicationMethod']
        : 'step-by-step',
      externalApplicationUrl:
        scholarship?.externalApplicationUrl ||
        source.externalApplicationUrl ||
        '',
      requireEligibilityAssessment:
        scholarship?.requireEligibilityAssessment ??
        source.requireEligibilityAssessment === true,
      requireDocumentSubmission:
        scholarship?.requireDocumentSubmission ??
        source.requireDocumentSubmission !== false,
      allowOptionalDocuments:
        scholarship?.allowOptionalDocuments ??
        source.allowOptionalDocuments === true,
      allowEditSubmittedApplication:
        scholarship?.allowEditSubmittedApplication ??
        source.allowEditSubmittedApplication === true,
      visibility: source.visibility || 'public',
      scheduledAt: scheduledDate,
      isPinned: source.isPinned === true,
      allowComments: source.allowComments !== false,
      allowReactions: source.allowReactions !== false,
    });
    setPostModalOpen(true);
  };

  // ------------------------------------------------------
  // POSTER SELECTION
  // ------------------------------------------------------

  const handlePosterChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (validateImage(file)) {
      setPosterFile(file);
    }

    event.target.value = '';
  };

  // ------------------------------------------------------
  // DOCUMENT SELECTION
  // ------------------------------------------------------

  const handleDocumentsChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const validFiles = files.filter(validateDocument);
    const existingKeys = new Set(
      documentFiles.map(({ file }) => `${file.name}:${file.size}`)
    );
    const uniqueFiles = validFiles.filter((file, index, candidates) => {
      const key = `${file.name}:${file.size}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return candidates.findIndex(
        (candidate) =>
          candidate.name === file.name && candidate.size === file.size
      ) === index;
    });
    const remainingSlots = Math.max(
      MAX_DOWNLOADABLE_DOCUMENTS - existingDocuments.length - documentFiles.length,
      0
    );
    if (uniqueFiles.length > remainingSlots) {
      notify(
        `You can attach up to ${MAX_DOWNLOADABLE_DOCUMENTS} downloadable documents.`,
        'warning'
      );
    }

    setDocumentFiles((previous) => [
      ...previous,
      ...uniqueFiles.slice(0, remainingSlots).map((file) => ({
        file,
        category: 'Other Supporting Documents',
        description: '',
        available: true,
      })),
    ]);

    event.target.value = '';
  };

  const removeDocument = (index: number) => {
    setDocumentFiles((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const updateDocument = (
    index: number,
    field: keyof Omit<DocumentFileSelection, 'file'>,
    value: string | boolean
  ) => {
    setDocumentFiles((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  // ------------------------------------------------------
  // CREATE SCHOLARSHIP OR ANNOUNCEMENT
  // ------------------------------------------------------

  const submitPost = async (
    status: 'draft' | 'published' | 'scheduled'
  ) => {
    if (!user) {
      notify('Please log in again.', 'warning');
      return;
    }

    if (!postForm.title.trim()) {
      notify('Please enter a post title.', 'warning');
      return;
    }

    if (postForm.title.trim().length < 3) {
      notify('The title must contain at least 3 characters.', 'warning');
      return;
    }

    if (!postForm.description.trim()) {
      notify('Please enter a description.', 'warning');
      return;
    }

    const isScholarship =
      postForm.category === 'Scholarship Announcement' ||
      postForm.category === 'Scholarship Update';
    const requiredDocumentNames = postForm.requireDocumentSubmission
      ? getRequiredDocumentNames(postForm.requiredDocuments)
      : [];

    if (
      status === 'scheduled' &&
      (!postForm.scheduledAt ||
        new Date(postForm.scheduledAt).getTime() <= Date.now())
    ) {
      notify('Choose a future date and time to schedule this post.', 'warning');
      return;
    }

    if (
      isScholarship &&
      postForm.applicationMethod === 'external' &&
      !/^https?:\/\/\S+$/i.test(postForm.externalApplicationUrl.trim())
    ) {
      notify('Enter a valid external application link starting with https://.', 'warning');
      return;
    }

    if (
      isScholarship &&
      status !== 'draft' &&
      status !== 'scheduled' &&
      !postForm.deadline
    ) {
      notify(
        'Please provide the scholarship application deadline.',
        'warning'
      );
      return;
    }

    if (
      isScholarship &&
      postForm.applicationStart &&
      postForm.deadline &&
      postForm.applicationStart > postForm.deadline
    ) {
      notify(
        'The application start date cannot be later than the deadline.',
        'warning'
      );
      return;
    }

    if (
      isScholarship &&
      postForm.amount.trim() &&
      (
        !Number.isFinite(Number(postForm.amount)) ||
        Number(postForm.amount) < 0
      )
    ) {
      notify('Please enter a valid scholarship amount.', 'warning');
      return;
    }

    if (
      isScholarship &&
      status !== 'draft' &&
      !postForm.eligibility.trim()
    ) {
      notify(
        'Please provide the scholarship eligibility requirements.',
        'warning'
      );
      return;
    }

    if (
      isScholarship &&
      status !== 'draft' &&
      postForm.requireDocumentSubmission &&
      requiredDocumentNames.length === 0
    ) {
      notify(
        'Please list at least one document students must submit.',
        'warning'
      );
      return;
    }

    if (requiredDocumentNames.length > MAX_REQUIRED_DOCUMENTS) {
      notify(
        `You can add up to ${MAX_REQUIRED_DOCUMENTS} required documents.`,
        'warning'
      );
      return;
    }

    if (existingDocuments.length + documentFiles.length > MAX_DOWNLOADABLE_DOCUMENTS) {
      notify(
        `You can attach up to ${MAX_DOWNLOADABLE_DOCUMENTS} downloadable documents.`,
        'warning'
      );
      return;
    }

    if (documentFiles.length > 0 && !driveConnected) {
      notify('Connect Google Drive before saving uploaded PDF documents.', 'warning');
      return;
    }

    setSaving(true);

    try {
      let studentNotificationsFailed = false;
      let notificationErrorMessage = '';
      let uploadedPoster: UploadedFile | null = null;

      if (posterFile) {
        setUploading(true);
        uploadedPoster = await uploadToCloudinary(
          posterFile,
          PROFILE_UPLOAD_PRESET
        );
      }

      const uploadedDocuments: UploadedFile[] = [];

      if (documentFiles.length > 0) {
        setUploading(true);

        for (const selection of documentFiles) {
          const uploaded = await uploadPdfToGoogleDrive(
            selection.file,
            {
              organizationId: user.uid,
              organizationName:
                profile.organizationName ||
                profile.name ||
                'Organization',
              category: selection.category,
              description: selection.description,
            }
          );

          uploadedDocuments.push({
            ...uploaded,
            available: selection.available,
          });
        }
      }

      const finalPosterUrl = uploadedPoster?.url || existingPosterUrl;

      const commonData = {
        title: postForm.title.trim(),
        description: postForm.description.trim(),
        category: postForm.category,
        status,
        visibility: postForm.visibility,
        isPinned: postForm.isPinned,
        allowComments: postForm.allowComments,
        allowReactions: postForm.allowReactions,
        scheduledAt:
          status === 'scheduled'
            ? Timestamp.fromDate(new Date(postForm.scheduledAt))
            : null,
        imageUrl: finalPosterUrl,
        attachments: [...existingDocuments, ...uploadedDocuments],
        organizationId: user.uid,
        organizationName:
          profile.organizationName ||
          profile.name ||
          'Organization',
        organizationType: profile.organizationType || '',
        viewCount:
          organizationPosts.find((item) => item.id === editingPostId)?.viewCount ||
          scholarships.find((item) => item.id === editingScholarshipId)?.viewCount ||
          0,
        reactionCount:
          organizationPosts.find((item) => item.id === editingPostId)?.reactionCount ||
          0,
        commentCount:
          organizationPosts.find((item) => item.id === editingPostId)?.commentCount ||
          0,
        shareCount:
          organizationPosts.find((item) => item.id === editingPostId)?.shareCount ||
          0,
        createdAt:
          organizationPosts.find((item) => item.id === editingPostId)?.createdAt ||
          scholarships.find((item) => item.id === editingScholarshipId)?.createdAt ||
          serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      let publishedItemId = '';
      if (isScholarship) {
        const scholarshipData = {
          ...commonData,
          organizationLogo: profile.logoUrl || '',
          applicationStatus: postForm.applicationStatus,
          bannerUrl: finalPosterUrl,
          amount: postForm.amount.trim(),
          benefits: postForm.benefits.trim(),
          eligibility: postForm.eligibility.trim(),
          requiredDocuments: requiredDocumentNames,
          applicationStart: postForm.applicationStart,
          deadline: postForm.deadline,
          contactInfo: postForm.contactInfo.trim(),
          location: postForm.location.trim(),
          applicationMethod: postForm.applicationMethod,
          externalApplicationUrl:
            postForm.applicationMethod === 'external'
              ? postForm.externalApplicationUrl.trim()
              : '',
          requireEligibilityAssessment:
            postForm.requireEligibilityAssessment,
          requireDocumentSubmission: postForm.requireDocumentSubmission,
          allowOptionalDocuments: postForm.allowOptionalDocuments,
          allowEditSubmittedApplication:
            postForm.allowEditSubmittedApplication,
        };
        if (editingScholarshipId) {
          publishedItemId = editingScholarshipId;
          await updateDoc(doc(db, 'scholarships', editingScholarshipId), scholarshipData);
        } else {
          const scholarshipDoc = await addDoc(
            collection(db, 'scholarships'),
            scholarshipData
          );
          publishedItemId = scholarshipDoc.id;
        }
      }

      const postData = {
        ...commonData,
        scholarshipId: isScholarship
          ? publishedItemId
          : editingPostId
            ? organizationPosts.find((item) => item.id === editingPostId)?.scholarshipId || ''
            : '',
        benefits: postForm.benefits.trim(),
        eligibility: postForm.eligibility.trim(),
        amount: postForm.amount.trim(),
        location: postForm.location.trim(),
        applicationStart: postForm.applicationStart,
        deadline: postForm.deadline,
        applicationStatus: postForm.applicationStatus,
        requiredDocuments: requiredDocumentNames,
        applicationMethod: postForm.applicationMethod,
        externalApplicationUrl:
          postForm.applicationMethod === 'external'
            ? postForm.externalApplicationUrl.trim()
            : '',
        requireEligibilityAssessment:
          postForm.requireEligibilityAssessment,
        requireDocumentSubmission: postForm.requireDocumentSubmission,
        allowOptionalDocuments: postForm.allowOptionalDocuments,
        allowEditSubmittedApplication:
          postForm.allowEditSubmittedApplication,
      };
      let postId = editingPostId;
      if (postId) {
        await updateDoc(doc(db, 'organizationPosts', postId), postData);
      } else {
        const postDoc = await addDoc(collection(db, 'organizationPosts'), postData);
        postId = postDoc.id;
      }
      if (!publishedItemId) publishedItemId = postId;

      // ----------------------------------------------------
      // NOTIFY STUDENTS (notification bell on student home)
      // Sent only when the post is newly published
      // (new post, or a draft/scheduled post being published now).
      // ----------------------------------------------------
      const previousPostStatus = organizationPosts.find(
        (item) => item.id === editingPostId
      )?.status;
      const previousScholarshipStatus = scholarships.find(
        (item) => item.id === editingScholarshipId
      )?.status;
      const wasAlreadyPublished =
        isPublished(previousPostStatus) ||
        isPublished(previousScholarshipStatus);

      if (status === 'published' && !wasAlreadyPublished) {
        try {
          const organizationDisplayName =
            profile.organizationName || profile.name || 'An organization';

          await sendNotificationsToAllStudents({
            organizationId: user.uid,
            organizationName: organizationDisplayName,
            organizationLogo: profile.logoUrl || '',
            title: isScholarship
              ? 'New scholarship opportunity'
              : 'New organization announcement',
            message: `${organizationDisplayName}: ${postForm.title.trim()}`,
            type: isScholarship ? 'scholarship' : 'announcement',
            scholarshipId: isScholarship ? publishedItemId : '',
            postId,
            scholarshipTitle: isScholarship ? postForm.title.trim() : '',
            amount: isScholarship ? postForm.amount.trim() : '',
            deadline: isScholarship ? postForm.deadline : '',
            imageUrl: finalPosterUrl,
          });
        } catch (notificationError) {
          console.error(
            'Post was published but student notification delivery failed:',
            notificationError
          );
          studentNotificationsFailed = true;
          notificationErrorMessage =
            notificationError instanceof Error
              ? notificationError.message
              : 'Unknown error';
        }
      }

      setPostModalOpen(false);
      resetPostForm();

      notify(
        editingPostId || editingScholarshipId
          ? status === 'published' && studentNotificationsFailed
            ? `Post updated, but student notifications failed: ${notificationErrorMessage}`
            : 'Your post has been updated.'
          : status === 'published'
          ? studentNotificationsFailed
            ? `Post published, but student notifications failed: ${notificationErrorMessage}`
            : 'Your post has been published and students have been notified!'
          : status === 'scheduled'
            ? 'Post scheduled. It will publish automatically at the selected time.'
            : 'Your post has been saved as a draft!',
        studentNotificationsFailed ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('Post submission error:', error);
      if (
        error instanceof Error &&
        error.message.includes('Connect or reconnect Google Drive')
      ) {
        setDriveConnectedFor('');
      }

      notify(
        error instanceof Error
          ? error.message
          : 'Unable to save post. Please check Cloudinary and Firestore settings.',
        'danger'
      );
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  // ------------------------------------------------------
  // DELETE CONTENT
  // ------------------------------------------------------

  const deleteContent = async (
    collectionName: 'scholarships' | 'organizationPosts',
    id: string,
    title?: string
  ) => {
    if (!user) {
      notify('Please log in again.', 'warning');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${title || 'this item'}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      if (collectionName === 'scholarships') {
        const linkedPost = organizationPosts.find(
          (post) => post.scholarshipId === id
        );
        const batch = writeBatch(db);
        batch.delete(doc(db, 'scholarships', id));
        if (linkedPost) {
          batch.delete(doc(db, 'organizationPosts', linkedPost.id));
        }
        await batch.commit();
      } else {
        const linkedScholarship = scholarships.find(
          (scholarship) => scholarship.id ===
            organizationPosts.find((post) => post.id === id)?.scholarshipId
        );
        const batch = writeBatch(db);
        batch.delete(doc(db, collectionName, id));
        if (linkedScholarship) {
          batch.delete(doc(db, 'scholarships', linkedScholarship.id));
        }
        await batch.commit();
      }
      notify('Content deleted successfully.');
    } catch (error) {
      console.error('Delete content error:', error);

      notify(
        error instanceof Error
          ? `Unable to delete content: ${error.message}`
          : 'Unable to delete content.',
        'danger'
      );
    }
  };

  // ------------------------------------------------------
  // LOGOUT
  // ------------------------------------------------------

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/lgu-login');
    } catch (error) {
      console.error('Logout error:', error);
      notify('Unable to log out. Please try again.', 'danger');
    }
  };

  // ------------------------------------------------------
  // CARD COMPONENTS
  // ------------------------------------------------------

  const updateScholarshipApplicationStatus = async (
    scholarshipId: string,
    nextStatus: "open" | "closed" | "upcoming"
  ) => {
    if (!user) {
      notify("Please log in again.", "warning");
      return;
    }

    try {
      const linkedPost = organizationPosts.find(
        (post) => post.scholarshipId === scholarshipId
      );
      const batch = writeBatch(db);
      batch.update(doc(db, "scholarships", scholarshipId), {
        applicationStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
      if (linkedPost) {
        batch.update(doc(db, "organizationPosts", linkedPost.id), {
          applicationStatus: nextStatus,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();

      notify(
        nextStatus === "open"
          ? "Scholarship applications are now OPEN for students."
          : nextStatus === "upcoming"
            ? "Scholarship is now marked as UPCOMING."
            : "Scholarship applications are now CLOSED for students.",
        "success"
      );
    } catch (error) {
      console.error("Scholarship application status update error:", error);
      notify(
        error instanceof Error
          ? error.message
          : "Unable to update scholarship application status.",
        "danger"
      );
    }
  };

  const renderViewCounter = (
    status?: string,
    viewCount?: number
  ) => {
    if (!isPublished(status)) return null;

    return (
      <div className="org-card-views">
        <IonIcon icon={eyeOutline} />
        <span>{getViewCount(viewCount).toLocaleString('en-PH')} views</span>
      </div>
    );
  };

  const renderScholarshipCard = (item: Scholarship) => (
    <article className="org-scholarship-card" key={item.id}>
      <img
        className="org-scholarship-banner"
        src={item.bannerUrl || DEFAULT_BANNER}
        alt="Scholarship banner"
        onError={(event) => {
          event.currentTarget.src = DEFAULT_BANNER;
        }}
      />

      <div className="org-scholarship-content">
        <div className="org-scholarship-top">
          <span className="org-category">
            {item.category || 'Scholarship'}
          </span>

          <span
            className={`org-status ${String(item.status || 'draft').toLowerCase()}`}
          >
            {item.status || 'draft'}
          </span>
        </div>

        {renderViewCounter(item.status, item.viewCount)}
        <div className="org-card-metrics org-post-analytics">
          <span>Views {getViewCount(item.viewCount)}</span>
          <span>Likes {getViewCount(item.reactionCount)}</span>
          <span>Comments {getViewCount(item.commentCount)}</span>
          <span>Shares {getViewCount(item.shareCount)}</span>
          <span>Applications {applicationCounts[item.id] || 0}</span>
        </div>

        <h3>{item.title || 'Untitled Scholarship'}</h3>

        <p className="org-scholarship-description">
          {item.description || 'No scholarship description available.'}
        </p>

        <div className="org-scholarship-details">
          <span>
            <IonIcon icon={cashOutline} />
            {formatAmount(item.amount)}
          </span>

          <span>
            <IonIcon icon={calendarOutline} />
            {item.deadline || 'No deadline'}
          </span>
        </div>

        {item.eligibility && (
          <div className="org-card-extra">
            <strong>Eligibility:</strong>
            <p>{item.eligibility}</p>
          </div>
        )}

        {item.location && (
          <div className="org-card-extra">
            <strong>Application Location:</strong>
            <p>{item.location}</p>
          </div>
        )}

        {item.attachments && item.attachments.length > 0 && (
          <div className="org-attachment-list">
            {item.attachments.map((file, index) => (
              <a
                key={`${file.publicId}-${index}`}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IonIcon icon={downloadOutline} />
                {file.name}
              </a>
            ))}
          </div>
        )}

        <div className="org-scholarship-footer">
          <small>
            <IonIcon icon={calendarOutline} />
            Posted {formatDate(item.createdAt)}
          </small>

          <div className="org-card-actions">
            {isPublished(item.status) && (
              <div className="org-application-controls">
                <span
                  className={`org-application-state ${
                    item.applicationStatus === "closed"
                      ? "is-closed"
                      : item.applicationStatus === "upcoming"
                        ? "is-upcoming"
                        : "is-open"
                  }`}
                >
                  Applications {String(item.applicationStatus || "open").toUpperCase()}
                </span>
                <button
                  type="button"
                  className="org-open-button"
                  disabled={item.applicationStatus === "open"}
                  onClick={() => updateScholarshipApplicationStatus(item.id, "open")}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="org-close-button"
                  disabled={item.applicationStatus === "closed"}
                  onClick={() => updateScholarshipApplicationStatus(item.id, "closed")}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="org-upcoming-button"
                  disabled={item.applicationStatus === "upcoming"}
                  onClick={() => updateScholarshipApplicationStatus(item.id, "upcoming")}
                >
                  Upcoming
                </button>
              </div>
            )}
            <button
              type="button"
              className="org-edit-content-button"
              onClick={() => openEditContent(item, item)}
            >
              <IonIcon icon={createOutline} />
              Edit
            </button>

            <button
              type="button"
              onClick={() => go('/lgu-scholarships')}
            >
              Manage <IonIcon icon={chevronForwardOutline} />
            </button>

            <button
              type="button"
              className="org-delete-button"
              onClick={() =>
                deleteContent('scholarships', item.id, item.title)
              }
              aria-label="Delete scholarship"
            >
              <IonIcon icon={trashOutline} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );

  const renderPostCard = (item: OrganizationPost) => (
    <article className="org-post-card" key={item.id}>
      {item.imageUrl && (
        <img
          className="org-post-image"
          src={item.imageUrl}
          alt="Post poster"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}

      <div className="org-post-content">
        <div className="org-post-top">
          <span className="org-category">
            {item.category || 'Announcement'}
          </span>

          <span
            className={`org-status ${String(item.status || 'draft').toLowerCase()}`}
          >
            {item.status || 'draft'}
          </span>
        </div>

        {renderViewCounter(item.status, item.viewCount)}
        <div className="org-card-metrics org-post-analytics">
          <span>Views {getViewCount(item.viewCount)}</span>
          <span>Likes {getViewCount(item.reactionCount)}</span>
          <span>Comments {getViewCount(item.commentCount)}</span>
          <span>Shares {getViewCount(item.shareCount)}</span>
          {item.scholarshipId && (
            <span>Applications {applicationCounts[item.scholarshipId] || 0}</span>
          )}
        </div>

        <h3>{item.title || 'Untitled Post'}</h3>

        <p>{item.description || 'No description available.'}</p>

        {item.attachments && item.attachments.length > 0 && (
          <div className="org-attachment-list">
            {item.attachments.map((file, index) => (
              <a
                key={`${file.publicId}-${index}`}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IonIcon icon={downloadOutline} />
                {file.name}
              </a>
            ))}
          </div>
        )}

        <div className="org-post-footer">
          <small>Posted {formatDate(item.createdAt)}</small>

          <div className="org-card-actions">
            <span>{item.organizationName || organizationName}</span>

            <button
              type="button"
              className="org-edit-content-button"
              onClick={() => openEditContent(item)}
              aria-label="Edit post"
            >
              <IonIcon icon={createOutline} />
              Edit
            </button>

            <button
              type="button"
              className="org-delete-button"
              onClick={() =>
                deleteContent('organizationPosts', item.id, item.title)
              }
              aria-label="Delete announcement"
            >
              <IonIcon icon={trashOutline} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );

  // ======================================================
  // MAIN RENDER
  // ======================================================

  return (
    <IonPage>
      <IonContent fullscreen className="org-profile-content">
        <div className="org-dashboard-layout">

          {/* TOPBAR */}

          <header className="org-dashboard-topbar">
            <div className="org-topbar-left">
              <div className="org-brand-logo">GA</div>

              <div>
                <span className="org-topbar-subtitle">
                  LGU / SCHOOL PORTAL
                </span>
                <strong>Organization Management</strong>
              </div>
            </div>

            <div className="org-topbar-right">
              <button
                type="button"
                className="org-notification-button"
                onClick={() => go('/lgu-notifications')}
                aria-label="Notifications"
              >
                <IonIcon icon={notificationsOutline} />
              </button>

              <div className="org-profile-menu-wrapper">
                <button
                  type="button"
                  className="org-top-profile"
                  onClick={() =>
                    setProfileMenuOpen((value) => !value)
                  }
                >
                  <img
                    src={logo}
                    alt="Organization logo"
                    onError={(event) => {
                      event.currentTarget.src = DEFAULT_LOGO;
                    }}
                  />

                  <span>{organizationName}</span>
                  <IonIcon icon={personCircleOutline} />
                </button>

                {profileMenuOpen && (
                  <div className="org-profile-dropdown">
                    <button type="button" onClick={openEditProfile}>
                      <IonIcon icon={createOutline} />
                      Edit Organization Profile
                    </button>

                    <button
                      type="button"
                      onClick={() => go('/lgu-settings')}
                    >
                      <IonIcon icon={settingsOutline} />
                      Account Settings
                    </button>

                    <button
                      type="button"
                      className="org-dropdown-logout"
                      onClick={handleLogout}
                    >
                      <IonIcon icon={logOutOutline} />
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* MAIN CONTENT */}

          <main className="org-main">
            <section className="org-page-heading">
              <div>
                <span className="org-eyebrow">
                  ORGANIZATION MANAGEMENT
                </span>

                <h1>My Organization</h1>

                <p>
                  Manage your organization's profile and showcase your
                  scholarship opportunities to students.
                </p>
              </div>

              <button
                type="button"
                className="org-primary-button"
                onClick={openEditProfile}
              >
                <IonIcon icon={createOutline} />
                Edit Profile
              </button>
            </section>

            {loading ? (
              <div className="org-loading">
                <IonSpinner name="crescent" />
                <span>Loading organization profile...</span>
              </div>
            ) : (
              <>
                {/* ORGANIZATION PROFILE */}

                <section className="org-profile-card">
                  <div
                    className="org-cover"
                    style={{
                      backgroundImage:
                        `linear-gradient(90deg, rgba(15, 49, 27, .88), rgba(15, 49, 27, .25)), url("${cover}")`,
                    }}
                  >
                    <div className="org-cover-content">
                      <span>OFFICIAL ORGANIZATION PROFILE</span>
                      <h2>{organizationName}</h2>
                      <p>
                        {profile.organizationType || 'LGU / School'}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="org-cover-edit"
                      onClick={openEditProfile}
                    >
                      <IonIcon icon={imageOutline} />
                      Edit Cover
                    </button>
                  </div>

                  <div className="org-profile-main">
                    <img
                      className="org-logo"
                      src={logo}
                      alt={`${organizationName} logo`}
                      onError={(event) => {
                        event.currentTarget.src = DEFAULT_LOGO;
                      }}
                    />

                    <div className="org-profile-identity">
                      <h2>{organizationName}</h2>

                      <p>
                        {profile.organizationType || 'LGU / School'}
                        {profile.address ? ` · ${profile.address}` : ''}
                      </p>

                      <span className="org-profile-description">
                        {profile.description ||
                          'Add an organization description to introduce your institution to students.'}
                      </span>

                      <span className="org-status published">
                        Account Status: Active
                      </span>
                    </div>

                    <div className="org-profile-buttons">
                      <button
                        type="button"
                        className="org-primary-button"
                        onClick={openEditProfile}
                      >
                        <IonIcon icon={createOutline} />
                        Edit Profile
                      </button>

                      <button
                        type="button"
                        className="org-outline-button"
                        onClick={() => go('/lgu-scholarships')}
                      >
                        <IonIcon icon={schoolOutline} />
                        Scholarships
                      </button>
                    </div>
                  </div>

                  {/* PROFILE TABS */}

                  <div className="org-tabs">
                    {([
                      { name: 'Posts', icon: documentTextOutline },
                      { name: 'Scholarships', icon: schoolOutline },
                      { name: 'About', icon: informationCircleOutline },
                    ] as { name: TabName; icon: string }[]).map((tab) => (
                      <button
                        type="button"
                        key={tab.name}
                        className={activeTab === tab.name ? 'selected' : ''}
                        onClick={() => setActiveTab(tab.name)}
                      >
                        <IonIcon icon={tab.icon} />
                        {tab.name}

                        {tab.name === 'Posts' && (
                          <span>{totalPublishedContent}</span>
                        )}

                        {tab.name === 'Scholarships' && (
                          <span>{scholarships.length}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </section>

                {/* STATISTICS */}

                <section className="org-stats">
                  <article className="org-stat-card">
                    <div className="org-stat-icon green">
                      <IonIcon icon={schoolOutline} />
                    </div>
                    <div>
                      <span>Total Scholarships</span>
                      <strong>{scholarships.length}</strong>
                    </div>
                  </article>

                  <article className="org-stat-card">
                    <div className="org-stat-icon blue">
                      <IonIcon icon={checkmarkCircleOutline} />
                    </div>
                    <div>
                      <span>Published Scholarships</span>
                      <strong>{publishedScholarships.length}</strong>
                    </div>
                  </article>

                  <article className="org-stat-card">
                    <div className="org-stat-icon orange">
                      <IonIcon icon={documentTextOutline} />
                    </div>
                    <div>
                      <span>All Drafts</span>
                      <strong>{totalDrafts}</strong>
                    </div>
                  </article>

                  <article className="org-stat-card">
                    <div className="org-stat-icon purple">
                      <IonIcon icon={eyeOutline} />
                    </div>
                    <div>
                      <span>Total Published Views</span>
                      <strong>
                        {totalPublishedViews.toLocaleString('en-PH')}
                      </strong>
                    </div>
                  </article>
                </section>

                {/* CONTENT LAYOUT */}

                <div className="org-content-layout">
                  <section className="org-content-main">

                    {/* POSTS TAB */}

                    {activeTab === 'Posts' && (
                      <>
                        <div className="org-section-heading">
                          <div>
                            <h2>Organization Posts</h2>
                            <p>
                              Announcements, activities, and scholarship opportunities.
                            </p>
                          </div>

                          <button
                            type="button"
                            className="org-primary-button"
                            onClick={openCreatePost}
                          >
                            <IonIcon icon={addOutline} />
                            Create Post
                          </button>
                        </div>

                        {publishedPosts.length === 0 &&
                        publishedScholarships.length === 0 ? (
                          <div className="org-empty-state">
                            <div className="org-empty-icon">
                              <IonIcon icon={megaphoneOutline} />
                            </div>

                            <h3>No published posts yet</h3>

                            <p>
                              Share announcements, events, reminders, and
                              scholarship opportunities with students.
                            </p>

                            <button
                              type="button"
                              className="org-primary-button"
                              onClick={openCreatePost}
                            >
                              <IonIcon icon={addOutline} />
                              Create Your First Post
                            </button>
                          </div>
                        ) : (
                          <div className="org-post-list">
                            {publishedPosts.map(renderPostCard)}
                            {publishedScholarships.map(renderScholarshipCard)}
                          </div>
                        )}

                        <div className="org-section-heading org-draft-heading">
                          <div>
                            <h2>Draft Posts</h2>
                            <p>Posts that are not yet published.</p>
                          </div>
                        </div>

                        {totalDrafts === 0 ? (
                          <p className="org-muted">
                            You do not have any draft posts.
                          </p>
                        ) : (
                          <div className="org-post-list">
                            {draftPosts.map(renderPostCard)}
                            {draftScholarships.map(renderScholarshipCard)}
                          </div>
                        )}

                        <div className="org-section-heading org-draft-heading">
                          <div>
                            <h2>Scheduled Posts</h2>
                            <p>Posts set to publish automatically at a later time.</p>
                          </div>
                          <strong>{totalScheduled}</strong>
                        </div>

                        {totalScheduled > 0 ? (
                          <div className="org-post-list">
                            {scheduledPosts.map(renderPostCard)}
                            {scheduledScholarships.map(renderScholarshipCard)}
                          </div>
                        ) : (
                          <p className="org-muted">No posts are scheduled right now.</p>
                        )}
                      </>
                    )}

                    {/* SCHOLARSHIPS TAB */}

                    {activeTab === 'Scholarships' && (
                      <>
                        <div className="org-section-heading">
                          <div>
                            <h2>My Scholarships</h2>
                            <p>
                              All scholarship listings created by your organization.
                            </p>
                          </div>

                          <button
                            type="button"
                            className="org-primary-button"
                            onClick={openCreateScholarship}
                          >
                            <IonIcon icon={addOutline} />
                            Create Scholarship
                          </button>
                        </div>

                        {scholarships.length === 0 ? (
                          <div className="org-empty-state">
                            <div className="org-empty-icon">
                              <IonIcon icon={schoolOutline} />
                            </div>

                            <h3>No scholarships available</h3>

                            <p>
                              Create your first scholarship opportunity
                              and share it with students.
                            </p>

                            <button
                              type="button"
                              className="org-primary-button"
                              onClick={openCreateScholarship}
                            >
                              Create Scholarship
                            </button>
                          </div>
                        ) : (
                          <div className="org-scholarship-list">
                            {scholarships.map(renderScholarshipCard)}
                          </div>
                        )}
                      </>
                    )}

                    {/* ABOUT TAB */}

                    {activeTab === 'About' && (
                      <section className="org-about-card">
                        <div className="org-section-heading">
                          <div>
                            <h2>About {organizationName}</h2>
                            <p>Information about your organization.</p>
                          </div>

                          <button
                            type="button"
                            className="org-outline-button"
                            onClick={openEditProfile}
                          >
                            <IonIcon icon={createOutline} />
                            Edit
                          </button>
                        </div>

                        <p className="org-about-description">
                          {profile.description ||
                            'No organization description has been added yet.'}
                        </p>

                        <div className="org-about-grid">
                          <InfoItem
                            icon={businessOutline}
                            label="Organization Name"
                            value={organizationName}
                          />

                          <InfoItem
                            icon={schoolOutline}
                            label="Organization Type"
                            value={profile.organizationType || 'Not provided'}
                          />

                          <InfoItem
                            icon={locationOutline}
                            label="Address"
                            value={profile.address || 'Not provided'}
                          />

                          <InfoItem
                            icon={mailOutline}
                            label="Email Address"
                            value={
                              profile.organizationEmail ||
                              profile.email ||
                              user?.email ||
                              'Not provided'
                            }
                          />

                          <InfoItem
                            icon={callOutline}
                            label="Contact Number"
                            value={profile.contactNumber || 'Not provided'}
                          />

                          <InfoItem
                            icon={peopleOutline}
                            label="Representative"
                            value={profile.representativeName || 'Not provided'}
                          />
                        </div>
                      </section>
                    )}
                  </section>

                  {/* RIGHT SIDEBAR */}

                  <aside className="org-content-sidebar">
                    <section className="org-side-card">
                      <div className="org-side-card-heading">
                        <h3>Organization Information</h3>

                        <button
                          type="button"
                          onClick={openEditProfile}
                          aria-label="Edit organization information"
                        >
                          <IonIcon icon={createOutline} />
                        </button>
                      </div>

                      <InfoItem
                        icon={businessOutline}
                        label="Organization"
                        value={organizationName}
                      />

                      <InfoItem
                        icon={schoolOutline}
                        label="Type"
                        value={profile.organizationType || 'Not provided'}
                      />

                      <InfoItem
                        icon={locationOutline}
                        label="Address"
                        value={profile.address || 'Not provided'}
                      />

                      <InfoItem
                        icon={mailOutline}
                        label="Email"
                        value={
                          profile.organizationEmail ||
                          profile.email ||
                          user?.email ||
                          'Not provided'
                        }
                      />

                      <InfoItem
                        icon={callOutline}
                        label="Contact"
                        value={profile.contactNumber || 'Not provided'}
                      />
                    </section>

                    <section className="org-side-card">
                      <h3>Quick Actions</h3>

                      <button
                        type="button"
                        className="org-quick-action"
                        onClick={openCreatePost}
                      >
                        <IonIcon icon={addOutline} />
                        <span>Create Announcement</span>
                        <IonIcon icon={chevronForwardOutline} />
                      </button>

                      <button
                        type="button"
                        className="org-quick-action"
                        onClick={openCreateScholarship}
                      >
                        <IonIcon icon={schoolOutline} />
                        <span>Post Scholarship</span>
                        <IonIcon icon={chevronForwardOutline} />
                      </button>

                      <button
                        type="button"
                        className="org-quick-action"
                        onClick={() => go('/lgu-applications')}
                      >
                        <IonIcon icon={peopleOutline} />
                        <span>View Applications</span>
                        <IonIcon icon={chevronForwardOutline} />
                      </button>

                      <button
                        type="button"
                        className="org-quick-action"
                        onClick={() => go('/lgu-messages')}
                      >
                        <IonIcon icon={chatbubblesOutline} />
                        <span>Open Messages</span>
                        <IonIcon icon={chevronForwardOutline} />
                      </button>
                    </section>

                    <section className="org-side-card">
                      <h3>Featured Scholarships</h3>

                      {publishedScholarships.length === 0 ? (
                        <p className="org-muted">
                          Published scholarships will appear here.
                        </p>
                      ) : (
                        publishedScholarships.slice(0, 3).map((item) => (
                          <div className="org-featured-item" key={item.id}>
                            <img
                              src={item.bannerUrl || DEFAULT_BANNER}
                              alt=""
                              onError={(event) => {
                                event.currentTarget.src = DEFAULT_BANNER;
                              }}
                            />

                            <div>
                              <strong>
                                {item.title || 'Untitled Scholarship'}
                              </strong>
                              <span>{formatAmount(item.amount)}</span>
                              <small>
                                <IonIcon icon={eyeOutline} />
                                {getViewCount(item.viewCount)} views
                              </small>
                            </div>
                          </div>
                        ))
                      )}
                    </section>
                  </aside>
                </div>
              </>
            )}

            <footer className="org-footer">
              <span>
                © {new Date().getFullYear()} GrantAccess. All rights reserved.
              </span>
              <span>LGU / School Portal</span>
            </footer>
          </main>

          {/* ==================================================
              EDIT PROFILE MODAL
          ================================================== */}

          {editOpen && (
            <div
              className="org-modal-backdrop"
              onClick={(event) => {
                if (
                  event.target === event.currentTarget &&
                  !saving &&
                  !uploading
                ) {
                  setEditOpen(false);
                }
              }}
            >
              <section
                className="org-edit-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="org-edit-title"
              >
                <div className="org-modal-header">
                  <div>
                    <span>ORGANIZATION SETTINGS</span>
                    <h2 id="org-edit-title">Edit Organization Profile</h2>
                    <p>
                      Update the information displayed on your organization page.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    disabled={saving || uploading}
                    aria-label="Close edit form"
                  >
                    <IonIcon icon={closeCircleOutline} />
                  </button>
                </div>

                <div className="org-modal-body">
                  <div className="org-form-grid">
                    <div className="org-form-section-heading org-form-full">
                      <span>01</span>
                      <div>
                        <strong>Post details</strong>
                        <small>Choose the post type and add the main information.</small>
                      </div>
                    </div>

                    <div className="org-form-group org-form-full">
                      <label>Organization Name *</label>
                      <input
                        type="text"
                        value={form.organizationName}
                        onChange={(event) =>
                          updateForm('organizationName', event.target.value)
                        }
                        placeholder="Enter organization name"
                        maxLength={120}
                      />
                    </div>

                    <div className="org-form-group">
                      <label>Organization Type *</label>
                      <select
                        value={form.organizationType}
                        onChange={(event) =>
                          updateForm('organizationType', event.target.value)
                        }
                      >
                        <option value="">Select type</option>
                        <option value="LGU">LGU</option>
                        <option value="School">School</option>
                      </select>
                    </div>

                    <div className="org-form-group">
                      <label>Representative Name</label>
                      <input
                        type="text"
                        value={form.representativeName}
                        onChange={(event) =>
                          updateForm('representativeName', event.target.value)
                        }
                        placeholder="Representative name"
                      />
                    </div>

                    <div className="org-form-group">
                      <label>Email Address</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          updateForm('email', event.target.value)
                        }
                        placeholder="Organization email"
                      />
                    </div>

                    <div className="org-form-group">
                      <label>Contact Number</label>
                      <input
                        type="tel"
                        value={form.contactNumber}
                        onChange={(event) =>
                          updateForm('contactNumber', event.target.value)
                        }
                        placeholder="Contact number"
                      />
                    </div>

                    <div className="org-form-group org-form-full">
                      <label>Organization Address</label>
                      <input
                        type="text"
                        value={form.address}
                        onChange={(event) =>
                          updateOrganizationAddress(event.target.value)
                        }
                        placeholder="Complete organization address"
                      />
                    </div>

                    <div className="org-form-group org-form-full">
                      <label>Organization Map Pin (Required)</label>
                      <small className="org-location-picker-help">
                        Search the address or tap the map to set the exact pin
                        students will see. You must set a pin before saving.
                      </small>
                      <div
                        ref={organizationLocationMapContainerRef}
                        className="org-location-picker-map"
                        aria-label="Tap to set the organization map pin"
                      />
                      <div className="org-location-picker-actions">
                        <button
                          type="button"
                          className="org-outline-button"
                          onClick={findOrganizationAddressOnMap}
                          disabled={findingAddress || !form.address.trim()}
                        >
                          {findingAddress ? (
                            <>
                              <IonSpinner name="crescent" />
                              Finding address...
                            </>
                          ) : (
                            <>
                              <IonIcon icon={locationOutline} />
                              Find address on map
                            </>
                          )}
                        </button>
                        <span
                          className="org-location-picker-coordinates"
                          role="status"
                        >
                          {typeof form.latitude === 'number' &&
                          typeof form.longitude === 'number'
                            ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}`
                            : 'No pin selected'}
                        </span>
                      </div>
                      <small className="org-location-picker-status">
                        {locationMapStatus}
                      </small>
                    </div>

                    <div className="org-form-group org-form-full">
                      <label>Organization Description</label>
                      <textarea
                        rows={4}
                        value={form.description}
                        onChange={(event) =>
                          updateForm('description', event.target.value)
                        }
                        placeholder="Write a short description about your organization..."
                        maxLength={1000}
                      />
                      <small>
                        {form.description.length}/1000 characters
                      </small>
                    </div>

                    <div className="org-form-group org-form-full">
                      <label>Organization Logo</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          uploadProfileImage(event, 'logoUrl')
                        }
                        disabled={uploading}
                      />

                      {form.logoUrl && (
                        <img
                          className="org-upload-preview org-logo-preview"
                          src={form.logoUrl}
                          alt="Organization logo preview"
                        />
                      )}
                    </div>

                    <div className="org-form-group org-form-full">
                      <label>Cover Photo</label>
                      <small className="org-cover-help">
                        This wide image appears at the top of your public
                        organization profile seen by students. A landscape
                        photo works best.
                      </small>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          uploadProfileImage(event, 'coverPhotoUrl')
                        }
                        disabled={uploading}
                      />

                      <img
                        className="org-upload-preview org-cover-preview"
                        src={form.coverPhotoUrl || DEFAULT_COVER}
                        alt="Preview of the cover photo shown on your public profile"
                      />
                    </div>
                  </div>
                </div>

                <div className="org-modal-footer">
                  <button
                    type="button"
                    className="org-outline-button"
                    onClick={() => setEditOpen(false)}
                    disabled={saving || uploading}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="org-primary-button"
                    onClick={saveProfile}
                    disabled={saving || uploading}
                  >
                    {saving || uploading ? (
                      <>
                        <IonSpinner name="crescent" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <IonIcon icon={saveOutline} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* ==================================================
              CREATE POST MODAL
          ================================================== */}

          {postModalOpen && (
            <div
              className="org-modal-backdrop org-post-backdrop"
              onClick={(event) => {
                if (
                  event.target === event.currentTarget &&
                  !saving &&
                  !uploading
                ) {
                  setPostModalOpen(false);
                }
              }}
            >
              <section
                className="org-edit-modal org-create-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="org-create-title"
              >
                <div className="org-modal-header">
                  <div>
                    <span>ORGANIZATION CONTENT</span>
                    <h2 id="org-create-title">
                      {editingPostId || editingScholarshipId ? 'Edit Post' : 'Create New Post'}
                    </h2>
                    <p>
                      Share announcements, events, or scholarship opportunities.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPostModalOpen(false)}
                    disabled={saving || uploading}
                    aria-label="Close create post"
                  >
                    <IonIcon icon={closeCircleOutline} />
                  </button>
                </div>

                <div className="org-modal-body">
                  <div className="org-post-editor-grid">
                    <div className="org-post-editor-main">
                  <div className="org-form-grid">
                    <div className="org-form-group org-form-full">
                      <label>Post Type *</label>
                      <select
                        value={postForm.category}
                        disabled={!!editingScholarshipId}
                        onChange={(event) =>
                          updatePostForm(
                            'category',
                            event.target.value as PostType
                          )
                        }
                      >
                        <option value="General Announcement">
                          General Announcement
                        </option>
                        <option value="Scholarship Announcement">
                          Scholarship Announcement
                        </option>
                        <option value="Scholarship Update">
                          Scholarship Update
                        </option>
                        <option value="Document Sharing">
                          Document Sharing
                        </option>
                        <option value="Events and Activities">
                          Events and Activities
                        </option>
                        <option value="Important Reminders">
                          Important Reminders
                        </option>
                        <option value="News and Updates">
                          News and Updates
                        </option>
                      </select>
                      {editingScholarshipId && (
                        <small className="org-field-hint">
                          A published scholarship stays linked to its student application record.
                        </small>
                      )}
                    </div>

                    <div className="org-form-group org-form-full">
                      <label>Post Title *</label>
                      <input
                        type="text"
                        value={postForm.title}
                        onChange={(event) =>
                          updatePostForm('title', event.target.value)
                        }
                        placeholder="Enter announcement or scholarship title"
                        maxLength={150}
                      />
                      <small>{postForm.title.length}/150 characters</small>
                    </div>

                    <div className="org-form-group org-form-full">
                      <label>Description *</label>
                      <textarea
                        rows={5}
                        value={postForm.description}
                        onChange={(event) =>
                          updatePostForm('description', event.target.value)
                        }
                        placeholder="Write the complete details of your post..."
                        maxLength={5000}
                      />
                      <small>
                        {postForm.description.length}/5000 characters
                      </small>
                    </div>

                    {(postForm.category === 'Scholarship Announcement' ||
                      postForm.category === 'Scholarship Update') && (
                      <>
                        <div className="org-form-section-heading org-form-full">
                          <span>02</span>
                          <div>
                            <strong>Scholarship details</strong>
                            <small>Set the offer, eligibility, and application dates.</small>
                          </div>
                        </div>

                        <div className="org-form-group">
                          <label>Scholarship Amount (PHP)</label>
                          <input
                            type="number"
                            min="0"
                            value={postForm.amount}
                            onChange={(event) =>
                              updatePostForm('amount', event.target.value)
                            }
                            placeholder="Example: 10000"
                          />
                        </div>

                        <div className="org-form-group">
                          <label>Scholarship Benefits</label>
                          <input
                            type="text"
                            value={postForm.benefits}
                            onChange={(event) =>
                              updatePostForm('benefits', event.target.value)
                            }
                            placeholder="Tuition support, allowance, etc."
                          />
                        </div>

                        <div className="org-form-group">
                          <label>Application Status *</label>
                          <select
                            value={postForm.applicationStatus}
                            onChange={(event) =>
                              updatePostForm(
                                'applicationStatus',
                                event.target.value as PostForm['applicationStatus']
                              )
                            }
                          >
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                            <option value="upcoming">Upcoming</option>
                          </select>
                        </div>

                        <div className="org-form-group">
                          <label>Application Location</label>
                          <input
                            type="text"
                            value={postForm.location}
                            onChange={(event) =>
                              updatePostForm('location', event.target.value)
                            }
                            placeholder="Where to apply"
                          />
                        </div>

                        <div className="org-form-group">
                          <label>Application Start Date</label>
                          <input
                            type="date"
                            value={postForm.applicationStart}
                            onChange={(event) =>
                              updatePostForm(
                                'applicationStart',
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="org-form-group">
                          <label>Application Deadline *</label>
                          <input
                            type="date"
                            value={postForm.deadline}
                            onChange={(event) =>
                              updatePostForm('deadline', event.target.value)
                            }
                          />
                        </div>

                        <div className="org-form-group org-form-full">
                          <label>Eligibility Requirements *</label>
                          <textarea
                            rows={3}
                            value={postForm.eligibility}
                            onChange={(event) =>
                              updatePostForm('eligibility', event.target.value)
                            }
                            placeholder="Who can apply? Include qualifications and requirements."
                          />
                        </div>

                        <div className="org-form-section-heading org-form-full">
                          <span>03</span>
                          <div>
                            <strong>Application settings</strong>
                            <small>Choose how students apply and what they need to submit.</small>
                          </div>
                        </div>

                        <div className="org-form-group">
                          <label>Application Method</label>
                          <select
                            value={postForm.applicationMethod}
                            onChange={(event) =>
                              updatePostForm(
                                'applicationMethod',
                                event.target.value as PostForm['applicationMethod']
                              )
                            }
                          >
                            <option value="step-by-step">
                              Step-by-Step Online Application
                            </option>
                            <option value="direct">Direct Online Application</option>
                            <option value="external">External Application Link</option>
                          </select>
                        </div>

                        {postForm.applicationMethod === 'external' && (
                          <div className="org-form-group">
                            <label>External Application Link *</label>
                            <input
                              type="url"
                              value={postForm.externalApplicationUrl}
                              onChange={(event) =>
                                updatePostForm(
                                  'externalApplicationUrl',
                                  event.target.value
                                )
                              }
                              placeholder="https://example.gov.ph/apply"
                            />
                          </div>
                        )}

                        <div className="org-form-group org-form-full org-post-options">
                          <label className="org-post-option">
                            <input
                              type="checkbox"
                              checked={postForm.requireEligibilityAssessment}
                              onChange={(event) =>
                                updatePostForm(
                                  'requireEligibilityAssessment',
                                  event.target.checked
                                )
                              }
                            />
                            <span>Ask applicants to confirm they meet the eligibility criteria</span>
                          </label>
                          <label className="org-post-option">
                            <input
                              type="checkbox"
                              checked={postForm.requireDocumentSubmission}
                              onChange={(event) =>
                                updatePostForm(
                                  'requireDocumentSubmission',
                                  event.target.checked
                                )
                              }
                            />
                            <span>Require document submission</span>
                          </label>
                          <label className="org-post-option">
                            <input
                              type="checkbox"
                              checked={postForm.allowOptionalDocuments}
                              onChange={(event) =>
                                updatePostForm(
                                  'allowOptionalDocuments',
                                  event.target.checked
                                )
                              }
                            />
                            <span>Allow optional supporting documents</span>
                          </label>
                          <label className="org-post-option">
                            <input
                              type="checkbox"
                              checked={postForm.allowEditSubmittedApplication}
                              onChange={(event) =>
                                updatePostForm(
                                  'allowEditSubmittedApplication',
                                  event.target.checked
                                )
                              }
                            />
                            <span>Allow students to edit submitted applications</span>
                          </label>
                        </div>

                        {postForm.requireDocumentSubmission && (
                        <div className="org-form-group org-form-full">
                          <label>Documents Students Must Submit *</label>
                          <textarea
                            rows={5}
                            value={postForm.requiredDocuments}
                            onChange={(event) =>
                              updatePostForm(
                                'requiredDocuments',
                                event.target.value
                              )
                            }
                            placeholder={
                              'One document per line, for example:\nCertificate of Registration\nLatest grades\nProof of income'
                            }
                          />
                          <small className="org-field-hint">
                            {getRequiredDocumentNames(
                              postForm.requiredDocuments
                            ).length}
                            /{MAX_REQUIRED_DOCUMENTS} documents · Enter one
                            unique document per line. Students upload each item
                            step by step.
                          </small>
                        </div>
                        )}

                        <div className="org-form-group org-form-full">
                          <label>Contact Information</label>
                          <input
                            type="text"
                            value={postForm.contactInfo}
                            onChange={(event) =>
                              updatePostForm('contactInfo', event.target.value)
                            }
                            placeholder="Email address or contact number"
                          />
                        </div>
                      </>
                    )}

                    {/* POSTER UPLOAD */}

                    <div className="org-form-section-heading org-form-full">
                      <span>
                        {postForm.category === 'Scholarship Announcement' ||
                        postForm.category === 'Scholarship Update'
                          ? '04'
                          : '02'}
                      </span>
                      <div>
                        <strong>Post attachments</strong>
                        <small>Add an optional poster and downloadable forms.</small>
                      </div>
                    </div>

                    <div className="org-form-group org-form-full">
                      <label>Post Poster / Image</label>

                      <label className="org-file-upload">
                        <IonIcon icon={cloudUploadOutline} />
                        <span>
                          {posterFile
                            ? posterFile.name
                            : existingPosterUrl
                              ? 'Replace existing poster'
                              : 'Choose JPG, PNG, or WEBP image'}
                        </span>

                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePosterChange}
                        />
                      </label>

                      <small className="org-field-hint">
                        Maximum file size: 5 MB.
                      </small>

                      {posterFile && (
                        <div className="org-selected-file">
                          <IonIcon icon={imageOutline} />
                          <span>{posterFile.name}</span>

                          <button
                            type="button"
                            onClick={() => setPosterFile(null)}
                            aria-label="Remove poster"
                          >
                            <IonIcon icon={trashOutline} />
                          </button>
                        </div>
                      )}
                      {!posterFile && existingPosterUrl && (
                        <div className="org-selected-file">
                          <IonIcon icon={imageOutline} />
                          <span>Current poster is shown in the live preview.</span>
                          <button
                            type="button"
                            onClick={() => setExistingPosterUrl('')}
                            aria-label="Remove current poster"
                          >
                            <IonIcon icon={trashOutline} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* DOCUMENT UPLOAD */}

                    <div className="org-form-group org-form-full">
                      <label>Downloadable Forms and Documents</label>

                      <label className="org-file-upload">
                        <IonIcon icon={documentTextOutline} />
                        <span>
                          {existingDocuments.length + documentFiles.length >= MAX_DOWNLOADABLE_DOCUMENTS
                            ? 'Maximum number of documents reached'
                            : 'Select PDF files for Google Drive'}
                        </span>

                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          multiple
                          onChange={handleDocumentsChange}
                          disabled={
                            saving ||
                            uploading ||
                            existingDocuments.length + documentFiles.length >= MAX_DOWNLOADABLE_DOCUMENTS
                          }
                        />
                      </label>

                      <small className="org-field-hint">
                        {existingDocuments.length + documentFiles.length}/{MAX_DOWNLOADABLE_DOCUMENTS}{' '}
                        PDFs · Maximum 10 MB each. Files are stored in the
                        connected Google Drive and shared as viewer links so
                        students can preview and download them.
                      </small>

                      <div className="org-drive-connection">
                        <div>
                          <strong>
                            {driveConnected
                              ? 'Google Drive connected'
                              : 'Connect Google Drive to upload PDFs'}
                          </strong>
                          <small>
                            Anyone with the file link can view it. Do not upload
                            confidential documents.
                          </small>
                          {driveSetupMessage && (
                            <small className="org-drive-setup-error">
                              {driveSetupMessage}
                            </small>
                          )}
                        </div>
                        <button
                          type="button"
                          className="org-drive-connect-button"
                          onClick={handleConnectGoogleDrive}
                          disabled={!driveReady || driveConnecting}
                        >
                          {driveConnecting
                            ? 'Connecting...'
                            : driveConnected
                              ? 'Reconnect'
                              : driveReady
                                ? 'Connect Drive'
                                : 'Loading Drive...'}
                        </button>
                      </div>

                      {existingDocuments.length > 0 && (
                        <div className="org-selected-documents">
                          {existingDocuments.map((file, index) => (
                            <div
                              className="org-selected-file org-existing-document"
                              key={`${file.url}-${index}`}
                            >
                              <IonIcon icon={documentTextOutline} />
                              <span>
                                {file.name}
                                <small>Existing download · {file.category || 'Supporting document'}</small>
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setExistingDocuments((current) =>
                                    current.filter((_, fileIndex) => fileIndex !== index)
                                  )
                                }
                                aria-label={`Remove ${file.name}`}
                              >
                                <IonIcon icon={trashOutline} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {documentFiles.length > 0 && (
                        <div className="org-selected-documents">
                          {documentFiles.map((file, index) => (
                            <div
                              className="org-selected-file"
                              key={`${file.file.name}-${index}`}
                            >
                              <IonIcon icon={documentTextOutline} />

                              <span>
                                {file.file.name}
                                <small>
                                  {(file.file.size / (1024 * 1024)).toFixed(2)} MB
                                </small>
                              </span>

                              <button
                                type="button"
                                onClick={() => removeDocument(index)}
                                aria-label={`Remove ${file.file.name}`}
                              >
                                <IonIcon icon={trashOutline} />
                              </button>
                              <label className="org-document-metadata">
                                <span>Document category</span>
                                <select
                                  value={file.category}
                                  onChange={(event) =>
                                    updateDocument(index, 'category', event.target.value)
                                  }
                                >
                                  <option>Scholarship Application Form</option>
                                  <option>List of Requirements</option>
                                  <option>Scholarship Guidelines</option>
                                  <option>Certificate Forms</option>
                                  <option>Recommendation Letter Template</option>
                                  <option>Parental Consent Form</option>
                                  <option>Other Supporting Documents</option>
                                </select>
                              </label>
                              <label className="org-document-metadata">
                                <span>Document description</span>
                                <input
                                  type="text"
                                  value={file.description}
                                  maxLength={240}
                                  onChange={(event) =>
                                    updateDocument(index, 'description', event.target.value)
                                  }
                                  placeholder="What should students know about this file?"
                                />
                              </label>
                              <label className="org-post-option">
                                <input
                                  type="checkbox"
                                  checked={file.available}
                                  onChange={(event) =>
                                    updateDocument(index, 'available', event.target.checked)
                                  }
                                />
                                <span>Available for students to download</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="org-form-section-heading org-form-full">
                      <span>
                        {postForm.category === 'Scholarship Announcement' ||
                        postForm.category === 'Scholarship Update'
                          ? '05'
                          : '03'}
                      </span>
                      <div>
                        <strong>Post settings</strong>
                        <small>Control who can see and interact with this post.</small>
                      </div>
                    </div>

                    <div className="org-form-group">
                      <label>Post Visibility</label>
                      <select
                        value={postForm.visibility}
                        onChange={(event) =>
                          updatePostForm(
                            'visibility',
                            event.target.value as PostForm['visibility']
                          )
                        }
                      >
                        <option value="public">Public</option>
                        <option value="students">Students Only</option>
                      </select>
                    </div>

                    <div className="org-form-group">
                      <label>Schedule Post (optional)</label>
                      <input
                        type="datetime-local"
                        value={postForm.scheduledAt}
                        onChange={(event) =>
                          updatePostForm('scheduledAt', event.target.value)
                        }
                        min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                          .toISOString()
                          .slice(0, 16)}
                      />
                      <small className="org-field-hint">
                        Select a future date, then use Schedule Post below.
                      </small>
                    </div>

                    <div className="org-form-group org-form-full org-post-options">
                      <label className="org-post-option">
                        <input
                          type="checkbox"
                          checked={postForm.isPinned}
                          onChange={(event) =>
                            updatePostForm('isPinned', event.target.checked)
                          }
                        />
                        <span>Pin this post at the top of the student feed and profile</span>
                      </label>
                      <label className="org-post-option">
                        <input
                          type="checkbox"
                          checked={postForm.allowComments}
                          onChange={(event) =>
                            updatePostForm('allowComments', event.target.checked)
                          }
                        />
                        <span>Allow students to comment</span>
                      </label>
                      <label className="org-post-option">
                        <input
                          type="checkbox"
                          checked={postForm.allowReactions}
                          onChange={(event) =>
                            updatePostForm('allowReactions', event.target.checked)
                          }
                        />
                        <span>Allow student reactions</span>
                      </label>
                    </div>
                    </div>
                    </div>

                    <aside className="org-post-live-preview" aria-label="Live post preview">
                      <div className="org-post-preview-heading">
                        <span>LIVE PREVIEW</span>
                        <strong>{postForm.visibility === 'public' ? 'Public' : 'Students only'}</strong>
                      </div>
                      <article className="org-preview-card">
                        <header>
                          <img
                            src={profile.logoUrl || DEFAULT_LOGO}
                            alt=""
                            onError={(event) => {
                              event.currentTarget.src = DEFAULT_LOGO;
                            }}
                          />
                          <div>
                            <strong>{organizationName}</strong>
                            <span>{postForm.category} · Just now</span>
                          </div>
                        </header>
                        <h3>{postForm.title || 'Your post title'}</h3>
                        <p>{postForm.description || 'Your announcement preview will appear here as you write.'}</p>
                        {posterPreviewUrl && (
                          <img
                            className="org-preview-poster"
                            src={posterPreviewUrl}
                            alt="Post preview"
                          />
                        )}
                        {(postForm.category === 'Scholarship Announcement' ||
                          postForm.category === 'Scholarship Update') && (
                          <div className="org-preview-scholarship">
                            <span>₱{postForm.amount || 'Scholarship amount'}</span>
                            <span className={`org-preview-status ${postForm.applicationStatus}`}>
                              {postForm.applicationStatus}
                            </span>
                            <small>{postForm.deadline ? `Deadline ${postForm.deadline}` : 'Application deadline'}</small>
                          </div>
                        )}
                        <div className="org-preview-actions">
                          <span>♡ Like</span>
                          <span>◯ Comment</span>
                          <span>↗ Share</span>
                        </div>
                      </article>
                      <div className="org-preview-tip">
                        <strong>Before publishing</strong>
                        <p>Review dates, eligibility, and downloadable files. Students will see published posts in their feed.</p>
                      </div>
                    </aside>
                  </div>

                  <div className="org-post-notice">
                    <IonIcon icon={informationCircleOutline} />
                    <p>
                      Scholarship announcements are linked to your scholarship
                      listing and student feed. Publishing sends a notification
                      to every student's notification bell. Scheduled posts
                      publish at the selected time using the GrantAccess
                      scheduled-publishing function. Drafts stay private to
                      your organization.
                    </p>
                  </div>
                </div>

                <div className="org-modal-footer org-create-footer">
                  <button
                    type="button"
                    className="org-outline-button"
                    onClick={() => submitPost('draft')}
                    disabled={saving || uploading}
                  >
                    <IonIcon icon={saveOutline} />
                    Save Draft
                  </button>

                  <button
                    type="button"
                    className="org-outline-button"
                    onClick={() => submitPost('scheduled')}
                    disabled={saving || uploading || !postForm.scheduledAt}
                  >
                    <IonIcon icon={calendarOutline} />
                    Schedule Post
                  </button>

                  <button
                    type="button"
                    className="org-primary-button"
                    onClick={() => submitPost('published')}
                    disabled={saving || uploading}
                  >
                    {saving || uploading ? (
                      <>
                        <IonSpinner name="crescent" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <IonIcon icon={megaphoneOutline} />
                        Publish Post
                      </>
                    )}
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>

        <IonToast
          isOpen={toast.open}
          message={toast.message}
          color={toast.color}
          duration={3500}
          position="top"
          onDidDismiss={() =>
            setToast((previous) => ({
              ...previous,
              open: false,
            }))
          }
        />
      </IonContent>
    </IonPage>
  );
};

// ======================================================
// REUSABLE INFORMATION ITEM
// ======================================================

const InfoItem: React.FC<{
  icon: string;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="org-info-item">
    <div className="org-info-icon">
      <IonIcon icon={icon} />
    </div>

    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  </div>
);

export default LGUSchoolProfile;