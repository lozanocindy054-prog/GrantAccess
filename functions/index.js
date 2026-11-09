
const { setGlobalOptions } = require("firebase-functions");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");

const logger = require("firebase-functions/logger");

const {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} = require("node:crypto");

const nodemailer = require("nodemailer");

// ==========================================
// GLOBAL FIREBASE FUNCTIONS CONFIGURATION
// ==========================================

setGlobalOptions({
  maxInstances: 10,
  region: "us-central1",
});

initializeApp();

const firestore = getFirestore();

// ==========================================
// FIREBASE SECRETS
// ==========================================

const smtpUser = defineSecret("SMTP_USER");
const smtpAppPassword = defineSecret("SMTP_APP_PASSWORD");
const emailOtpSecret = defineSecret("EMAIL_OTP_SECRET");

// ==========================================
// EMAIL VALIDATION
// ==========================================

const normalizeEmail = (value) => {
  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "Enter a valid email address."
    );
  }

  const email = value.trim().toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Enter a valid email address."
    );
  }

  return email;
};

// ==========================================
// EMAIL VERIFICATION FIRESTORE REFERENCE
// ==========================================

const emailVerificationRef = (email) =>
  firestore
    .collection("emailVerificationCodes")
    .doc(createHash("sha256").update(email).digest("hex"));

// ==========================================
// IP RATE LIMITING
// ==========================================

const enforceVerificationIpLimit = async (request) => {
  const ip = request.rawRequest?.ip;

  if (typeof ip !== "string" || !ip) {
    throw new HttpsError(
      "unavailable",
      "Unable to verify this request. Please try again."
    );
  }

  const ipHash = createHash("sha256")
    .update(ip)
    .digest("hex");

  const limitRef = firestore
    .collection("emailVerificationRateLimits")
    .doc(ipHash);

  const now = Date.now();

  const isLimited = await firestore.runTransaction(
    async (transaction) => {
      const snapshot = await transaction.get(limitRef);
      const data = snapshot.data();

      const windowStartedAt = data?.windowStartedAt;

      const sameWindow =
        windowStartedAt instanceof Timestamp &&
        now - windowStartedAt.toMillis() < 15 * 60_000;

      const attempts = sameWindow
        ? Number(data.attempts || 0)
        : 0;

      if (attempts >= 10) {
        return true;
      }

      transaction.set(limitRef, {
        windowStartedAt: sameWindow
          ? windowStartedAt
          : Timestamp.fromMillis(now),

        attempts: attempts + 1,

        expiresAt: Timestamp.fromMillis(
          now + 24 * 60 * 60_000
        ),
      });

      return false;
    }
  );

  if (isLimited) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many verification requests. Please try again later."
    );
  }
};

// ==========================================
// OTP HASHING AND COMPARISON
// ==========================================

const makeEmailVerificationHash = (email, value) =>
  createHmac("sha256", emailOtpSecret.value())
    .update(`${email}:${value}`)
    .digest("hex");

const hashesMatch = (first, second) => {
  if (
    typeof first !== "string" ||
    typeof second !== "string"
  ) {
    return false;
  }

  const firstBuffer = Buffer.from(first, "hex");
  const secondBuffer = Buffer.from(second, "hex");

  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
};

// ==========================================
// 1. SEND EMAIL VERIFICATION CODE
// ==========================================

exports.sendEmailVerificationCode = onCall(
  {
    secrets: [
      smtpUser,
      smtpAppPassword,
      emailOtpSecret,
    ],

    cors: [
      "http://localhost:8100",
      "http://localhost:5173",
    ],
  },

  async (request) => {
    const email = normalizeEmail(request.data?.email);

    await enforceVerificationIpLimit(request);

    // Check if email already exists in Firebase Authentication.
    try {
      await getAuth().getUserByEmail(email);

      throw new HttpsError(
        "already-exists",
        "This email is already registered. Please sign in."
      );

    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      if (error.code !== "auth/user-not-found") {
        logger.error(
          "Unable to check registration email",
          { code: error.code }
        );

        throw new HttpsError(
          "internal",
          "Unable to verify this email right now. Please try again."
        );
      }
    }

    // Generate six-digit OTP.
    const code = randomInt(0, 1000000)
      .toString()
      .padStart(6, "0");

    const codeHash = makeEmailVerificationHash(
      email,
      code
    );

    const verificationRef = emailVerificationRef(email);

    const now = Date.now();

    // Prevent repeated email requests.
    const rateLimit = await firestore.runTransaction(
      async (transaction) => {
        const snapshot = await transaction.get(verificationRef);

        const previousSentAt = snapshot.data()?.sentAt;

        if (
          previousSentAt instanceof Timestamp &&
          now - previousSentAt.toMillis() < 60_000
        ) {
          return Math.ceil(
            (
              60_000 -
              (now - previousSentAt.toMillis())
            ) / 1000
          );
        }

        transaction.set(verificationRef, {
          codeHash,

          sentAt: Timestamp.fromMillis(now),

          expiresAt: Timestamp.fromMillis(
            now + 10 * 60_000
          ),

          attempts: 0,

          verified: false,

          tokenHash: null,
        });

        return 0;
      }
    );

    if (rateLimit > 0) {
      throw new HttpsError(
        "resource-exhausted",
        `Please wait ${rateLimit} seconds before requesting another code.`
      );
    }

    // Send OTP using Gmail SMTP.
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,

        auth: {
          user: smtpUser.value(),
          pass: smtpAppPassword.value(),
        },
      });

      await transporter.sendMail({
        from: `GrantAccess <${smtpUser.value()}>`,

        to: email,

        subject: "Your GrantAccess verification code",

        text:
          `Your GrantAccess verification code is ${code}. ` +
          "It expires in 10 minutes. " +
          "If you did not request this code, you can ignore this email.",

        html: `
          <div style="font-family:Arial,sans-serif">
            <h2>GrantAccess Email Verification</h2>

            <p>Your verification code is:</p>

            <p style="
              font-size:28px;
              font-weight:bold;
              letter-spacing:8px;
            ">
              ${code}
            </p>

            <p>This code expires in 10 minutes.</p>

            <p>
              If you did not request this code,
              you can ignore this email.
            </p>
          </div>
        `,
      });

      logger.info("Verification email sent successfully.");

      return {
        sent: true,
      };

    } catch (error) {
      await firestore.runTransaction(
        async (transaction) => {
          const snapshot = await transaction.get(verificationRef);

          if (snapshot.data()?.codeHash === codeHash) {
            transaction.delete(verificationRef);
          }
        }
      );

      logger.error(
        "Unable to send email verification code",
        { message: error.message }
      );

      throw new HttpsError(
        "unavailable",
        "We could not send the verification code. Check the email address and try again."
      );
    }
  }
);

// ==========================================
// 2. VERIFY EMAIL VERIFICATION CODE
// ==========================================

exports.verifyEmailVerificationCode = onCall(
  {
    secrets: [emailOtpSecret],

    cors: [
      "http://localhost:8100",
      "http://localhost:5173",
    ],
  },

  async (request) => {
    const email = normalizeEmail(request.data?.email);

    const code = request.data?.code;

    if (
      typeof code !== "string" ||
      !/^\d{6}$/.test(code)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Enter the 6-digit verification code."
      );
    }

    const verificationRef = emailVerificationRef(email);

    const token = randomBytes(32).toString("hex");

    const tokenHash = makeEmailVerificationHash(
      email,
      token
    );

    const result = await firestore.runTransaction(
      async (transaction) => {
        const snapshot = await transaction.get(verificationRef);

        const data = snapshot.data();

        if (
          !data ||
          !(data.expiresAt instanceof Timestamp) ||
          data.expiresAt.toMillis() <= Date.now() ||
          data.verified === true
        ) {
          if (snapshot.exists) {
            transaction.delete(verificationRef);
          }

          return "expired";
        }

        const submittedHash = makeEmailVerificationHash(
          email,
          code
        );

        if (!hashesMatch(data.codeHash, submittedHash)) {
          const attempts = Number(data.attempts || 0) + 1;

          if (attempts >= 5) {
            transaction.delete(verificationRef);
            return "locked";
          }

          transaction.update(verificationRef, {
            attempts,
          });

          return "incorrect";
        }

        transaction.update(verificationRef, {
          verified: true,

          tokenHash,

          tokenExpiresAt: Timestamp.fromMillis(
            Date.now() + 10 * 60_000
          ),

          codeHash: FieldValue.delete(),
        });

        return "verified";
      }
    );

    if (result === "expired") {
      throw new HttpsError(
        "deadline-exceeded",
        "The verification code expired. Request a new code."
      );
    }

    if (result === "locked") {
      throw new HttpsError(
        "resource-exhausted",
        "Too many incorrect codes. Request a new verification code."
      );
    }

    if (result !== "verified") {
      throw new HttpsError(
        "invalid-argument",
        "That verification code is incorrect."
      );
    }

    return {
      token,
    };
  }
);

// ==========================================
// 3. CONSUME EMAIL VERIFICATION TOKEN
// ==========================================

exports.consumeEmailVerificationToken = onCall(
  {
    secrets: [emailOtpSecret],

    cors: [
      "http://localhost:8100",
      "http://localhost:5173",
    ],
  },

  async (request) => {
    const email = normalizeEmail(request.data?.email);

    const token = request.data?.token;

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Verify your email before creating an account."
      );
    }

    const verificationRef = emailVerificationRef(email);

    const tokenHash = makeEmailVerificationHash(
      email,
      token
    );

    const isValid = await firestore.runTransaction(
      async (transaction) => {
        const snapshot = await transaction.get(verificationRef);

        const data = snapshot.data();

        if (
          !data ||
          data.verified !== true ||
          !(data.tokenExpiresAt instanceof Timestamp) ||
          data.tokenExpiresAt.toMillis() <= Date.now() ||
          !hashesMatch(data.tokenHash, tokenHash)
        ) {
          return false;
        }

        transaction.delete(verificationRef);

        return true;
      }
    );

    if (!isValid) {
      throw new HttpsError(
        "failed-precondition",
        "Email verification expired. Please verify your email again."
      );
    }

    return {
      verified: true,
    };
  }
);

// ==========================================
// 4. SCHEDULED ORGANIZATION POSTS
// ==========================================

exports.publishScheduledOrganizationPosts = onSchedule(
  "every 5 minutes",

  async () => {
    const now = Timestamp.now();

    const scheduledPosts = await firestore
      .collection("organizationPosts")
      .where("status", "==", "scheduled")
      .orderBy("scheduledAt", "asc")
      .limit(100)
      .get();

    for (const scheduledPost of scheduledPosts.docs) {
      const postData = scheduledPost.data();

      const publishAt = postData.scheduledAt;

      if (
        !publishAt ||
        publishAt.toMillis() > now.toMillis()
      ) {
        continue;
      }

      const publicationRef = firestore
        .collection("scheduledPostPublications")
        .doc(scheduledPost.id);

      const scholarshipId =
        typeof postData.scholarshipId === "string"
          ? postData.scholarshipId
          : "";

      const published = await firestore.runTransaction(
        async (transaction) => {
          const [currentPost, publication] =
            await Promise.all([
              transaction.get(scheduledPost.ref),
              transaction.get(publicationRef),
            ]);

          if (
            !currentPost.exists ||
            currentPost.data().status !== "scheduled" ||
            publication.exists
          ) {
            return false;
          }

          const currentData = currentPost.data();

          const currentPublishAt = currentData.scheduledAt;

          if (
            !currentPublishAt ||
            currentPublishAt.toMillis() > now.toMillis()
          ) {
            return false;
          }

          transaction.update(scheduledPost.ref, {
            status: "published",

            publishedAt: FieldValue.serverTimestamp(),

            updatedAt: FieldValue.serverTimestamp(),
          });

          if (scholarshipId) {
            transaction.update(
              firestore.collection("scholarships").doc(scholarshipId),
              {
                status: "published",

                publishedAt: FieldValue.serverTimestamp(),

                updatedAt: FieldValue.serverTimestamp(),
              }
            );
          }

          transaction.create(publicationRef, {
            status: "pending",

            postId: scheduledPost.id,

            scholarshipId,

            organizationId: currentData.organizationId || "",

            organizationName:
              currentData.organizationName || "Organization",

            title: currentData.title || "Organization update",

            category: currentData.category || "announcement",

            createdAt: FieldValue.serverTimestamp(),
          });

          return true;
        }
      );

      if (published) {
        logger.info(
          "Scheduled organization post published",
          { postId: scheduledPost.id }
        );
      }
    }

    // Deliver pending publications to students.
    const pendingPublications = await firestore
      .collection("scheduledPostPublications")
      .where("status", "==", "pending")
      .limit(20)
      .get();

    for (const publication of pendingPublications.docs) {
      const data = publication.data();

      const students = await firestore
        .collection("students")
        .get();

      for (
        let offset = 0;
        offset < students.docs.length;
        offset += 450
      ) {
        const batch = firestore.batch();

        students.docs
          .slice(offset, offset + 450)
          .forEach((student) => {
            const notificationId =
              `${publication.id}_${student.id}`;

            batch.set(
              firestore
                .collection("studentNotifications")
                .doc(notificationId),

              {
                studentId: student.id,

                title: data.scholarshipId
                  ? "New scholarship opportunity"
                  : "New organization announcement",

                message:
                  `${data.organizationName}: ${data.title}`,

                type: data.scholarshipId
                  ? "scholarship"
                  : "announcement",

                organizationId: data.organizationId,

                scholarshipId: data.scholarshipId,

                postId: data.postId,

                isRead: false,

                createdAt: FieldValue.serverTimestamp(),
              },

              { merge: true }
            );
          });

        await batch.commit();
      }

      await publication.ref.update({
        status: "delivered",

        deliveredAt: FieldValue.serverTimestamp(),
      });
    }
  }
);
