import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onValueCreated } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";

admin.initializeApp();

setGlobalOptions({ maxInstances: 10 });

export const getRecentUsers = onCall(async (request) => {
  const database = admin.database();
  const auth = admin.auth();

  try {
    // 1. Fetch all users from Firebase Auth
    const listUsersResult = await auth.listUsers();

    // 2. Fetch all user profile details from Realtime Database
    const dbUsersSnapshot = await database.ref("users").once("value");
    const dbUsers = dbUsersSnapshot.val() || {};

    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const recentUsersList: any[] = [];

    // Map DB users by their UID for fast lookup
    const dbUsersByUid: { [uid: string]: { key: string, data: any } } = {};
    for (const key in dbUsers) {
      if (dbUsers.hasOwnProperty(key)) {
        const user = dbUsers[key];
        if (user && user.uid) {
          dbUsersByUid[user.uid] = { key, data: user };
        }
      }
    }

    // 3. Filter Auth users active in the last 24 hours
    listUsersResult.users.forEach((userRecord) => {
      const lastSignInTime = userRecord.metadata.lastSignInTime
        ? Date.parse(userRecord.metadata.lastSignInTime)
        : 0;
      const creationTime = userRecord.metadata.creationTime
        ? Date.parse(userRecord.metadata.creationTime)
        : 0;

      const activeTime = Math.max(lastSignInTime, creationTime);

      if (now - activeTime <= twentyFourHours && now - activeTime >= 0) {
        const dbUserMatch = dbUsersByUid[userRecord.uid];
        if (dbUserMatch) {
          recentUsersList.push({
            userId: dbUserMatch.key,
            ...dbUserMatch.data,
            login: lastSignInTime || creationTime,
            createdAt: creationTime
          });
        } else {
          recentUsersList.push({
            userId: "Auth Only",
            uid: userRecord.uid,
            email: userRecord.email || "-",
            phoneNumber: userRecord.phoneNumber || "-",
            login: lastSignInTime || creationTime,
            createdAt: creationTime
          });
        }
      }
    });

    return { users: recentUsersList };
  } catch (error: any) {
    throw new HttpsError("internal", error.message || "Failed to fetch users");
  }
});

const MONTH_MAP: { [key: string]: number } = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11
};

function isPurchaseExpired(purchaseDateInput: any, durationEndDay: string | number, durationEndMonth: string): boolean {
  if (!durationEndDay || !durationEndMonth) return false;

  const endDay = parseInt(String(durationEndDay), 10);
  const monthKey = String(durationEndMonth).trim().toLowerCase();
  const endMonth = MONTH_MAP[monthKey];

  if (isNaN(endDay) || endMonth === undefined) return false;

  const purchaseDate = new Date(purchaseDateInput);
  if (isNaN(purchaseDate.getTime())) return false;

  const currentDate = new Date();
  const expiryDate = new Date(purchaseDate.getFullYear(), endMonth, endDay, 23, 59, 59, 999);

  if (purchaseDate.getTime() > expiryDate.getTime()) {
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  }

  return currentDate.getTime() > expiryDate.getTime();
}

export const cancelExpiredPurchases = onCall(async (request) => {
  const database = admin.database();

  try {
    const [usersSnap, playlistsSnap] = await Promise.all([
      database.ref("users").once("value"),
      database.ref("playlists").once("value")
    ]);

    const users = usersSnap.val() || {};
    const playlists = playlistsSnap.val() || {};
    const updates: { [key: string]: any } = {};
    let cancelledCount = 0;

    Object.keys(users).forEach((userId) => {
      const user = users[userId];
      if (!user) return;

      const purchases = user.purchases || user.subscriptions || user.myCourses || {};
      Object.keys(purchases).forEach((purchaseKey) => {
        const purchase = purchases[purchaseKey];
        if (!purchase || purchase.status === "cancelled" || purchase.status === "expired") return;

        const playlistId = purchase.playlistId || purchase.courseId || purchaseKey;
        const playlist = playlists[playlistId];
        if (!playlist) return;

        const purchaseDateMs = purchase.purchasedAt || purchase.createdAt || purchase.date || user.createdAt;
        const endDay = playlist.durationEndDay;
        const endMonth = playlist.durationEndMonth;

        if (purchaseDateMs && isPurchaseExpired(purchaseDateMs, endDay, endMonth)) {
          updates[`users/${userId}/purchases/${purchaseKey}/status`] = "cancelled";
          updates[`users/${userId}/purchases/${purchaseKey}/cancelledAt`] = admin.database.ServerValue.TIMESTAMP;
          updates[`users/${userId}/purchases/${purchaseKey}/cancellationReason`] = `Annual course validity ended on ${endDay} ${endMonth}`;
          cancelledCount++;
        }
      });
    });

    if (Object.keys(updates).length > 0) {
      await database.ref().update(updates);
    }

    return { success: true, cancelledCount };
  } catch (error: any) {
    throw new HttpsError("internal", error.message || "Failed to cancel expired purchases");
  }
});

function getDaysUntilExpiry(purchaseDateInput: any, durationEndDay: string | number, durationEndMonth: string): number | null {
  if (!durationEndDay || !durationEndMonth) return null;

  const endDay = parseInt(String(durationEndDay), 10);
  const monthKey = String(durationEndMonth).trim().toLowerCase();
  const endMonth = MONTH_MAP[monthKey];

  if (isNaN(endDay) || endMonth === undefined) return null;

  const purchaseDate = new Date(purchaseDateInput);
  if (isNaN(purchaseDate.getTime())) return null;

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const expiryDate = new Date(purchaseDate.getFullYear(), endMonth, endDay, 0, 0, 0, 0);

  if (purchaseDate.getTime() > expiryDate.getTime()) {
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  }

  const diffMs = expiryDate.getTime() - currentDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

const NOTIFICATION_THRESHOLDS = [10, 5, 3, 2, 1, 0];

export const sendExpiryNotifications = onCall(async (request) => {
  const database = admin.database();

  try {
    const [usersSnap, playlistsSnap] = await Promise.all([
      database.ref("users").once("value"),
      database.ref("playlists").once("value")
    ]);

    const users = usersSnap.val() || {};
    const playlists = playlistsSnap.val() || {};
    const updates: { [key: string]: any } = {};
    const currentYear = new Date().getFullYear();
    let sentCount = 0;

    Object.keys(users).forEach((userId) => {
      const user = users[userId];
      if (!user) return;

      const purchases = user.purchases || user.subscriptions || user.myCourses || {};
      const existingNotifications = user.notifications || {};

      Object.keys(purchases).forEach((purchaseKey) => {
        const purchase = purchases[purchaseKey];
        if (!purchase || purchase.status === "cancelled" || purchase.status === "expired") return;

        const playlistId = purchase.playlistId || purchase.courseId || purchaseKey;
        const playlist = playlists[playlistId];
        if (!playlist) return;

        const purchaseDateMs = purchase.purchasedAt || purchase.createdAt || purchase.date || user.createdAt;
        const endDay = playlist.durationEndDay;
        const endMonth = playlist.durationEndMonth;
        const courseName = playlist.name || playlist.title || "Course";

        const daysRemaining = getDaysUntilExpiry(purchaseDateMs, endDay, endMonth);

        if (daysRemaining !== null && NOTIFICATION_THRESHOLDS.includes(daysRemaining)) {
          const notifId = `notif_expiry_${playlistId}_${daysRemaining}d_${currentYear}`;

          if (!existingNotifications[notifId]) {
            let title = "";
            let message = "";

            if (daysRemaining === 10) {
              title = "⏳ Course Expiry Reminder (10 Days Left)";
              message = `Your access to "${courseName}" will expire in 10 days on ${endDay} ${endMonth}. Please renew to maintain access.`;
            } else if (daysRemaining === 5) {
              title = "⌛ Course Expiry Reminder (5 Days Left)";
              message = `Your access to "${courseName}" will expire in 5 days on ${endDay} ${endMonth}.`;
            } else if (daysRemaining === 3) {
              title = "⚠️ Course Expiry Alert (3 Days Left)";
              message = `Only 3 days remaining for your course "${courseName}". Validity ends on ${endDay} ${endMonth}.`;
            } else if (daysRemaining === 2) {
              title = "⚠️ Course Expiry Warning (2 Days Left)";
              message = `Only 2 days remaining for your course "${courseName}". Access will expire on ${endDay} ${endMonth}.`;
            } else if (daysRemaining === 1) {
              title = "🚨 Course Expiring Tomorrow!";
              message = `Your course "${courseName}" expires tomorrow on ${endDay} ${endMonth}. Final chance to renew.`;
            } else if (daysRemaining === 0) {
              title = "🚨 Final Notice: Course Expiring Today!";
              message = `Today (${endDay} ${endMonth}) is the last day of your course "${courseName}". Access will be cancelled at midnight.`;
            }

            updates[`users/${userId}/notifications/${notifId}`] = {
              title,
              message,
              courseName,
              playlistId,
              daysRemaining,
              type: "expiry_notification",
              read: false,
              sentAt: admin.database.ServerValue.TIMESTAMP
            };
            sentCount++;
          }
        }
      });
    });

    if (Object.keys(updates).length > 0) {
      await database.ref().update(updates);
    }

    return { success: true, sentCount };
  } catch (error: any) {
    throw new HttpsError("internal", error.message || "Failed to send expiry notifications");
  }
});

export const sendAndroidFCMNotification = onCall(async (request) => {
  const database = admin.database();
  const messaging = admin.messaging();

  const { title, message, photoUrl, targetAudience } = request.data || {};

  if (!title || !message) {
    throw new HttpsError("invalid-argument", "Title and message are required.");
  }

  try {
    const usersSnap = await database.ref("users").once("value");
    const users = usersSnap.val() || {};
    const fcmTokens: string[] = [];

    Object.keys(users).forEach((userId) => {
      const user = users[userId];
      if (!user) return;

      let isMatch = false;
      if (targetAudience === "android_all" || targetAudience === "all" || !targetAudience) {
        isMatch = true;
      } else if (targetAudience.startsWith("class_")) {
        const targetClass = targetAudience.replace("class_", "");
        if (user.class === targetClass || user.preferenceClass === targetClass || user.courseClass === targetClass) {
          isMatch = true;
        }
      }

      if (isMatch) {
        const token = user.fcmToken || user.fcm_token || user.deviceToken || user.androidToken || user.messagingToken;
        if (token && typeof token === "string" && !fcmTokens.includes(token)) {
          fcmTokens.push(token);
        }
      }
    });

    let successCount = 0;
    let failureCount = 0;

    if (fcmTokens.length > 0) {
      const multicastMessage: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: {
          title: title,
          body: message,
          ...(photoUrl ? { imageUrl: photoUrl } : {})
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "high_importance_channel",
            ...(photoUrl ? { imageUrl: photoUrl } : {})
          }
        },
        data: {
          title: title,
          message: message,
          photoUrl: photoUrl || "",
          click_action: "FLUTTER_NOTIFICATION_CLICK"
        }
      };

      const response = await messaging.sendEachForMulticast(multicastMessage);
      successCount = response.successCount;
      failureCount = response.failureCount;
    }

    try {
      await messaging.send({
        topic: "all_android_users",
        notification: {
          title: title,
          body: message,
          ...(photoUrl ? { imageUrl: photoUrl } : {})
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "high_importance_channel"
          }
        },
        data: {
          title: title,
          message: message,
          photoUrl: photoUrl || ""
        }
      });
    } catch (topicErr) {
      // topic optional broadcast
    }

    return {
      success: true,
      sentTokensCount: fcmTokens.length,
      successCount,
      failureCount
    };
  } catch (error: any) {
    throw new HttpsError("internal", error.message || "Failed to send Android FCM push notification");
  }
});

export const onBroadcastNotificationCreated = onValueCreated(
  "/broadcast_notifications/{notifId}",
  async (event) => {
    const notif = event.data.val();
    if (!notif) return;

    const { title, message, photoUrl, targetAudience } = notif;
    if (!title || !message) return;

    const database = admin.database();
    const messaging = admin.messaging();

    try {
      const usersSnap = await database.ref("users").once("value");
      const users = usersSnap.val() || {};
      const fcmTokens: string[] = [];

      Object.keys(users).forEach((userId) => {
        const user = users[userId];
        if (!user) return;

        let isMatch = false;
        if (targetAudience === "android_all" || targetAudience === "all" || !targetAudience) {
          isMatch = true;
        } else if (targetAudience.startsWith("class_")) {
          const targetClass = targetAudience.replace("class_", "");
          if (user.class === targetClass || user.preferenceClass === targetClass || user.courseClass === targetClass) {
            isMatch = true;
          }
        }

        if (isMatch) {
          const token = user.fcmToken || user.fcm_token || user.deviceToken || user.androidToken || user.messagingToken;
          if (token && typeof token === "string" && !fcmTokens.includes(token)) {
            fcmTokens.push(token);
          }
        }
      });

      if (fcmTokens.length > 0) {
        await messaging.sendEachForMulticast({
          tokens: fcmTokens,
          notification: {
            title: title,
            body: message,
            ...(photoUrl ? { imageUrl: photoUrl } : {})
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId: "high_importance_channel",
              ...(photoUrl ? { imageUrl: photoUrl } : {})
            }
          },
          data: {
            title: title,
            message: message,
            photoUrl: photoUrl || "",
            click_action: "FLUTTER_NOTIFICATION_CLICK"
          }
        });
      }

      await messaging.send({
        topic: "all_android_users",
        notification: {
          title: title,
          body: message,
          ...(photoUrl ? { imageUrl: photoUrl } : {})
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "high_importance_channel"
          }
        },
        data: {
          title: title,
          message: message,
          photoUrl: photoUrl || ""
        }
      });
    } catch (err) {
      console.error("Auto DB Push Trigger error:", err);
    }
  }
);
