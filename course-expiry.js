// Course Expiry & Cancellation Utility
// Rule: Start Date = User Purchase Date. Course purchase automatically cancels on the end day & end month of every year.
// Notifications sent: 10 days, 5 days, 3 days, 2 days, 1 day before expiry, and on the Expiry Day.

const MONTH_MAP = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11
};

const NOTIFICATION_THRESHOLDS = [10, 5, 3, 2, 1, 0];

/**
 * Checks if a purchase has expired based on its annual end day and end month.
 */
function isPurchaseExpired(purchaseDateInput, durationEndDay, durationEndMonth) {
    if (!durationEndDay || !durationEndMonth) return false;

    var endDay = parseInt(durationEndDay, 10);
    var monthKey = String(durationEndMonth).trim().toLowerCase();
    var endMonth = MONTH_MAP[monthKey];

    if (isNaN(endDay) || endMonth === undefined) return false;

    var purchaseDate = new Date(purchaseDateInput);
    if (isNaN(purchaseDate.getTime())) return false;

    var currentDate = new Date();

    var expiryDate = new Date(purchaseDate.getFullYear(), endMonth, endDay, 23, 59, 59, 999);

    if (purchaseDate.getTime() > expiryDate.getTime()) {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }

    return currentDate.getTime() > expiryDate.getTime();
}

/**
 * Calculates remaining days until course annual expiry.
 */
function getDaysUntilExpiry(purchaseDateInput, durationEndDay, durationEndMonth) {
    if (!durationEndDay || !durationEndMonth) return null;

    var endDay = parseInt(durationEndDay, 10);
    var monthKey = String(durationEndMonth).trim().toLowerCase();
    var endMonth = MONTH_MAP[monthKey];

    if (isNaN(endDay) || endMonth === undefined) return null;

    var purchaseDate = new Date(purchaseDateInput);
    if (isNaN(purchaseDate.getTime())) return null;

    var currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    var expiryDate = new Date(purchaseDate.getFullYear(), endMonth, endDay, 0, 0, 0, 0);

    if (purchaseDate.getTime() > expiryDate.getTime()) {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }

    var diffMs = expiryDate.getTime() - currentDate.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Generates notification payload for a given threshold (10, 5, 3, 2, 1, or 0 days).
 */
function getExpiryNotificationData(daysRemaining, courseName, durationEndDay, durationEndMonth) {
    var title = '';
    var message = '';

    if (daysRemaining === 10) {
        title = '⏳ Course Expiry Reminder (10 Days Left)';
        message = 'Your access to "' + courseName + '" will expire in 10 days on ' + durationEndDay + ' ' + durationEndMonth + '. Please renew to maintain uninterrupted access.';
    } else if (daysRemaining === 5) {
        title = '⌛ Course Expiry Reminder (5 Days Left)';
        message = 'Your access to "' + courseName + '" will expire in 5 days on ' + durationEndDay + ' ' + durationEndMonth + '. Renew now to continue learning.';
    } else if (daysRemaining === 3) {
        title = '⚠️ Course Expiry Alert (3 Days Left)';
        message = 'Only 3 days remaining for your course "' + courseName + '". Validity ends on ' + durationEndDay + ' ' + durationEndMonth + '.';
    } else if (daysRemaining === 2) {
        title = '⚠️ Course Expiry Warning (2 Days Left)';
        message = 'Only 2 days remaining for your course "' + courseName + '". Access will expire on ' + durationEndDay + ' ' + durationEndMonth + '.';
    } else if (daysRemaining === 1) {
        title = '🚨 Course Expiring Tomorrow!';
        message = 'Your course "' + courseName + '" expires tomorrow on ' + durationEndDay + ' ' + durationEndMonth + '. Final chance to renew your subscription.';
    } else if (daysRemaining === 0) {
        title = '🚨 Final Notice: Course Expiring Today!';
        message = 'Today (' + durationEndDay + ' ' + durationEndMonth + ') is the last day of your course "' + courseName + '". Access will be cancelled at midnight.';
    }

    return {
        title: title,
        message: message,
        courseName: courseName,
        daysRemaining: daysRemaining,
        type: 'expiry_notification',
        read: false
    };
}

/**
 * Evaluates all user purchases against playlists and updates status to 'cancelled' for expired purchases.
 */
function getExpiredPurchaseUpdates(usersObj, playlistsObj) {
    var updates = {};
    if (!usersObj || !playlistsObj) return updates;

    Object.keys(usersObj).forEach(function(userId) {
        var user = usersObj[userId];
        if (!user) return;

        var purchases = user.purchases || user.subscriptions || user.myCourses || {};

        Object.keys(purchases).forEach(function(purchaseKey) {
            var purchase = purchases[purchaseKey];
            if (!purchase || purchase.status === 'cancelled' || purchase.status === 'expired') return;

            var playlistId = purchase.playlistId || purchase.courseId || purchaseKey;
            var playlist = playlistsObj[playlistId];
            if (!playlist) return;

            var purchaseDateMs = purchase.purchasedAt || purchase.createdAt || purchase.date || user.createdAt;
            var endDay = playlist.durationEndDay;
            var endMonth = playlist.durationEndMonth;

            if (purchaseDateMs && isPurchaseExpired(purchaseDateMs, endDay, endMonth)) {
                updates['users/' + userId + '/purchases/' + purchaseKey + '/status'] = 'cancelled';
                updates['users/' + userId + '/purchases/' + purchaseKey + '/cancelledAt'] = Date.now();
                updates['users/' + userId + '/purchases/' + purchaseKey + '/cancellationReason'] = 'Annual validity ended on ' + endDay + ' ' + endMonth;
            }
        });
    });

    return updates;
}

/**
 * Generates notification database updates for all user purchases matching notification thresholds (10, 5, 3, 2, 1, 0 days).
 */
function getExpiryNotificationUpdates(usersObj, playlistsObj) {
    var updates = {};
    if (!usersObj || !playlistsObj) return updates;

    var currentYear = new Date().getFullYear();

    Object.keys(usersObj).forEach(function(userId) {
        var user = usersObj[userId];
        if (!user) return;

        var purchases = user.purchases || user.subscriptions || user.myCourses || {};
        var existingNotifications = user.notifications || {};

        Object.keys(purchases).forEach(function(purchaseKey) {
            var purchase = purchases[purchaseKey];
            if (!purchase || purchase.status === 'cancelled' || purchase.status === 'expired') return;

            var playlistId = purchase.playlistId || purchase.courseId || purchaseKey;
            var playlist = playlistsObj[playlistId];
            if (!playlist) return;

            var purchaseDateMs = purchase.purchasedAt || purchase.createdAt || purchase.date || user.createdAt;
            var endDay = playlist.durationEndDay;
            var endMonth = playlist.durationEndMonth;
            var courseName = playlist.name || playlist.title || 'Course';

            var daysRemaining = getDaysUntilExpiry(purchaseDateMs, endDay, endMonth);

            if (daysRemaining !== null && NOTIFICATION_THRESHOLDS.indexOf(daysRemaining) !== -1) {
                // Check if notification for this threshold & course & year was already sent
                var notifId = 'notif_expiry_' + playlistId + '_' + daysRemaining + 'd_' + currentYear;

                if (!existingNotifications[notifId]) {
                    var notifData = getExpiryNotificationData(daysRemaining, courseName, endDay, endMonth);
                    notifData.playlistId = playlistId;
                    notifData.sentAt = Date.now();

                    updates['users/' + userId + '/notifications/' + notifId] = notifData;
                }
            }
        });
    });

    return updates;
}

// Export for Node environments (Firebase Functions) & Browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isPurchaseExpired: isPurchaseExpired,
        getDaysUntilExpiry: getDaysUntilExpiry,
        getExpiryNotificationData: getExpiryNotificationData,
        getExpiredPurchaseUpdates: getExpiredPurchaseUpdates,
        getExpiryNotificationUpdates: getExpiryNotificationUpdates,
        NOTIFICATION_THRESHOLDS: NOTIFICATION_THRESHOLDS,
        MONTH_MAP: MONTH_MAP
    };
}
