
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  IonPage,
  IonContent,
  IonIcon,
  IonInput,
  IonButton,
  IonSpinner,
  IonToast,
} from '@ionic/react';

import {
  arrowBackOutline,
  chatbubblesOutline,
  searchOutline,
  send,
  personCircleOutline,
  schoolOutline,
  closeOutline,
  refreshOutline,
  checkmarkDoneOutline,
} from 'ionicons/icons';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../Firebase/config';

import {
  subscribeToConversations,
  subscribeToMessages,
  markConversationAsRead,
  sendMessage,
} from '../../services/messagingService';

import './Messages.css';

interface Conversation {
  id: string;
  conversationId?: string;
  studentId?: string;
  studentName?: string;
  organizationId?: string;
  organizationName?: string;
  scholarshipId?: string | null;
  scholarshipTitle?: string;
  participantName?: string;
  name?: string;
  lastMessage?: string;
  lastMessageAt?: any;
  unreadCounts?: Record<string, number>;
  unreadCount?: number;
  [key: string]: any;
}

interface ChatMessage {
  id: string;
  senderId?: string;
  senderRole?: string;
  message?: string;
  text?: string;
  content?: string;
  createdAt?: any;
  timestamp?: any;
  [key: string]: any;
}

interface MessagesProps {
  onClose?: () => void;
}

const getDate = (value: any): Date | null => {
  if (!value) return null;

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTime = (value: any): string => {
  const date = getDate(value);

  if (!date) return '';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatConversationDate = (value: any): string => {
  const date = getDate(value);

  if (!date) return '';

  if (date.toDateString() === new Date().toDateString()) {
    return formatTime(date);
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
};

const getMessageText = (message: ChatMessage): string => {
  return message.message || message.text || message.content || '';
};

const Messages: React.FC<MessagesProps> = ({ onClose }) => {
  const [currentUserId, setCurrentUserId] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');

  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const messageEndRef = useRef<HTMLDivElement | null>(null);

  // AUTH AND CONVERSATIONS
  useEffect(() => {
    let unsubscribeConversations: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeConversations?.();
      unsubscribeConversations = undefined;

      if (!user) {
        setCurrentUserId('');
        setConversations([]);
        setActiveConversation(null);
        setMessages([]);
        setLoading(false);
        return;
      }

      setCurrentUserId(user.uid);
      setLoading(true);

      unsubscribeConversations = subscribeToConversations(
        user.uid,
        'organization',
        (data: Conversation[]) => {
          setConversations(data || []);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeConversations?.();
    };
  }, [refreshKey]);

  // LOAD MESSAGES
  useEffect(() => {
    if (!activeConversation || !currentUserId) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    setMessagesLoading(true);

    const conversationId =
      activeConversation.conversationId || activeConversation.id;

    const unsubscribe = subscribeToMessages(
      conversationId,
      (data: ChatMessage[]) => {
        setMessages(data || []);
        setMessagesLoading(false);
      }
    );

    markConversationAsRead(conversationId, currentUserId).catch((error) => {
      console.error('Unable to mark conversation as read:', error);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [activeConversation, currentUserId, refreshKey]);

  // AUTO SCROLL
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [messages]);

  // FILTER CONVERSATIONS
  const filteredConversations = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    if (!search) return conversations;

    return conversations.filter((conversation) => {
      const name =
        conversation.studentName ||
        conversation.participantName ||
        conversation.name ||
        'Student';

      return (
        name.toLowerCase().includes(search) ||
        (conversation.lastMessage || '').toLowerCase().includes(search)
      );
    });
  }, [conversations, searchTerm]);

  // CONVERSATION NAME
  const getConversationName = (conversation: Conversation): string => {
    return (
      conversation.studentName ||
      conversation.participantName ||
      conversation.name ||
      'Student'
    );
  };

  // AVATAR INITIAL
  const getInitial = (name: string): string => {
    return name.trim().charAt(0).toUpperCase() || 'S';
  };

  // UNREAD COUNT
  const getUnreadCount = (conversation: Conversation): number => {
    return (
      Number(
        conversation.unreadCounts?.[currentUserId] ??
          conversation.unreadCount ??
          0
      ) || 0
    );
  };

  // MESSAGE SENDER
  const isSentByCurrentUser = (message: ChatMessage): boolean => {
    return message.senderId === currentUserId;
  };

  // CLOSE
  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }

    const modal = document.querySelector('ion-modal.msg-modal') as any;

    if (modal && typeof modal.dismiss === 'function') {
      modal.dismiss();
    } else {
      window.history.back();
    }
  };

  // REFRESH
  const handleRefresh = () => {
    if (loading) return;

    setLoading(true);
    setRefreshKey((key) => key + 1);
  };

  // OPEN CONVERSATION
  const openConversation = (conversation: Conversation) => {
    setMessages([]);
    setActiveConversation(conversation);
    setMessageText('');
  };

  // BACK TO INBOX
  const backToInbox = () => {
    setActiveConversation(null);
    setMessages([]);
    setMessageText('');
  };

  // SEND MESSAGE
  const handleSendMessage = async () => {
    const trimmedMessage = messageText.trim();

    if (
      !trimmedMessage ||
      !activeConversation ||
      !currentUserId ||
      sending
    ) {
      return;
    }

    const studentId = activeConversation.studentId;

    if (!studentId) {
      setToastMessage(
        'Student information is missing. Unable to send this message.'
      );
      setShowToast(true);
      return;
    }

    try {
      setSending(true);

      await sendMessage({
        studentId,
        studentName: getConversationName(activeConversation),
        organizationId: currentUserId,
        organizationName:
          activeConversation.organizationName ||
          auth.currentUser?.displayName ||
          'Organization',
        scholarshipId: activeConversation.scholarshipId ?? null,
        scholarshipTitle:
          activeConversation.scholarshipTitle || 'General Inquiry',
        senderId: currentUserId,
        senderRole: 'organization',
        message: trimmedMessage,
      });

      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);

      setToastMessage('Unable to send your message. Please try again.');
      setShowToast(true);
    } finally {
      setSending(false);
    }
  };

  // ENTER TO SEND
  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLIonInputElement>
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const activeName = activeConversation
    ? getConversationName(activeConversation)
    : '';

  return (
    <IonPage className="msg-page">
      <IonContent className="msg-content" scrollY={false}>
        <div className="msg-app">

          {/* GREEN CHAT HEADER */}
          <header className="msg-header">
            <div className="msg-header-left">
              {activeConversation ? (
                <button
                  type="button"
                  className="msg-header-icon"
                  onClick={backToInbox}
                  aria-label="Back to inbox"
                >
                  <IonIcon icon={arrowBackOutline} />
                </button>
              ) : (
                <div className="msg-header-icon msg-header-logo">
                  <IonIcon icon={schoolOutline} />
                </div>
              )}

              <div className="msg-header-avatar">
                {activeConversation ? (
                  <span>{getInitial(activeName)}</span>
                ) : (
                  <IonIcon icon={chatbubblesOutline} />
                )}
              </div>

              <div className="msg-header-details">
                <h2>
                  {activeConversation ? activeName : 'Messages'}
                </h2>
                <p>
                  <span className="msg-online-dot" />
                  {activeConversation
                    ? 'Student Conversation'
                    : 'GrantAccess Messages'}
                </p>
              </div>
            </div>

            <div className="msg-header-actions">
              <button
                type="button"
                className="msg-header-icon"
                onClick={handleRefresh}
                disabled={loading}
                aria-label="Refresh messages"
              >
                <IonIcon
                  icon={refreshOutline}
                  className={loading ? 'msg-spin' : ''}
                />
              </button>

              <button
                type="button"
                className="msg-header-icon"
                onClick={handleClose}
                aria-label="Close messages"
              >
                <IonIcon icon={closeOutline} />
              </button>
            </div>
          </header>

          {/* CHAT CONTENT */}
          {activeConversation ? (
            <>
              <div className="msg-chat-information">
                <span className="msg-info-icon">
                  <IonIcon icon={schoolOutline} />
                </span>

                <div>
                  <strong>{activeName}</strong>
                  <small>
                    {activeConversation.scholarshipTitle ||
                      'General Scholarship Inquiry'}
                  </small>
                </div>
              </div>

              <div className="msg-chat-body">
                {messagesLoading ? (
                  <div className="msg-state">
                    <IonSpinner name="crescent" />
                    <span>Loading messages...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="msg-welcome">
                    <div className="msg-welcome-avatar">
                      <IonIcon icon={chatbubblesOutline} />
                    </div>

                    <div className="msg-received-bubble">
                      <strong>GrantAccess Messages</strong>
                      <p>
                        Hello! You can now communicate with this student
                        about their scholarship inquiry.
                      </p>
                    </div>

                    <span className="msg-welcome-time">
                      Start of conversation
                    </span>
                  </div>
                ) : (
                  messages.map((message) => {
                    const sent = isSentByCurrentUser(message);

                    return (
                      <div
                        key={message.id}
                        className={`msg-message-row ${
                          sent ? 'msg-sent' : 'msg-received'
                        }`}
                      >
                        {!sent && (
                          <div className="msg-message-avatar">
                            {getInitial(activeName)}
                          </div>
                        )}

                        <div className="msg-message-content">
                          <div className="msg-message-bubble">
                            {getMessageText(message)}
                          </div>

                          <div className="msg-message-meta">
                            <span>
                              {formatTime(
                                message.createdAt || message.timestamp
                              )}
                            </span>

                            {sent && (
                              <IonIcon icon={checkmarkDoneOutline} />
                            )}
                          </div>
                        </div>

                        {sent && (
                          <div className="msg-message-avatar msg-own-avatar">
                            <IonIcon icon={personCircleOutline} />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                <div ref={messageEndRef} />
              </div>

              {/* MESSAGE INPUT */}
              <div className="msg-input-area">
                <div className="msg-input-box">
                  <IonInput
                    value={messageText}
                    placeholder="Type a message..."
                    onIonInput={(event) =>
                      setMessageText(event.detail.value || '')
                    }
                    onKeyDown={handleInputKeyDown}
                    disabled={sending}
                  />

                  <IonButton
                    className="msg-send-button"
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sending}
                    aria-label="Send message"
                  >
                    {sending ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <IonIcon icon={send} />
                    )}
                  </IonButton>
                </div>

                <p className="msg-input-caption">
                  <IonIcon icon={schoolOutline} />
                  GrantAccess Scholarship Communication
                </p>
              </div>
            </>
          ) : (
            <>
              {/* INBOX VIEW */}
              <div className="msg-inbox-heading">
                <div>
                  <h1>Your Messages</h1>
                  <p>Conversations with students</p>
                </div>

                <span className="msg-inbox-count">
                  {conversations.length}
                </span>
              </div>

              <div className="msg-search-box">
                <IonIcon icon={searchOutline} />

                <IonInput
                  value={searchTerm}
                  placeholder="Search student conversations..."
                  onIonInput={(event) =>
                    setSearchTerm(event.detail.value || '')
                  }
                />
              </div>

              <div className="msg-inbox-list">
                {loading ? (
                  <div className="msg-state">
                    <IonSpinner name="crescent" />
                    <span>Loading conversations...</span>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="msg-empty">
                    <div className="msg-empty-icon">
                      <IonIcon icon={chatbubblesOutline} />
                    </div>

                    <h3>No conversations yet</h3>

                    <p>
                      Student messages will appear here when they contact
                      your organization.
                    </p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => {
                    const name = getConversationName(conversation);
                    const unread = getUnreadCount(conversation);

                    return (
                      <button
                        type="button"
                        key={conversation.id}
                        className="msg-inbox-item"
                        onClick={() => openConversation(conversation)}
                      >
                        <div className="msg-inbox-avatar">
                          {getInitial(name)}
                        </div>

                        <div className="msg-inbox-details">
                          <div className="msg-inbox-top">
                            <strong>{name}</strong>
                            <small>
                              {formatConversationDate(
                                conversation.lastMessageAt
                              )}
                            </small>
                          </div>

                          <p>
                            {conversation.lastMessage ||
                              'Start a conversation'}
                          </p>

                          <span className="msg-inbox-subtitle">
                            Student Account
                          </span>
                        </div>

                        {unread > 0 && (
                          <span className="msg-unread-count">
                            {unread}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <IonToast
          isOpen={showToast}
          message={toastMessage}
          duration={3000}
          position="bottom"
          color="danger"
          onDidDismiss={() => setShowToast(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default Messages;
