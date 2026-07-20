import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
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
