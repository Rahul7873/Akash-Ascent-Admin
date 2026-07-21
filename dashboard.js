document.addEventListener('DOMContentLoaded', function () {
    // 1. Session check (similar to main logic)
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var recentUsersList = document.getElementById('recent-users-list');

    // Helper functions for names and formatting
    function getUserDisplayName(user) {
        if (user.firstName || user.lastName) {
            return ((user.firstName || '') + ' ' + (user.lastName || '')).trim();
        }
        if (user.username) {
            return user.username;
        }
        if (user.email) {
            return user.email.split('@')[0];
        }
        return 'Anonymous User';
    }

    function getUserSubtext(user) {
        if (user.email) {
            return user.email;
        }
        if (user.phone || user.phoneNumber) {
            return user.phone || user.phoneNumber;
        }
        return 'No email/phone';
    }

    function getUserInitial(displayName) {
        if (displayName && displayName !== 'Anonymous User') {
            return displayName.trim().charAt(0).toUpperCase();
        }
        return 'U';
    }

    // List of deterministic avatar background and text color pairs
    var avatarThemes = [
        { bg: 'bg-blue-100', text: 'text-blue-600' },
        { bg: 'bg-purple-100', text: 'text-purple-600' },
        { bg: 'bg-emerald-100', text: 'text-emerald-600' },
        { bg: 'bg-amber-100', text: 'text-amber-600' },
        { bg: 'bg-rose-100', text: 'text-rose-600' },
        { bg: 'bg-indigo-100', text: 'text-indigo-600' }
    ];

    function getAvatarTheme(name) {
        var code = 0;
        for (var i = 0; i < name.length; i++) {
            code += name.charCodeAt(i);
        }
        return avatarThemes[code % avatarThemes.length];
    }

    function parseTimestamp(value) {
        if (value === undefined || value === null) return NaN;
        var time;
        if (typeof value === 'number') {
            time = value;
        } else if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
            time = Number(value);
        } else {
            time = Date.parse(value);
        }
        
        if (isNaN(time)) return NaN;
        
        // Convert seconds to milliseconds if applicable
        if (time < 30000000000) {
            time = time * 1000;
        }
        return time;
    }

    function formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        var time = parseTimestamp(timestamp);
        if (isNaN(time)) return '';

        var seconds = Math.floor((Date.now() - time) / 1000);
        if (seconds < 0) seconds = 0;

        var interval = Math.floor(seconds / 31536000);
        if (interval >= 1) return interval + 'y ago';

        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) return interval + 'mo ago';

        interval = Math.floor(seconds / 86400);
        if (interval >= 1) return interval + 'd ago';

        interval = Math.floor(seconds / 3600);
        if (interval >= 1) return interval + 'h ago';

        interval = Math.floor(seconds / 60);
        if (interval >= 1) return interval + 'm ago';

        return 'just now';
    }

    // Fetch the 3 most recently created users
    firebase.database().ref('users').limitToLast(3).once('value').then(function (snapshot) {
        if (!recentUsersList) return;
        recentUsersList.innerHTML = '';

        if (!snapshot.exists()) {
            recentUsersList.innerHTML = '<p class="text-xs text-gray-500 py-2">No recent users.</p>';
            return;
        }

        var usersObj = snapshot.val();
        var userKeys = Object.keys(usersObj || {});

        if (userKeys.length === 0) {
            recentUsersList.innerHTML = '<p class="text-xs text-gray-500 py-2">No recent users.</p>';
            return;
        }

        // Convert to array and reverse to have the newest first
        var usersList = [];
        userKeys.forEach(function (key) {
            usersList.push(usersObj[key]);
        });
        usersList.reverse();

        usersList.forEach(function (user) {
            var name = getUserDisplayName(user);
            var subtext = getUserSubtext(user);
            var initial = getUserInitial(name);
            var theme = getAvatarTheme(name);
            var timeAgo = formatTimeAgo(user.createdAt);

            var userRow = document.createElement('div');
            userRow.className = 'flex items-center gap-3 w-full border-b border-gray-50 pb-2 last:pb-0 last:border-b-0';

            // Build the user element HTML
            userRow.innerHTML = `
                <div class="w-8 h-8 rounded-full ${theme.bg} ${theme.text} flex items-center justify-center text-xs font-bold shrink-0">
                    ${initial}
                </div>
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-semibold text-gray-800 truncate" title="${name}">${name}</p>
                    <p class="text-[10px] text-gray-400 truncate" title="${subtext}">${subtext}</p>
                </div>
                ${timeAgo ? `<span class="text-[9px] font-medium text-gray-400 shrink-0 bg-gray-50 px-1.5 py-0.5 rounded">${timeAgo}</span>` : ''}
            `;
            recentUsersList.appendChild(userRow);
        });

    }).catch(function (error) {
        console.error('Error fetching recent users:', error);
        if (recentUsersList) {
            recentUsersList.innerHTML = '<p class="text-xs text-red-500 py-2">Failed to load</p>';
        }
    });
});
