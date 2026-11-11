import { useAppBack } from '../../hooks/useAppBack';
import { resolveDocumentUrl } from '../../utils/documentUrls';

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import {
  bookmark,
  bookmarkOutline,
  businessOutline,
  calendarOutline,
  cashOutline,
  chatbubbleEllipsesOutline,
  locationOutline,
  mailOutline,
  schoolOutline,
  shareSocialOutline,
} from 'ionicons/icons';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db } from '../../Firebase/config';
import StudentHeader from '../../components/StudentHeader';
import StudentBottomNav from '../../components/StudentBottomNav';
import StudentDocumentAccess from '../../components/StudentDocumentAccess';
import './OrganizationProfile.css';

interface Organization {
  id: string;
  name: string;
  type: string;
  description: string;
  address: string;
  email: string;
  contactNumber: string;
  representativeName: string;
  logo: string;
  cover: string;
}

interface DownloadableFile {
  name: string;
  url: string;
  category?: string;
  description?: string;
  available?: boolean;
  driveFileId?: string;
  previewUrl?: string;
  downloadUrl?: string;
  mimeType?: string;
  organizationName?: string;
}

interface Scholarship {
  id: string;
  title: string;
  category: string;
  description: string;
  eligibility: string;
  amount: string | number;
  deadline: string;
  applicationStart: string;
  applicationStatus: 'open' | 'closed' | 'upcoming';
  requiredDocuments: string[];
  attachments: DownloadableFile[];
  benefits: string;
  applicationMethod: string;
  externalApplicationUrl: string;
  requireEligibilityAssessment: boolean;
  requireDocumentSubmission: boolean;
  allowOptionalDocuments: boolean;
}

interface OrganizationPost {
  id: string;
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  attachments: DownloadableFile[];
  scholarshipId: string;
  isPinned: boolean;
  allowComments: boolean;
  allowReactions: boolean;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  visibility: 'public' | 'students';
  applicationStatus: 'open' | 'closed' | 'upcoming';
  amount: string | number;
  benefits: string;
  eligibility: string;
  requiredDocuments: string[];
  deadline: string;
  applicationMethod: string;
  externalApplicationUrl: string;
}

type ProfileTab = 'Posts' | 'Scholarships' | 'About';

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=85';

const DEFAULT_LOGO =
  'https://placehold.co/160x160/e7f4ed/24783b?text=LOGO';

const getText = (value: unknown, fallback = ''): string =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;

const getDocuments = (value: unknown): string[] => {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n/)
      : [];

  return Array.from(
    new Set(
      items
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 10);
};

const isWebUrl = (value: string): boolean => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};

const getAttachments = (value: unknown): DownloadableFile[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];

    const record = item as Record<string, unknown>;

    if (
      typeof record.name !== 'string' ||
      typeof record.url !== 'string' ||
      !resolveDocumentUrl(record.url)
    ) {
      return [];
    }

    return [{
      name: record.name,
      url: record.url,
      category: getText(record.category),
      description: getText(record.description),
      available: record.available !== false,
      driveFileId: getText(record.driveFileId),
      previewUrl: getText(record.previewUrl),
      downloadUrl: getText(record.downloadUrl),
      mimeType: getText(record.mimeType),
      organizationName: getText(record.organizationName),
    }];
  });
};

const mapScholarship = (
  id: string,
  data: DocumentData
): Scholarship => ({
  id,
  title: getText(data.title ?? data.name, 'Scholarship opportunity'),
  category: getText(data.category ?? data.type, 'Scholarship'),
  description: getText(data.description),
  eligibility: getText(data.eligibility),
  amount:
    typeof data.amount === 'string' || typeof data.amount === 'number'
      ? data.amount
      : 'Not specified',
  deadline: getText(data.deadline, 'Not specified'),
  applicationStart: getText(data.applicationStart),
  applicationStatus:
    ['open', 'closed', 'upcoming'].includes(
      String(data.applicationStatus ?? 'open').toLowerCase()
    )
      ? String(
          data.applicationStatus ?? 'open'
        ).toLowerCase() as Scholarship['applicationStatus']
      : 'open',
  requiredDocuments: getDocuments(data.requiredDocuments),
  attachments: getAttachments(data.attachments),
  benefits: getText(data.benefits),
  applicationMethod: getText(data.applicationMethod, 'step-by-step'),
  externalApplicationUrl: getText(data.externalApplicationUrl),
  requireEligibilityAssessment: data.requireEligibilityAssessment === true,
  requireDocumentSubmission: data.requireDocumentSubmission !== false,
  allowOptionalDocuments: data.allowOptionalDocuments === true,
});

const mapPost = (
  id: string,
  data: DocumentData
): OrganizationPost => ({
  id,
  title: getText(data.title, 'Organization update'),
  category: getText(data.category ?? data.postType, 'Announcement'),
  description: getText(data.description),
  imageUrl: getText(data.imageUrl),
  attachments: getAttachments(data.attachments),
  scholarshipId: getText(data.scholarshipId),
  isPinned: data.isPinned === true,
  allowComments: data.allowComments !== false,
  allowReactions: data.allowReactions !== false,
  reactionCount: Number(data.reactionCount || 0),
  commentCount: Number(data.commentCount || 0),
  shareCount: Number(data.shareCount || 0),
  visibility: data.visibility === 'students' ? 'students' : 'public',
  applicationStatus:
    ['open', 'closed', 'upcoming'].includes(
      String(data.applicationStatus ?? 'open').toLowerCase()
    )
      ? String(
          data.applicationStatus ?? 'open'
        ).toLowerCase() as OrganizationPost['applicationStatus']
      : 'open',
  amount:
    typeof data.amount === 'string' || typeof data.amount === 'number'
      ? data.amount
      : 'Not specified',
  benefits: getText(data.benefits),
  eligibility: getText(data.eligibility),
  requiredDocuments: getDocuments(data.requiredDocuments),
  deadline: getText(data.deadline),
  applicationMethod: getText(data.applicationMethod, 'step-by-step'),
  externalApplicationUrl: getText(data.externalApplicationUrl),
});

const formatAmount = (value: string | number): string => {
  const numericAmount = Number(value);

  return Number.isFinite(numericAmount)
    ? `₱${numericAmount.toLocaleString('en-PH')}`
    : String(value);
};

const getAvailability = (
  scholarship: Scholarship
): 'open' | 'closed' | 'upcoming' => {
  if (scholarship.applicationStatus === 'closed') return 'closed';
  if (scholarship.applicationStatus === 'upcoming') return 'upcoming';

  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(scholarship.applicationStart) &&
    scholarship.applicationStart > todayString
  ) {
    return 'upcoming';
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(scholarship.deadline) &&
    scholarship.deadline < todayString
  ) {
    return 'closed';
  }

  return 'open';
};

// =====================================================
// ORGANIZATION POST COMPONENT
// =====================================================

const OrganizationProfilePost: React.FC<{
  post: OrganizationPost;
  organization: Organization;
  onApply: (post: OrganizationPost) => void;
}> = ({ post, organization, onApply }) => {
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [reactionCount, setReactionCount] = useState(post.reactionCount);
  const [comments, setComments] = useState<
    { id: string; studentName: string; text: string }[]
  >([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Saved post and reaction listeners
  useEffect(() => {
    let unsubscribeSaved: (() => void) | undefined;
    let unsubscribeReaction: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeSaved?.();
      unsubscribeReaction?.();

      unsubscribeSaved = undefined;
      unsubscribeReaction = undefined;

      if (!user) {
        setSaved(false);
        setLiked(false);
        return;
      }

      const viewKey = `grantaccess-post-view:${user.uid}:${post.id}`;

      if (!sessionStorage.getItem(viewKey)) {
        sessionStorage.setItem(viewKey, '1');

        void updateDoc(doc(db, 'organizationPosts', post.id), {
          viewCount: increment(1),
        }).catch((viewError) => {
          sessionStorage.removeItem(viewKey);
          console.error(
            'Unable to record organization post view:',
            viewError
          );
        });
      }

      const savedPostPath = `savedPosts/${user.uid}_${post.id}`;

      unsubscribeSaved = onSnapshot(
        doc(db, 'savedPosts', `${user.uid}_${post.id}`),
        (snapshot) => {
          setSaved(snapshot.exists());
        },
        (error) => {
          console.error('Unable to load saved post state:', {
            code: error.code,
            message: error.message,
            documentPath: savedPostPath,
          });
        }
      );

      if (post.allowReactions) {
        unsubscribeReaction = onSnapshot(
          doc(db, 'organizationPosts', post.id, 'reactions', user.uid),
          (snapshot) => {
            setLiked(snapshot.exists());
          },
          (error) => {
            console.error('Unable to load post reaction:', {
              code: error.code,
              message: error.message,
            });
          }
        );
      } else {
        setLiked(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSaved?.();
      unsubscribeReaction?.();
    };
  }, [post.allowReactions, post.id]);

  useEffect(() => {
    setReactionCount(post.reactionCount);
  }, [post.reactionCount]);

  // Comments listener
  useEffect(() => {
    if (!commentsOpen || !post.allowComments) return;

    return onSnapshot(
      query(
        collection(db, 'organizationPosts', post.id, 'comments'),
        orderBy('createdAt', 'asc'),
        limit(50)
      ),
      (snapshot) => {
        setComments(
          snapshot.docs.map((item) => ({
            id: item.id,
            studentName: String(
              item.data().studentName || 'Student'
            ),
            text: String(item.data().text || ''),
          }))
        );
      },
      (error) => {
        console.error(
          'Unable to load organization post comments:',
          error.code,
          error.message
        );
        setFeedback('Comments could not be loaded. Please try again.');
      }
    );
  }, [commentsOpen, post.allowComments, post.id]);

  // Save or unsave post
  const toggleSaved = async () => {
    const user = auth.currentUser;

    if (!user) {
      setFeedback('Sign in to save this post.');
      return;
    }

    const savedRef = doc(
      db,
      'savedPosts',
      `${user.uid}_${post.id}`
    );

    try {
      if (saved) {
        await deleteDoc(savedRef);
      } else {
        await setDoc(savedRef, {
          studentId: user.uid,
          postId: post.id,
          organizationId: organization.id,
          title: post.title,
          provider: organization.name,
          category: post.category,
          description: post.description,
          imageUrl: post.imageUrl,
          savedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Unable to save organization post:', error);
      setFeedback('Unable to save this post. Please try again.');
    }
  };

  // Like or unlike post
  const toggleReaction = async () => {
    const user = auth.currentUser;

    if (!user) {
      setFeedback('Sign in to react to this post.');
      return;
    }

    const postRef = doc(db, 'organizationPosts', post.id);
    const reactionRef = doc(
      db,
      'organizationPosts',
      post.id,
      'reactions',
      user.uid
    );

    try {
      const newCount = await runTransaction(db, async (transaction) => {
        const [postSnapshot, reactionSnapshot] = await Promise.all([
          transaction.get(postRef),
          transaction.get(reactionRef),
        ]);

        if (!postSnapshot.exists()) {
          throw new Error('This post is no longer available.');
        }

        const count = Number(
          postSnapshot.data().reactionCount || 0
        );

        if (reactionSnapshot.exists()) {
          transaction.delete(reactionRef);

          transaction.update(postRef, {
            reactionCount: Math.max(0, count - 1),
          });

          return Math.max(0, count - 1);
        }

        transaction.set(reactionRef, {
          studentId: user.uid,
          createdAt: serverTimestamp(),
        });

        transaction.update(postRef, {
          reactionCount: count + 1,
        });

        return count + 1;
      });

      setLiked((current) => !current);
      setReactionCount(newCount);
    } catch (error) {
      console.error('Unable to react to organization post:', error);
      setFeedback('Your reaction could not be saved. Please try again.');
    }
  };

  // Submit comment
  const submitComment = async () => {
    const user = auth.currentUser;
    const text = comment.trim();

    if (!user || !text || text.length > 1000 || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const studentSnapshot = await getDoc(
        doc(db, 'students', user.uid)
      );

      const studentData = studentSnapshot.exists()
        ? studentSnapshot.data()
        : {};

      const batch = writeBatch(db);

      const commentRef = doc(
        collection(db, 'organizationPosts', post.id, 'comments')
      );

      batch.set(commentRef, {
        studentId: user.uid,
        studentName:
          studentData.fullName ||
          studentData.name ||
          user.displayName ||
          'Student',
        text,
        createdAt: serverTimestamp(),
      });

      batch.update(
        doc(db, 'organizationPosts', post.id),
        {
          commentCount: increment(1),
        }
      );

      await batch.commit();

      setComment('');
      setFeedback('');
    } catch (error) {
      console.error('Unable to comment on organization post:', error);
      setFeedback('Your comment could not be posted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Share post
  const sharePost = async () => {
    const postUrl = `${window.location.origin}/organization-profile/${encodeURIComponent(
      organization.id
    )}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.description,
          url: postUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(postUrl);
        setFeedback('Post link copied.');
      } else {
        setFeedback('Sharing is not available in this browser.');
        return;
      }

      await updateDoc(
        doc(db, 'organizationPosts', post.id),
        {
          shareCount: increment(1),
        }
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      console.error('Unable to share organization post:', error);
      setFeedback('Unable to share this post. Please try again.');
    }
  };

  return (
    <article className="public-organization-post">
      <header className="public-post-author">
        <img
          src={organization.logo || DEFAULT_LOGO}
          alt=""
        />

        <div>
          <strong>{organization.name}</strong>
          <span>
            {post.category}
            {post.isPinned ? ' · Pinned' : ''}
          </span>
        </div>
      </header>

      <h3>{post.title}</h3>
      <p>{post.description}</p>

      {post.imageUrl && (
        <img
          className="public-post-image"
          src={post.imageUrl}
          alt=""
        />
      )}

      {(post.category === 'Scholarship Announcement' ||
        post.category === 'Scholarship Update') && (
        <div className="public-post-scholarship">
          {post.amount !== 'Not specified' && (
            <p>
              <strong>Amount:</strong> {formatAmount(post.amount)}
            </p>
          )}

          {post.benefits && (
            <p>
              <strong>Benefits:</strong> {post.benefits}
            </p>
          )}

          {post.eligibility && (
            <p>
              <strong>Eligibility:</strong> {post.eligibility}
            </p>
          )}

          {post.requiredDocuments.length > 0 && (
            <p>
              <strong>Requirements:</strong>{' '}
              {post.requiredDocuments.join(' · ')}
            </p>
          )}

          {post.deadline && (
            <p>
              <strong>Deadline:</strong> {post.deadline}
            </p>
          )}
        </div>
      )}

      {post.attachments
        .filter((file) => file.available !== false)
        .map((file, index) => (
          <StudentDocumentAccess
            key={`${file.url}-${index}`}
            document={file}
          />
        ))}

      <div className="public-post-actions">
        {post.allowReactions && (
          <button
            type="button"
            aria-pressed={liked}
            onClick={() => void toggleReaction()}
          >
            {liked ? 'Liked' : 'Like'} · {reactionCount}
          </button>
        )}

        {post.allowComments && (
          <button
            type="button"
            aria-expanded={commentsOpen}
            onClick={() => setCommentsOpen((open) => !open)}
          >
            {commentsOpen ? 'Hide comments' : 'Comment'}
          </button>
        )}

        <button
          type="button"
          aria-pressed={saved}
          onClick={() => void toggleSaved()}
        >
          {saved ? 'Saved' : 'Save'}
        </button>

        <button
          type="button"
          onClick={() => void sharePost()}
        >
          <IonIcon icon={shareSocialOutline} />
          Share
        </button>

        {post.scholarshipId && (
          <button
            type="button"
            onClick={() => onApply(post)}
            disabled={
              post.applicationStatus !== 'open' ||
              (post.applicationMethod === 'external' &&
                !isWebUrl(post.externalApplicationUrl))
            }
          >
            {post.applicationMethod === 'external'
              ? isWebUrl(post.externalApplicationUrl)
                ? 'Apply externally'
                : 'Application link unavailable'
              : 'Apply'}
          </button>
        )}
      </div>

      {commentsOpen && post.allowComments && (
        <div className="public-post-comments">
          {comments.map((item) => (
            <p key={item.id}>
              <strong>{item.studentName}</strong> {item.text}
            </p>
          ))}

          {comments.length === 0 && (
            <p>Start the conversation.</p>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitComment();
            }}
          >
            <input
              value={comment}
              maxLength={1000}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Write a comment..."
              aria-label={`Comment on ${post.title}`}
            />

            <button
              type="submit"
              disabled={!comment.trim() || submitting}
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </form>
        </div>
      )}

      {feedback && (
        <p className="public-post-feedback" role="status">
          {feedback}
        </p>
      )}
    </article>
  );
};

// =====================================================
// ORGANIZATION PROFILE PAGE
// =====================================================

const OrganizationProfile: React.FC = () => {
  const goBack = useAppBack();
  const { organizationId = '' } = useParams<{
    organizationId: string;
  }>();

  const navigate = useNavigate();

  const [studentId, setStudentId] = useState('');
  const [organization, setOrganization] =
    useState<Organization | null>(null);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [posts, setPosts] = useState<OrganizationPost[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<ProfileTab>('Posts');
  const [saving, setSaving] = useState(false);
  const [following, setFollowing] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    message: '',
  });

  const showToast = (message: string) => {
    setToast({ open: true, message });
  };

  // ===================================================
  // FIRESTORE LISTENERS
  // ===================================================

  useEffect(() => {
    let active = true;

    let unsubscribeOrganization: (() => void) | undefined;
    let unsubscribeScholarships: (() => void) | undefined;
    let unsubscribePosts: (() => void) | undefined;
    let unsubscribeSaved: (() => void) | undefined;
    let unsubscribeFollow: (() => void) | undefined;

    let loadedOrganization = false;
    let loadedScholarships = false;
    let loadedPosts = false;

    const updateLoading = () => {
      if (
        active &&
        loadedOrganization &&
        loadedScholarships &&
        loadedPosts
      ) {
        setLoading(false);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Remove previous listeners
      unsubscribeOrganization?.();
      unsubscribeScholarships?.();
      unsubscribePosts?.();
      unsubscribeSaved?.();
      unsubscribeFollow?.();

      unsubscribeOrganization = undefined;
      unsubscribeScholarships = undefined;
      unsubscribePosts = undefined;
      unsubscribeSaved = undefined;
      unsubscribeFollow = undefined;

      if (!user) {
        setStudentId('');
        setOrganization(null);
        setScholarships([]);
        setPosts([]);
        setSaved(false);
        setFollowing(false);
        setLoading(false);

        navigate('/login', { replace: true });
        return;
      }

      if (!organizationId) {
        setError('This organization profile could not be found.');
        setLoading(false);
        return;
      }

      setStudentId(user.uid);
      setError('');
      setLoading(true);

      loadedOrganization = false;
      loadedScholarships = false;
      loadedPosts = false;

      // -----------------------------------------------
      // ORGANIZATION PROFILE
      // -----------------------------------------------

      unsubscribeOrganization = onSnapshot(
        doc(db, 'organizations', organizationId),
        (snapshot) => {
          if (!active) return;

          if (!snapshot.exists()) {
            setOrganization(null);
            setError('This organization profile could not be found.');
          } else {
            const data = snapshot.data();

            setOrganization({
              id: snapshot.id,
              name: getText(
                data.organizationName ?? data.name,
                'Organization'
              ),
              type: getText(
                data.organizationType ?? data.type,
                'LGU / School'
              ),
              description: getText(data.description),
              address: getText(data.address ?? data.location),
              email: getText(
                data.organizationEmail ?? data.email
              ),
              contactNumber: getText(data.contactNumber),
              representativeName: getText(
                data.representativeName
              ),
              logo: getText(data.logoUrl ?? data.logo),
              cover: getText(data.coverPhotoUrl),
            });
          }

          loadedOrganization = true;
          updateLoading();
        },
        (snapshotError) => {
          if (!active) return;

          console.error(
            'Unable to load organization profile:',
            snapshotError.code,
            snapshotError.message
          );

          setError(
            'Unable to load this organization profile. Please try again.'
          );
          setLoading(false);
        }
      );

      // -----------------------------------------------
      // PUBLISHED SCHOLARSHIPS
      // -----------------------------------------------

      unsubscribeScholarships = onSnapshot(
        query(
          collection(db, 'scholarships'),
          where('organizationId', '==', organizationId),
          where('status', '==', 'published')
        ),
        (snapshot) => {
          if (!active) return;

          setScholarships(
            snapshot.docs.map((item) =>
              mapScholarship(item.id, item.data())
            )
          );

          loadedScholarships = true;
          updateLoading();
        },
        (snapshotError) => {
          if (!active) return;

          console.error(
            'Unable to load organization scholarships:',
            snapshotError.code,
            snapshotError.message
          );

          setError(
            'Unable to load this organization’s opportunities.'
          );
          setLoading(false);
        }
      );

      // -----------------------------------------------
      // PUBLISHED ORGANIZATION POSTS
      // -----------------------------------------------

      unsubscribePosts = onSnapshot(
        query(
          collection(db, 'organizationPosts'),
          where('organizationId', '==', organizationId),
          where('status', '==', 'published')
        ),
        (snapshot) => {
          if (!active) return;

          setPosts(
            snapshot.docs
              .map((item) => mapPost(item.id, item.data()))
              .sort(
                (left, right) =>
                  Number(right.isPinned) - Number(left.isPinned)
              )
          );

          loadedPosts = true;
          updateLoading();
        },
        (snapshotError) => {
          if (!active) return;

          console.error(
            'Unable to load organization updates:',
            snapshotError.code,
            snapshotError.message
          );

          setError(
            'Unable to load this organization’s updates.'
          );
          setLoading(false);
        }
      );

      // -----------------------------------------------
      // SAVED ORGANIZATION
      // -----------------------------------------------

      unsubscribeSaved = onSnapshot(
        doc(
          db,
          'savedOrganizations',
          `${user.uid}_${organizationId}`
        ),
        (snapshot) => {
          if (active) {
            setSaved(snapshot.exists());
          }
        },
        (snapshotError) => {
          console.error(
            'Unable to load saved organization state:',
            snapshotError.code,
            snapshotError.message
          );
        }
      );

      // -----------------------------------------------
      // ORGANIZATION FOLLOW
      // -----------------------------------------------

      unsubscribeFollow = onSnapshot(
        doc(
          db,
          'organizationFollows',
          `${organizationId}_${user.uid}`
        ),
        (snapshot) => {
          if (active) {
            setFollowing(snapshot.exists());
          }
        },
        (snapshotError) => {
          console.error(
            'Unable to load organization follow state:',
            snapshotError.code,
            snapshotError.message
          );
        }
      );
    });

    return () => {
      active = false;

      unsubscribeAuth();
      unsubscribeOrganization?.();
      unsubscribeScholarships?.();
      unsubscribePosts?.();
      unsubscribeSaved?.();
      unsubscribeFollow?.();
    };
  }, [navigate, organizationId]);

  // ===================================================
  // SCHOLARSHIP FILTER
  // ===================================================

  const openScholarships = useMemo(
    () =>
      scholarships.filter(
        (item) => getAvailability(item) === 'open'
      ),
    [scholarships]
  );

  // ===================================================
  // SAVE ORGANIZATION
  // ===================================================

  const toggleSaved = async () => {
    if (!studentId || !organization) {
      showToast('Sign in to save this organization.');
      return;
    }

    setSaving(true);

    const savedRef = doc(
      db,
      'savedOrganizations',
      `${studentId}_${organization.id}`
    );

    try {
      if (saved) {
        await deleteDoc(savedRef);
        showToast('Organization removed from saved.');
      } else {
        await setDoc(savedRef, {
          studentId,
          organizationId: organization.id,
          organizationName: organization.name,
          organizationType: organization.type,
          logoUrl: organization.logo,
          savedAt: serverTimestamp(),
        });

        showToast('Organization saved.');
      }
    } catch (saveError) {
      console.error(
        'Unable to save organization:',
        saveError
      );

      showToast(
        'Unable to save this organization. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ===================================================
  // FOLLOW ORGANIZATION
  // ===================================================

  const toggleFollow = async () => {
    if (!studentId || !organization) {
      showToast('Sign in to follow this organization.');
      return;
    }

    const followRef = doc(
      db,
      'organizationFollows',
      `${organization.id}_${studentId}`
    );

    try {
      if (following) {
        await deleteDoc(followRef);
      } else {
        await setDoc(followRef, {
          studentId,
          organizationId: organization.id,
          organizationName: organization.name,
          followedAt: serverTimestamp(),
        });
      }
    } catch (followError) {
      console.error(
        'Unable to update organization follow state:',
        followError
      );

      showToast(
        'Unable to update your follow settings. Please try again.'
      );
    }
  };

  // ===================================================
  // MESSAGE ORGANIZATION
  // ===================================================

  const contactOrganization = () => {
    if (!organization) return;

    navigate('/student-messages', {
      state: {
        openOrganization: {
          id: organization.id,
          name: organization.name,
          type: organization.type,
          location: organization.address,
          logo: organization.logo,
        },
      },
    });
  };

  // ===================================================
  // APPLY FOR SCHOLARSHIP
  // ===================================================

  const applyFor = (scholarship: Scholarship) => {
    if (getAvailability(scholarship) !== 'open') {
      return;
    }

    if (scholarship.applicationMethod === 'external') {
      if (!isWebUrl(scholarship.externalApplicationUrl)) {
        showToast(
          'This organization has not provided a valid application link.'
        );
        return;
      }

      window.open(
        scholarship.externalApplicationUrl,
        '_blank',
        'noopener,noreferrer'
      );

      return;
    }

    navigate(
      `/application?scholarshipId=${encodeURIComponent(
        scholarship.id
      )}`
    );
  };

  const applyForPost = (post: OrganizationPost) => {
    if (post.applicationStatus !== 'open') {
      return;
    }

    if (post.applicationMethod === 'external') {
      if (!isWebUrl(post.externalApplicationUrl)) {
        showToast(
          'This organization has not provided a valid application link.'
        );
        return;
      }

      window.open(
        post.externalApplicationUrl,
        '_blank',
        'noopener,noreferrer'
      );

      return;
    }

    if (post.scholarshipId) {
      navigate(
        `/application?scholarshipId=${encodeURIComponent(
          post.scholarshipId
        )}`
      );
    }
  };

  // ===================================================
  // PAGE UI
  // ===================================================

  return (
    <IonPage className="public-organization-page">
      <StudentHeader />

      <IonContent className="public-organization-content">
        <main className="public-organization-layout">
          <button
            type="button"
            className="public-organization-back app-back-control"
            onClick={goBack}
          >
            Back
          </button>

          {loading ? (
            <div className="public-organization-loading">
              <IonSpinner name="crescent" />
              <span>Loading organization profile...</span>
            </div>
          ) : error || !organization ? (
            <section
              className="public-organization-error"
              role="alert"
            >
              <h1>Profile unavailable</h1>
              <p>
                {error ||
                  'This organization profile could not be found.'}
              </p>
            </section>
          ) : (
            <>
              {/* ORGANIZATION HEADER */}

              <section className="public-organization-card">
                <div
                  className="public-organization-cover"
                  style={{
                    backgroundImage: `linear-gradient(90deg, rgba(13, 46, 26, .78), rgba(13, 46, 26, .14)), url("${organization.cover || DEFAULT_COVER}")`,
                  }}
                  role="img"
                  aria-label={`${organization.name} cover photo`}
                >
                  <span className="public-organization-cover-label">
                    OFFICIAL ORGANIZATION PROFILE
                  </span>
                </div>

                <div className="public-organization-summary">
                  <img
                    className="public-organization-logo"
                    src={organization.logo || DEFAULT_LOGO}
                    alt={`${organization.name} logo`}
                    onError={(event) => {
                      event.currentTarget.src = DEFAULT_LOGO;
                    }}
                  />

                  <div className="public-organization-identity">
                    <span className="public-organization-type">
                      {organization.type}
                    </span>

                    <h1>{organization.name}</h1>

                    <p>
                      <IonIcon icon={locationOutline} />
                      {organization.address ||
                        'Location not provided'}
                    </p>

                    {organization.description && (
                      <p className="public-organization-description">
                        {organization.description}
                      </p>
                    )}
                  </div>

                  <div className="public-organization-actions">
                    <button
                      type="button"
                      className="public-organization-follow"
                      onClick={() => void toggleFollow()}
                      aria-pressed={following}
                    >
                      {following ? 'Following' : 'Follow'}
                    </button>

                    <button
                      type="button"
                      className="public-organization-save"
                      onClick={() => void toggleSaved()}
                      disabled={saving}
                      aria-pressed={saved}
                    >
                      <IonIcon
                        icon={saved ? bookmark : bookmarkOutline}
                      />
                      {saving
                        ? 'Saving...'
                        : saved
                          ? 'Saved'
                          : 'Save'}
                    </button>

                    <button
                      type="button"
                      className="public-organization-message"
                      onClick={contactOrganization}
                    >
                      <IonIcon icon={chatbubbleEllipsesOutline} />
                      Message
                    </button>
                  </div>
                </div>

                {/* PROFILE TABS */}

                <div
                  className="public-organization-tabs"
                  role="tablist"
                >
                  {(
                    ['Posts', 'Scholarships', 'About'] as ProfileTab[]
                  ).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      className={
                        activeTab === tab ? 'active' : ''
                      }
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}

                      <span>
                        {tab === 'Posts'
                          ? posts.length
                          : tab === 'Scholarships'
                            ? scholarships.length
                            : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* SCHOLARSHIPS TAB */}

              {activeTab === 'Scholarships' && (
                <section className="public-organization-section">
                  <header className="public-organization-section-heading">
                    <div>
                      <h2>Scholarship opportunities</h2>
                      <p>
                        Review eligibility and required documents
                        before you apply.
                      </p>
                    </div>

                    <strong>
                      {openScholarships.length} accepting applications
                    </strong>
                  </header>

                  {scholarships.length === 0 ? (
                    <div className="public-organization-empty">
                      <IonIcon icon={schoolOutline} />
                      <h3>No published scholarships yet</h3>
                      <p>
                        Check back later for new opportunities
                        from this organization.
                      </p>
                    </div>
                  ) : (
                    <div className="public-organization-scholarships">
                      {scholarships.map((scholarship) => {
                        const availability =
                          getAvailability(scholarship);

                        return (
                          <article
                            className="public-scholarship-card"
                            key={scholarship.id}
                          >
                            <div className="public-scholarship-top">
                              <span>
                                {scholarship.category}
                              </span>

                              <strong className={availability}>
                                {availability === 'open'
                                  ? 'Applications open'
                                  : availability === 'upcoming'
                                    ? `Opens ${scholarship.applicationStart}`
                                    : 'Applications closed'}
                              </strong>
                            </div>

                            <h3>{scholarship.title}</h3>

                            <p className="public-scholarship-description">
                              {scholarship.description ||
                                'Details will be provided by the organization.'}
                            </p>

                            <div className="public-scholarship-meta">
                              <span>
                                <IonIcon icon={cashOutline} />
                                {formatAmount(scholarship.amount)}
                              </span>

                              <span>
                                <IonIcon icon={calendarOutline} />
                                Deadline: {scholarship.deadline}
                              </span>
                            </div>

                            {scholarship.eligibility && (
                              <p className="public-scholarship-eligibility">
                                <strong>Eligibility:</strong>{' '}
                                {scholarship.eligibility}
                              </p>
                            )}

                            {scholarship.requiredDocuments.length > 0 && (
                              <div className="public-scholarship-requirements">
                                <strong>Required documents</strong>

                                <ul>
                                  {scholarship.requiredDocuments.map(
                                    (requirement) => (
                                      <li key={requirement}>
                                        {requirement}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                            {scholarship.benefits && (
                              <p className="public-scholarship-eligibility">
                                <strong>Benefits:</strong>{' '}
                                {scholarship.benefits}
                              </p>
                            )}

                            {scholarship.attachments.some(
                              (file) => file.available !== false
                            ) && (
                              <div className="public-organization-downloads">
                                {scholarship.attachments
                                  .filter(
                                    (file) =>
                                      file.available !== false
                                  )
                                  .map((file, index) => (
                                    <StudentDocumentAccess
                                      key={`${file.url}-${index}`}
                                      document={file}
                                    />
                                  ))}
                              </div>
                            )}

                            {scholarship.requireEligibilityAssessment && (
                              <p className="public-scholarship-eligibility">
                                Applicants confirm eligibility during
                                application.
                              </p>
                            )}

                            {scholarship.applicationMethod === 'direct' && (
                              <p className="public-scholarship-eligibility">
                                Direct online application
                              </p>
                            )}

                            {scholarship.allowOptionalDocuments && (
                              <p className="public-scholarship-eligibility">
                                Optional supporting documents accepted
                              </p>
                            )}

                            <button
                              type="button"
                              className="public-scholarship-apply"
                              disabled={
                                availability !== 'open' ||
                                (scholarship.applicationMethod ===
                                  'external' &&
                                  !isWebUrl(
                                    scholarship.externalApplicationUrl
                                  ))
                              }
                              onClick={() => applyFor(scholarship)}
                            >
                              {scholarship.applicationMethod ===
                                'external' &&
                              !isWebUrl(
                                scholarship.externalApplicationUrl
                              )
                                ? 'Application link unavailable'
                                : availability === 'open'
                                  ? 'Apply now'
                                  : availability === 'upcoming'
                                    ? 'Applications not open yet'
                                    : 'Applications closed'}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* POSTS TAB */}

              {activeTab === 'Posts' && (
                <section className="public-organization-section">
                  <header className="public-organization-section-heading">
                    <div>
                      <h2>Latest updates</h2>
                      <p>
                        Announcements and news shared by{' '}
                        {organization.name}.
                      </p>
                    </div>
                  </header>

                  {posts.length === 0 ? (
                    <div className="public-organization-empty">
                      <IonIcon icon={businessOutline} />
                      <h3>No published updates yet</h3>
                    </div>
                  ) : (
                    <div className="public-organization-posts">
                      {posts.map((post) => (
                        <OrganizationProfilePost
                          key={post.id}
                          post={post}
                          organization={organization}
                          onApply={applyForPost}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ABOUT TAB */}

              {activeTab === 'About' && (
                <section className="public-organization-section public-organization-about">
                  <h2>About {organization.name}</h2>

                  <p>
                    {organization.description ||
                      'No description provided.'}
                  </p>

                  <div className="public-organization-contact">
                    {organization.address && (
                      <p>
                        <IonIcon icon={locationOutline} />
                        {organization.address}
                      </p>
                    )}

                    {organization.email && (
                      <a href={`mailto:${organization.email}`}>
                        <IonIcon icon={mailOutline} />
                        {organization.email}
                      </a>
                    )}

                    {organization.contactNumber && (
                      <a href={`tel:${organization.contactNumber}`}>
                        <IonIcon icon={chatbubbleEllipsesOutline} />
                        {organization.contactNumber}
                      </a>
                    )}

                    {organization.representativeName && (
                      <p>
                        <IonIcon icon={businessOutline} />
                        {organization.representativeName}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    className="public-organization-message"
                    onClick={contactOrganization}
                  >
                    <IonIcon icon={chatbubbleEllipsesOutline} />
                    Message this organization
                  </button>
                </section>
              )}
            </>
          )}
        </main>
      </IonContent>

      <StudentBottomNav />

      <IonToast
        isOpen={toast.open}
        message={toast.message}
        duration={2600}
        position="bottom"
        onDidDismiss={() =>
          setToast({ open: false, message: '' })
        }
      />
    </IonPage>
  );
};

export default OrganizationProfile;
