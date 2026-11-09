
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  IonAvatar,
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';

import {
  addOutline,
  arrowBackOutline,
  chatbubblesOutline,
  checkmarkDoneOutline,
  closeOutline,
  paperPlaneOutline,
  schoolOutline,
  searchOutline,
} from 'ionicons/icons';

import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';

import {
  collection,
  onSnapshot,
} from 'firebase/firestore';

import { auth, db } from '../../Firebase/config';

import {
  type Conversation,
  type ChatMessage,
  getConversationId,
  sendMessage,
  subscribeToConversations,
  subscribeToMessages,
  markConversationAsRead,
} from '../../services/messagingService';

import StudentHeader from '../../components/StudentHeader';
import StudentBottomNav from '../../components/StudentBottomNav';

import './Messages.css';

interface Organization {
  id: string;
  name: string;
  type: string;
  location: string;
  logo: string;
}

interface MessagesLocationState {
  openOrganization?: Organization;
}

interface RawOrganization {
  [key: string]: unknown;
}

// ==========================================
// ORGANIZATION HELPERS
// ==========================================

const normalizeKey = (value: unknown): string => {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const normalizeOrganizationName = (value: unknown): string => {
  const original = String(value ?? '').trim();
  const normalized = normalizeKey(original);

  if (
    normalized === 'minsu' ||
    normalized === 'minsumain' ||
    normalized === 'mindorostateuniversity'
  ) {
    return 'Mindoro State University';
  }

  return original || 'Organization';
};

const isMindoroStateUniversity = (value: unknown): boolean => {
  const normalized = normalizeKey(value);

  return (
    normalized === 'minsu' ||
    normalized === 'minsumain' ||
    normalized === 'mindorostateuniversity'
  );
};

const getString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const getNestedData = (
  data: RawOrganization,
  key: string
): RawOrganization => {
  const value = data[key];

  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as RawOrganization;
  }

  return {};
};

const getImageUrl = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const imageObject = value as Record<string, unknown>;

      const possibleUrl = getString(
        imageObject.url,
        imageObject.downloadURL,
        imageObject.downloadUrl,
        imageObject.imageUrl,
        imageObject.logoUrl
      );

      if (possibleUrl) return possibleUrl;
    }
  }

  return '';
};

const mapOrganization = (
  id: string,
  data: RawOrganization
): Organization => {
  const organization = getNestedData(data, 'organization');
  const profile = getNestedData(data, 'profile');
  const details = getNestedData(data, 'details');
  const basicInfo = getNestedData(data, 'basicInfo');
  const organizationInfo = getNestedData(data, 'organizationInfo');
  const userProfile = getNestedData(data, 'userProfile');

  const nameCandidates = [
    data.organizationName,
    data.orgName,
    data.schoolName,
    data.organization_name,
    data.school,
    data.rawName,
    organization.organizationName,
    organization.orgName,
    organization.name,
    profile.organizationName,
    profile.orgName,
    details.organizationName,
    basicInfo.organizationName,
    organizationInfo.organizationName,
    organizationInfo.name,
    userProfile.organizationName,
    data.name,
    data.displayName,
    data.accountName,
    data.fullName,
  ];

  const minsuName = nameCandidates.find((value) =>
    isMindoroStateUniversity(value)
  );

  const rawName = minsuName
    ? String(minsuName)
    : getString(...nameCandidates);

  const type = getString(
    data.organizationType,
    data.accountType,
    data.organizationCategory,
    data.type,
    organization.type,
    profile.organizationType,
    data.role,
    'LGU / School'
  );

  const location = getString(
    data.organizationAddress,
    data.schoolAddress,
    data.address,
    data.location,
    organization.address,
    profile.address,
    details.address,
    basicInfo.address,
    organizationInfo.address
  );

  const logo = getImageUrl(
    data.logoUrl,
    data.logoURL,
    data.logo,
    data.organizationLogo,
    data.organizationLogoUrl,
    data.schoolLogo,
    data.schoolLogoUrl,
    data.profileImage,
    data.profileImageUrl,
    data.profileImageURL,
    data.profilePicture,
    data.profilePictureUrl,
    data.photoURL,
    data.photoUrl,
    data.imageUrl,
    data.imageURL,
    data.avatar,
    data.avatarUrl,
    organization.logoUrl,
    organization.logoURL,
    organization.logo,
    organization.profileImage,
    organization.profilePicture,
    organization.photoURL,
    organization.imageUrl,
    profile.logoUrl,
    profile.logoURL,
    profile.logo,
    profile.profileImage,
    profile.profileImageUrl,
    profile.profilePicture,
    profile.photoURL,
    profile.photoUrl,
    profile.imageUrl,
    profile.avatar,
    details.logoUrl,
    details.profileImage,
    basicInfo.logoUrl,
    basicInfo.profileImage,
    organizationInfo.logoUrl,
    organizationInfo.profileImage,
    organizationInfo.profilePicture,
    userProfile.logoUrl,
    userProfile.profileImage,
    userProfile.photoURL,
    userProfile.avatar
  );

  return {
    id,
    name: normalizeOrganizationName(rawName),
    type,
    location,
    logo,
  };
};

// ==========================================
// MESSAGES COMPONENT
// ==========================================

const Messages: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const chatContentRef = useRef<HTMLIonContentElement | null>(null);
  const openedOrganizationRef = useRef('');

  const [userId, setUserId] = useState('');
  const [studentName, setStudentName] = useState('Student');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);

  const [messageInput, setMessageInput] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [organizationSearch, setOrganizationSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [showOrganizationModal, setShowOrganizationModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showMessageToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  const getErrorInfo = (error: unknown) => {
    const errorObject =
      typeof error === 'object' && error !== null
        ? (error as { code?: string; message?: string })
        : {};

    return {
      code: errorObject.code ?? 'unknown',
      message:
        errorObject.message ??
        (error instanceof Error ? error.message : 'Unknown error'),
    };
  };

  // ==========================================
  // ORGANIZATION PROFILE HELPERS
  // ==========================================

  const getOrganizationById = (organizationId: string) => {
    return organizations.find(
      (organization) => organization.id === organizationId
    );
  };

  const getOrganizationLogo = (organizationId: string): string => {
    return getOrganizationById(organizationId)?.logo || '';
  };

  const getOrganizationDisplayName = (
    organizationId: string,
    fallbackName: string
  ): string => {
    return (
      getOrganizationById(organizationId)?.name ||
      normalizeOrganizationName(fallbackName)
    );
  };

  // ==========================================
  // AUTHENTICATION AND CONVERSATIONS
  // ==========================================

  useEffect(() => {
    let unsubscribeConversations: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeConversations?.();
      unsubscribeConversations = undefined;

      if (!user) {
        setUserId('');
        setStudentName('Student');
        setConversations([]);
        setMessages([]);
        setOrganizations([]);
        setActiveConversation(null);
        setLoading(false);

        navigate('/login', { replace: true });
        return;
      }

      setUserId(user.uid);
      setStudentName(user.displayName || user.email || 'Student');

      setConversations([]);
      setMessages([]);
      setActiveConversation(null);
      setLoading(true);

      unsubscribeConversations = subscribeToConversations(
        user.uid,
        'student',
        (items) => {
          setConversations(items);
          setLoading(false);
        },
        (error) => {
          console.error('Conversation loading error:', error);
          setLoading(false);

          showMessageToast(
            'Unable to load conversations. Check Firestore permissions.'
          );
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeConversations?.();
    };
  }, [navigate]);

  // ==========================================
  // LOAD REGISTERED ORGANIZATIONS
  // ==========================================

  useEffect(() => {
    if (!userId) {
      setOrganizations([]);
      setOrganizationsLoading(false);
      return;
    }

    setOrganizationsLoading(true);

    const unsubscribe = onSnapshot(
      collection(db, 'organizations'),
      (snapshot) => {
        const mappedItems: Organization[] = snapshot.docs.map((document) => {
          const data = document.data() as RawOrganization;
          return mapOrganization(document.id, data);
        });

        const validOrganizations = mappedItems.filter(
          (organization) => organization.id.trim() !== ''
        );

        const uniqueOrganizations = Array.from(
          new Map(
            validOrganizations.map((organization) => [
              organization.id,
              organization,
            ])
          ).values()
        );

        uniqueOrganizations.sort((a, b) => {
          const aMinSU = isMindoroStateUniversity(a.name);
          const bMinSU = isMindoroStateUniversity(b.name);

          if (aMinSU && !bMinSU) return -1;
          if (!aMinSU && bMinSU) return 1;

          return a.name.localeCompare(b.name);
        });

        setOrganizations(uniqueOrganizations);
        setOrganizationsLoading(false);
      },
      (error) => {
        console.error('Organization loading error:', error);

        setOrganizationsLoading(false);

        const info = getErrorInfo(error);

        showMessageToast(
          info.code === 'permission-denied'
            ? 'Access denied. Check your Firestore organizations rules.'
            : 'Unable to load organizations.'
        );
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // ==========================================
  // FIND PERSISTED CONVERSATION
  // ==========================================

  const persistedConversation = activeConversation
    ? conversations.find(
        (conversation) => conversation.id === activeConversation.id
      )
    : undefined;

  // ==========================================
  // LOAD MESSAGES
  // ==========================================

  useEffect(() => {
    if (!activeConversation || !userId) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    if (
      activeConversation.studentId !== userId ||
      !activeConversation.organizationId ||
      activeConversation.organizationId === userId
    ) {
      setMessages([]);
      setMessagesLoading(false);
      showMessageToast('Invalid conversation participants.');
      return;
    }

    if (!persistedConversation) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    setMessagesLoading(true);
    setMessages([]);

    const unsubscribe = subscribeToMessages(
      persistedConversation.id,
      (items) => {
        setMessages(items);
        setMessagesLoading(false);
      },
      (error) => {
        console.error('Message loading error:', error);
        setMessagesLoading(false);

        showMessageToast(
          'Unable to load messages. Check conversation permissions.'
        );
      }
    );

    markConversationAsRead(
      persistedConversation.id,
      userId
    ).catch((error) => {
      console.error('Unable to mark conversation as read:', error);
    });

    return () => unsubscribe();
  }, [
    activeConversation?.id,
    activeConversation?.studentId,
    activeConversation?.organizationId,
    userId,
    persistedConversation?.id,
  ]);

  // ==========================================
  // AUTO SCROLL
  // ==========================================

  useEffect(() => {
    const scrollToLatest = async () => {
      try {
        await chatContentRef.current?.scrollToBottom(250);
      } catch (error) {
        console.error('Chat scroll error:', error);
      }
    };

    void scrollToLatest();
  }, [messages]);

  // ==========================================
  // DATE HELPERS
  // ==========================================

  const getDate = (value: unknown): Date | null => {
    if (!value) return null;

    try {
      const dateValue = value as { toDate?: () => Date };

      if (typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      }

      const date = new Date(value as string | number | Date);

      return Number.isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };

  const formatMessageTime = (value: unknown): string => {
    const date = getDate(value);

    if (!date) return '';

    return date.toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatConversationDate = (value: unknown): string => {
    const date = getDate(value);

    if (!date) return '';

    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return formatMessageTime(value);
    }

    return date.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
    });
  };

  // ==========================================
  // UNREAD COUNT
  // ==========================================

  const getUnreadCount = (conversation: Conversation): number => {
    return Number(conversation.unreadCounts?.[userId] || 0);
  };

  // ==========================================
  // SELECT CONVERSATION
  // ==========================================

  const openConversation = (conversation: Conversation) => {
    if (
      conversation.studentId !== userId ||
      !conversation.organizationId ||
      conversation.organizationId === userId
    ) {
      showMessageToast('Invalid conversation.');
      return;
    }

    setActiveConversation(conversation);
    setMessageInput('');
  };

  // ==========================================
  // CREATE LOCAL DRAFT
  // ==========================================

  const createDraftConversation = (
    organization: Organization
  ): Conversation => {
    return {
      id: getConversationId(userId, organization.id, null),
      studentId: userId,
      studentName,
      organizationId: organization.id,
      organizationName: organization.name,
      scholarshipId: null,
      scholarshipTitle: 'General Inquiry',
      lastMessage: '',
      lastSenderId: '',
      lastMessageAt: null,
      unreadCounts: {},
    };
  };

  // ==========================================
  // START CONVERSATION
  // ==========================================

  const startConversation = (organization: Organization) => {
    if (!userId || !organization.id) {
      showMessageToast('Invalid organization account.');
      return;
    }

    if (organization.id === userId) {
      showMessageToast('You cannot message your own account.');
      return;
    }

    const conversationId = getConversationId(
      userId,
      organization.id,
      null
    );

    const existing = conversations.find(
      (item) => item.id === conversationId
    );

    setActiveConversation(
      existing || createDraftConversation(organization)
    );

    setMessages([]);
    setMessageInput('');
    setShowOrganizationModal(false);
    setOrganizationSearch('');
  };

  // ==========================================
  // OPEN ORGANIZATION FROM ANOTHER PAGE
  // ==========================================

  useEffect(() => {
    const state = location.state as MessagesLocationState | null;
    const requestedOrganization = state?.openOrganization;

    if (!requestedOrganization) {
      openedOrganizationRef.current = '';
      return;
    }

    if (!userId) return;

    if (
      !requestedOrganization.id ||
      requestedOrganization.id === userId
    ) {
      showMessageToast('Invalid organization account.');

      navigate(location.pathname, {
        replace: true,
        state: null,
      });

      return;
    }

    const requestKey = `${userId}_${requestedOrganization.id}`;

    if (openedOrganizationRef.current === requestKey) return;

    const matchedOrganization = organizations.find(
      (item) => item.id === requestedOrganization.id
    );

    const organization: Organization = matchedOrganization || {
      ...requestedOrganization,
      name: normalizeOrganizationName(requestedOrganization.name),
    };

    const conversationId = getConversationId(
      userId,
      organization.id,
      null
    );

    const existing = conversations.find(
      (item) => item.id === conversationId
    );

    openedOrganizationRef.current = requestKey;

    setActiveConversation(
      existing || createDraftConversation(organization)
    );

    setMessages([]);
    setMessageInput('');

    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [
    conversations,
    location.pathname,
    location.state,
    navigate,
    organizations,
    studentName,
    userId,
  ]);

  // ==========================================
  // SEND MESSAGE
  // ==========================================

  const handleSendMessage = async (
    event?: React.FormEvent<HTMLFormElement>
  ) => {
    event?.preventDefault();

    const messageText = messageInput.trim();

    if (
      !messageText ||
      !activeConversation ||
      !userId ||
      sending
    ) {
      return;
    }

    if (messageText.length > 2000) {
      showMessageToast('Your message must not exceed 2,000 characters.');
      return;
    }

    if (
      !activeConversation.id ||
      !activeConversation.studentId ||
      !activeConversation.organizationId ||
      activeConversation.studentId !== userId ||
      activeConversation.organizationId === userId
    ) {
      showMessageToast('Invalid conversation participants.');
      return;
    }

    setSending(true);

    try {
      await sendMessage({
        // IMPORTANT: Use the currently selected conversation document ID.
        conversationId: activeConversation.id,

        studentId: userId,
        studentName,

        organizationId: activeConversation.organizationId,
        organizationName: getOrganizationDisplayName(
          activeConversation.organizationId,
          activeConversation.organizationName
        ),

        scholarshipId: activeConversation.scholarshipId,
        scholarshipTitle:
          activeConversation.scholarshipTitle || 'General Inquiry',

        senderId: userId,
        senderRole: 'student',
        message: messageText,
      });

      setMessageInput('');

      console.log('Message successfully sent:', {
        conversationId: activeConversation.id,
        studentId: userId,
        organizationId: activeConversation.organizationId,
      });
    } catch (error) {
      console.error('Send message error:', error);

      const info = getErrorInfo(error);

      showMessageToast(
        `Message was not sent: ${info.message}`
      );
    } finally {
      setSending(false);
    }
  };

  // ==========================================
  // FILTER DATA
  // ==========================================

  const filteredConversations = useMemo(() => {
    const search = conversationSearch.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const text = [
        conversation.organizationName,
        conversation.scholarshipTitle,
        conversation.lastMessage,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(search);
    });
  }, [conversations, conversationSearch]);

  const filteredOrganizations = useMemo(() => {
    const search = organizationSearch.trim().toLowerCase();

    return organizations.filter((organization) => {
      const text = [
        organization.name,
        isMindoroStateUniversity(organization.name) ? 'minsu' : '',
        organization.type,
        organization.location,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(search);
    });
  }, [organizations, organizationSearch]);

  // ==========================================
  // NAVIGATION
  // ==========================================

  const goBackToConversations = () => {
    setActiveConversation(null);
    setMessages([]);
    setMessageInput('');
  };

  const openOrganizationModal = () => {
    setOrganizationSearch('');
    setShowOrganizationModal(true);
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <IonPage className="student-messages-page">
      <StudentHeader />

      <IonContent className="messages-content" scrollY={false}>
        <main className="messages-layout">

          {/* CONVERSATION LIST */}
          <aside
            className={`conversation-panel ${
              activeConversation ? 'conversation-panel-hidden-mobile' : ''
            }`}
          >
            <div className="messages-page-heading">
              <div className="messages-heading-title">
                <div>
                  <h1>Messages</h1>
                  <p>Connect with LGU and School accounts.</p>
                </div>

                <span className="conversation-total">
                  {conversations.length}
                </span>
              </div>

              <IonButton
                className="new-message-button"
                onClick={openOrganizationModal}
              >
                <IonIcon icon={addOutline} slot="start" />
                New Message
              </IonButton>
            </div>

            <div className="conversation-search">
              <IonIcon icon={searchOutline} />

              <IonInput
                value={conversationSearch}
                placeholder="Search conversations..."
                onIonInput={(event) =>
                  setConversationSearch(event.detail.value || '')
                }
                clearInput
              />
            </div>

            <div className="conversation-list">
              {loading ? (
                <div className="messages-loading">
                  <IonSpinner name="crescent" />
                  <p>Loading conversations...</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="messages-empty">
                  <div className="messages-empty-icon">
                    <IonIcon icon={chatbubblesOutline} />
                  </div>

                  <h3>
                    {conversationSearch.trim()
                      ? 'No matching conversations'
                      : 'No conversations yet'}
                  </h3>

                  <p>
                    {conversationSearch.trim()
                      ? 'Try another organization or scholarship keyword.'
                      : 'Start a conversation with an LGU or School account.'}
                  </p>

                  <IonButton onClick={openOrganizationModal}>
                    <IonIcon icon={addOutline} slot="start" />
                    Start a Conversation
                  </IonButton>
                </div>
              ) : (
                filteredConversations.map((conversation) => {
                  const unreadCount = getUnreadCount(conversation);
                  const organizationLogo = getOrganizationLogo(
                    conversation.organizationId
                  );

                  return (
                    <button
                      type="button"
                      key={conversation.id}
                      className={`conversation-item ${
                        activeConversation?.id === conversation.id
                          ? 'conversation-item-active'
                          : ''
                      }`}
                      onClick={() => openConversation(conversation)}
                    >
                      <div className="conversation-avatar">
                        {organizationLogo ? (
                          <img
                            src={organizationLogo}
                            alt={`${conversation.organizationName} profile`}
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <IonIcon icon={schoolOutline} />
                        )}
                      </div>

                      <div className="conversation-item-content">
                        <div className="conversation-title-row">
                          <h3>
                            {getOrganizationDisplayName(
                              conversation.organizationId,
                              conversation.organizationName
                            )}
                          </h3>

                          <span className="conversation-date">
                            {formatConversationDate(conversation.lastMessageAt)}
                          </span>
                        </div>

                        <p className="conversation-scholarship">
                          {conversation.scholarshipTitle || 'General Inquiry'}
                        </p>

                        <div className="conversation-bottom-row">
                          <p className="conversation-last-message">
                            {conversation.lastMessage || 'Start your conversation'}
                          </p>

                          {unreadCount > 0 && (
                            <IonBadge className="unread-badge">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </IonBadge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* CHAT PANEL */}
          <section
            className={`chat-panel ${
              !activeConversation ? 'chat-panel-hidden-mobile' : ''
            }`}
          >
            {activeConversation ? (
              <>
                <div className="chat-heading">
                  <button
                    type="button"
                    className="mobile-back-button"
                    onClick={goBackToConversations}
                    aria-label="Back to conversations"
                  >
                    <IonIcon icon={arrowBackOutline} />
                  </button>

                  <div className="chat-heading-avatar">
                    {getOrganizationLogo(
                      activeConversation.organizationId
                    ) ? (
                      <img
                        src={getOrganizationLogo(
                          activeConversation.organizationId
                        )}
                        alt="Organization profile"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <IonIcon icon={schoolOutline} />
                    )}
                  </div>

                  <div className="chat-heading-details">
                    <h2>
                      {getOrganizationDisplayName(
                        activeConversation.organizationId,
                        activeConversation.organizationName
                      )}
                    </h2>

                    <p>
                      {activeConversation.scholarshipTitle || 'General Inquiry'}
                    </p>
                  </div>

                  <div className="chat-heading-status">
                    <span className="online-indicator" />
                    <span>Conversation</span>
                  </div>
                </div>

                <IonContent
                  className="chat-messages-content"
                  ref={chatContentRef}
                >
                  <div className="chat-messages">
                    <div className="chat-date-label">
                      <span>Messages</span>
                    </div>

                    {messagesLoading ? (
                      <div className="messages-loading">
                        <IonSpinner name="crescent" />
                        <p>Loading messages...</p>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="chat-start-message">
                        <div className="chat-start-icon">
                          <IonIcon icon={chatbubblesOutline} />
                        </div>

                        <h3>Start the conversation</h3>

                        <p>
                          Send a message to{' '}
                          {getOrganizationDisplayName(
                            activeConversation.organizationId,
                            activeConversation.organizationName
                          )}{' '}
                          about scholarship inquiries or application concerns.
                        </p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isMine = message.senderId === userId;

                        return (
                          <div
                            key={message.id}
                            className={`message-row ${
                              isMine ? 'message-row-mine' : 'message-row-other'
                            }`}
                          >
                            {!isMine && (
                              <div className="message-sender-avatar">
                                {getOrganizationLogo(
                                  activeConversation.organizationId
                                ) ? (
                                  <img
                                    src={getOrganizationLogo(
                                      activeConversation.organizationId
                                    )}
                                    alt="Organization profile"
                                    onError={(event) => {
                                      event.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <IonIcon icon={schoolOutline} />
                                )}
                              </div>
                            )}

                            <div
                              className={`message-bubble ${
                                isMine
                                  ? 'message-bubble-mine'
                                  : 'message-bubble-other'
                              }`}
                            >
                              {!isMine && (
                                <strong className="message-sender-name">
                                  {getOrganizationDisplayName(
                                    activeConversation.organizationId,
                                    activeConversation.organizationName
                                  )}
                                </strong>
                              )}

                              <p>{message.message}</p>

                              <div className="message-meta">
                                <span>{formatMessageTime(message.createdAt)}</span>

                                {isMine && (
                                  <IonIcon icon={checkmarkDoneOutline} />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </IonContent>

                {/* MESSAGE INPUT */}
                <form
                  className="chat-input-area"
                  onSubmit={handleSendMessage}
                >
                  <div className="chat-input-wrapper">
                    <IonInput
                      className="chat-message-input"
                      value={messageInput}
                      placeholder="Write your message..."
                      onIonInput={(event) =>
                        setMessageInput(event.detail.value || '')
                      }
                      disabled={sending}
                      maxlength={2000}
                    />
                  </div>

                  <IonButton
                    type="submit"
                    className="send-message-button"
                    disabled={!messageInput.trim() || sending}
                    aria-label="Send message"
                  >
                    {sending ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <IonIcon icon={paperPlaneOutline} />
                    )}
                  </IonButton>
                </form>

                <div className="chat-privacy-note">
                  <IonIcon icon={checkmarkDoneOutline} />
                  <span>Keep your scholarship communication here.</span>
                </div>
              </>
            ) : (
              <div className="no-chat-selected">
                <div className="no-chat-icon">
                  <IonIcon icon={chatbubblesOutline} />
                </div>

                <h2>Your Messages</h2>

                <p>
                  Select a conversation from the left or start a new conversation
                  with a registered organization.
                </p>

                <IonButton
                  className="new-message-button"
                  onClick={openOrganizationModal}
                >
                  <IonIcon icon={addOutline} slot="start" />
                  New Message
                </IonButton>
              </div>
            )}
          </section>
        </main>
      </IonContent>

      {/* NEW CONVERSATION MODAL */}
      <IonModal
        isOpen={showOrganizationModal}
        onDidDismiss={() => {
          setShowOrganizationModal(false);
          setOrganizationSearch('');
        }}
        className="organization-select-modal"
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>New Conversation</IonTitle>

            <IonButton
              slot="end"
              fill="clear"
              color="medium"
              onClick={() => setShowOrganizationModal(false)}
              aria-label="Close"
            >
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonToolbar>
        </IonHeader>

        <IonContent className="organization-modal-content">
          <div className="organization-modal-heading">
            <h2>Choose an Organization</h2>
            <p>
              Select a registered LGU or School account to start a conversation.
            </p>
          </div>

          <div className="organization-modal-search">
            <IonIcon icon={searchOutline} />

            <IonInput
              value={organizationSearch}
              placeholder="Search Mindoro State University or MinSU..."
              onIonInput={(event) =>
                setOrganizationSearch(event.detail.value || '')
              }
              clearInput
            />
          </div>

          <div className="organization-search-count">
            {organizationsLoading
              ? 'Loading organizations...'
              : `${filteredOrganizations.length} organization(s) found`}
          </div>

          {organizationsLoading ? (
            <div className="messages-loading">
              <IonSpinner name="crescent" />
              <p>Loading organizations...</p>
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="organization-empty">
              <IonIcon icon={schoolOutline} />

              <h3>
                {organizationSearch.trim()
                  ? 'No matching organization'
                  : 'No organizations found'}
              </h3>

              <p>
                Try another search term or check the organization documents in
                your Firestore database.
              </p>
            </div>
          ) : (
            <IonList className="organization-list">
              {filteredOrganizations.map((organization) => (
                <IonItem
                  key={organization.id}
                  button
                  detail
                  onClick={() => startConversation(organization)}
                >
                  <IonAvatar slot="start" className="organization-modal-avatar">
                    {organization.logo ? (
                      <img
                        src={organization.logo}
                        alt={`${organization.name} profile`}
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="organization-avatar-placeholder">
                        <IonIcon icon={schoolOutline} />
                      </div>
                    )}
                  </IonAvatar>

                  <IonLabel>
                    <h2>{organization.name}</h2>
                    <p>{organization.type}</p>

                    {organization.location && (
                      <p>{organization.location}</p>
                    )}
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
          )}
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={showToast}
        message={toastMessage}
        duration={3500}
        position="bottom"
        onDidDismiss={() => setShowToast(false)}
      />

      <StudentBottomNav />
    </IonPage>
  );
};

export default Messages;
