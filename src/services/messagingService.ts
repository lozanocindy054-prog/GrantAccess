
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import { auth, db } from '../Firebase/config';

// =====================================================
// TYPES
// =====================================================

export type SenderRole = 'student' | 'organization';

export interface Conversation {
  id: string;
  studentId: string;
  studentName: string;
  organizationId: string;
  organizationName: string;
  scholarshipId: string | null;
  scholarshipTitle: string;
  lastMessage: string;
  lastSenderId: string;
  lastMessageAt: any;
  unreadCounts: Record<string, number>;
  createdAt?: any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: SenderRole;
  message: string;
  createdAt: any;
}

export interface SendMessageInput {
  conversationId?: string;
  studentId: string;
  studentName: string;
  organizationId: string;
  organizationName: string;
  scholarshipId?: string | null;
  scholarshipTitle?: string;
  senderId: string;
  senderRole: SenderRole;
  message: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const CONVERSATIONS_COLLECTION = 'conversations';
const MAX_MESSAGE_LENGTH = 2000;

// =====================================================
// HELPERS
// =====================================================

export const getConversationId = (
  studentId: string,
  organizationId: string,
  scholarshipId?: string | null
): string => {
  return `${studentId}_${organizationId}_${scholarshipId || 'general'}`;
};

const getSafeNumber = (value: unknown): number => {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
    : 0;
};

const mapConversation = (
  id: string,
  data: DocumentData
): Conversation => ({
  id,
  studentId: String(data.studentId || ''),
  studentName: String(data.studentName || 'Student'),
  organizationId: String(data.organizationId || ''),
  organizationName: String(data.organizationName || 'Organization'),
  scholarshipId:
    typeof data.scholarshipId === 'string'
      ? data.scholarshipId
      : null,
  scholarshipTitle: String(
    data.scholarshipTitle || 'General Inquiry'
  ),
  lastMessage: String(data.lastMessage || ''),
  lastSenderId: String(data.lastSenderId || ''),
  lastMessageAt: data.lastMessageAt || null,
  unreadCounts:
    data.unreadCounts &&
    typeof data.unreadCounts === 'object'
      ? data.unreadCounts
      : {},
  createdAt: data.createdAt || null,
});

const mapMessage = (
  id: string,
  data: DocumentData
): ChatMessage => ({
  id,
  senderId: String(data.senderId || ''),
  senderRole:
    data.senderRole === 'organization'
      ? 'organization'
      : 'student',
  message: String(data.message || ''),
  createdAt: data.createdAt || null,
});

// =====================================================
// SEND MESSAGE
// =====================================================

export const sendMessage = async (
  input: SendMessageInput
): Promise<string> => {
  const {
    conversationId: suppliedConversationId,
    studentId,
    studentName,
    organizationId,
    organizationName,
    scholarshipId = null,
    scholarshipTitle = 'General Inquiry',
    senderId,
    senderRole,
  } = input;

  const message = input.message.trim();

  // -----------------------------------------
  // VALIDATE MESSAGE
  // -----------------------------------------

  if (!message) {
    throw new Error('Please enter a message.');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(
      'Message must not exceed 2,000 characters.'
    );
  }

  // -----------------------------------------
  // VALIDATE PARTICIPANTS
  // -----------------------------------------

  if (
    !studentId?.trim() ||
    !organizationId?.trim() ||
    !senderId?.trim() ||
    !studentName?.trim() ||
    !organizationName?.trim()
  ) {
    throw new Error(
      'Missing student or organization information.'
    );
  }

  if (studentId === organizationId) {
    throw new Error(
      'Student ID and organization ID cannot be the same.'
    );
  }

  // -----------------------------------------
  // VALIDATE SENDER ROLE
  // -----------------------------------------

  if (
    senderRole !== 'student' &&
    senderRole !== 'organization'
  ) {
    throw new Error('Invalid sender role.');
  }

  if (
    senderRole === 'student' &&
    senderId !== studentId
  ) {
    throw new Error(
      'Student sender does not match the conversation student.'
    );
  }

  if (
    senderRole === 'organization' &&
    senderId !== organizationId
  ) {
    throw new Error(
      'Organization sender does not match the conversation organization.'
    );
  }

  // -----------------------------------------
  // VALIDATE AUTHENTICATED USER
  // -----------------------------------------

  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error(
      'You must be logged in to send a message.'
    );
  }

  if (currentUser.uid !== senderId) {
    throw new Error(
      'Your authenticated account does not match the sender.'
    );
  }

  // -----------------------------------------
  // CONVERSATION REFERENCES
  // -----------------------------------------

  const conversationId =
    suppliedConversationId?.trim() ||
    getConversationId(
      studentId,
      organizationId,
      scholarshipId
    );

  if (!conversationId) {
    throw new Error('Invalid conversation ID.');
  }

  const conversationRef = doc(
    db,
    CONVERSATIONS_COLLECTION,
    conversationId
  );

  const messagesCollectionRef = collection(
    db,
    CONVERSATIONS_COLLECTION,
    conversationId,
    'messages'
  );

  const messageRef = doc(messagesCollectionRef);

  const recipientId =
    senderRole === 'student'
      ? organizationId
      : studentId;

  // Used to identify the operation that failed.
  let failedAt = 'Starting transaction';

  // =========================================
  // FIRESTORE TRANSACTION
  // =========================================

  try {
    await runTransaction(db, async (transaction) => {
      // -------------------------------------
      // READ CONVERSATION
      // -------------------------------------

      failedAt = 'Reading conversation document';

      const conversationSnapshot =
        await transaction.get(conversationRef);

      // -------------------------------------
      // CREATE NEW CONVERSATION
      // -------------------------------------

      if (!conversationSnapshot.exists()) {
        failedAt = 'Creating new conversation';

        const newConversation = {
          studentId,
          studentName: studentName.trim(),

          organizationId,
          organizationName: organizationName.trim(),

          scholarshipId,
          scholarshipTitle:
            scholarshipTitle.trim() || 'General Inquiry',

          lastMessage: message,
          lastSenderId: senderId,
          lastMessageAt: serverTimestamp(),

          unreadCounts: {
            [senderId]: 0,
            [recipientId]: 1,
          },

          createdAt: serverTimestamp(),
        };

        transaction.set(
          conversationRef,
          newConversation
        );
      }

      // -------------------------------------
      // UPDATE EXISTING CONVERSATION
      // -------------------------------------

      else {
        failedAt = 'Validating existing conversation';

        const existing = conversationSnapshot.data();

        if (
          existing.studentId !== studentId ||
          existing.organizationId !== organizationId
        ) {
          throw new Error(
            'Conversation participants do not match the selected chat.'
          );
        }

        if (
          senderId !== existing.studentId &&
          senderId !== existing.organizationId
        ) {
          throw new Error(
            'You are not a participant in this conversation.'
          );
        }

        const existingUnreadCounts =
          existing.unreadCounts &&
          typeof existing.unreadCounts === 'object'
            ? existing.unreadCounts
            : {};

        // Only increment the recipient's unread count.
        // Keep the sender's unread count unchanged.
        const updatedUnreadCounts = {
          ...existingUnreadCounts,
          [recipientId]:
            getSafeNumber(
              existingUnreadCounts[recipientId]
            ) + 1,
        };

        failedAt = 'Updating existing conversation';

        transaction.update(conversationRef, {
          lastMessage: message,
          lastSenderId: senderId,
          lastMessageAt: serverTimestamp(),
          unreadCounts: updatedUnreadCounts,
        });
      }

      // -------------------------------------
      // CREATE MESSAGE DOCUMENT
      // -------------------------------------

      failedAt = 'Creating message document';

      transaction.set(messageRef, {
        senderId,
        senderRole,
        message,
        createdAt: serverTimestamp(),
      });
    });

    console.log(
      'Message successfully sent.',
      {
        conversationId,
        senderId,
        recipientId,
        senderRole,
      }
    );

    return conversationId;

  } catch (error) {
    console.error(
      'SEND MESSAGE TRANSACTION FAILED',
      {
        failedAt,
        conversationId,
        studentId,
        organizationId,
        senderId,
        senderRole,
        recipientId,
        error,
      }
    );

    throw error;
  }
};

// =====================================================
// SUBSCRIBE TO CONVERSATIONS
// =====================================================

export const subscribeToConversations = (
  userId: string,
  role: SenderRole,
  callback: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  if (!userId) {
    callback([]);
    return () => undefined;
  }

  const participantField =
    role === 'student'
      ? 'studentId'
      : 'organizationId';

  const conversationsQuery = query(
    collection(db, CONVERSATIONS_COLLECTION),
    where(participantField, '==', userId),
    orderBy('lastMessageAt', 'desc')
  );

  return onSnapshot(
    conversationsQuery,
    (snapshot) => {
      const items = snapshot.docs.map((item) =>
        mapConversation(item.id, item.data())
      );

      callback(items);
    },
    (error) => {
      console.error(
        'Conversation subscription error:',
        error
      );

      onError?.(error);
    }
  );
};

// =====================================================
// SUBSCRIBE TO MESSAGES
// =====================================================

export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  if (!conversationId) {
    callback([]);
    return () => undefined;
  }

  const messagesQuery = query(
    collection(
      db,
      CONVERSATIONS_COLLECTION,
      conversationId,
      'messages'
    ),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const items = snapshot.docs.map((item) =>
        mapMessage(item.id, item.data())
      );

      callback(items);
    },
    (error) => {
      console.error(
        'Message subscription error:',
        error
      );

      onError?.(error);
    }
  );
};

// =====================================================
// MARK CONVERSATION AS READ
// =====================================================

export const markConversationAsRead = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  if (!conversationId || !userId) return;

  const currentUser = auth.currentUser;

  if (!currentUser || currentUser.uid !== userId) {
    throw new Error(
      'Authenticated user does not match the requested reader.'
    );
  }

  const conversationRef = doc(
    db,
    CONVERSATIONS_COLLECTION,
    conversationId
  );

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(
      conversationRef
    );

    if (!snapshot.exists()) return;

    const data = snapshot.data();

    if (
      data.studentId !== userId &&
      data.organizationId !== userId
    ) {
      throw new Error(
        'You are not allowed to access this conversation.'
      );
    }

    const unreadCounts =
      data.unreadCounts &&
      typeof data.unreadCounts === 'object'
        ? data.unreadCounts
        : {};

    const currentUnreadCount = getSafeNumber(
      unreadCounts[userId]
    );

    if (currentUnreadCount <= 0) return;

    transaction.update(conversationRef, {
      unreadCounts: {
        ...unreadCounts,
        [userId]: 0,
      },
    });
  });
};

// =====================================================
// GET UNREAD COUNT
// =====================================================

export const getUnreadCount = (
  conversation: Conversation,
  userId: string
): number => {
  if (!userId || !conversation) return 0;

  return getSafeNumber(
    conversation.unreadCounts?.[userId]
  );
};
