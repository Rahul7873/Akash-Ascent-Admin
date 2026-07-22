document.addEventListener('DOMContentLoaded', function() {
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var statusMessage = document.getElementById('status-message');
    var usersTableHead = document.getElementById('users-table-head');
    var usersTableBody = document.getElementById('users-table-body');
    var emptyState = document.getElementById('empty-state');
    var emptyTitle = document.getElementById('empty-title');
    var emptyDescription = document.getElementById('empty-description');

    var filter24hBtn = document.getElementById('filter-24h-btn');
    var dateFilterInput = document.getElementById('date-filter');
    var clearFilterBtn = document.getElementById('clear-filter-btn');

    var rawUsersData = {};
    var currentFilterMode = '24h'; // '24h', 'date', 'all'
    var selectedDateString = '';

    function showStatus(text) {
        if (statusMessage) {
            statusMessage.textContent = text;
        }
    }

    function labelizeField(field) {
        return field
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, function(char) { return char.toUpperCase(); })
            .trim();
    }

    function parseTimestamp(value) {
        if (value === undefined || value === null || value === '' || value === '-') return NaN;

        // 1. If numeric or numeric string (like 1784582520000 or "1784582520000")
        if (typeof value === 'number') {
            var time = value;
            if (time < 30000000000) time = time * 1000;
            return time;
        }

        var str = String(value).trim();
        if (str === '' || str === '-') return NaN;

        // Pure digits (e.g. "1784089352363" or "1784089352")
        if (/^\d+$/.test(str)) {
            var num = Number(str);
            if (num < 30000000000) num = num * 1000;
            return num;
        }

        // 2. Match DD-MM-YYYY or DD/MM/YYYY format with optional time & AM/PM
        // Examples: "20-07-2026 22:42:00", "20/07/2026 22:42:00", "20-07-2026"
        var matchDDMM = str.match(/^(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?(?:\s*(am|pm))?$/i);
        if (matchDDMM) {
            var day = parseInt(matchDDMM[1], 10);
            var month = parseInt(matchDDMM[2], 10);
            var year = parseInt(matchDDMM[3], 10);
            var hour = parseInt(matchDDMM[4] || '0', 10);
            var minute = parseInt(matchDDMM[5] || '0', 10);
            var second = parseInt(matchDDMM[6] || '0', 10);
            var ampm = matchDDMM[7] ? matchDDMM[7].toLowerCase() : null;

            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;

            var d = new Date(year, month - 1, day, hour, minute, second);
            if (!isNaN(d.getTime())) {
                return d.getTime();
            }
        }

        // 3. Match YYYY-MM-DD or YYYY/MM/DD format with optional time & AM/PM
        var matchYYYYMM = str.match(/^(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?(?:\s*(am|pm))?$/i);
        if (matchYYYYMM) {
            var year = parseInt(matchYYYYMM[1], 10);
            var month = parseInt(matchYYYYMM[2], 10);
            var day = parseInt(matchYYYYMM[3], 10);
            var hour = parseInt(matchYYYYMM[4] || '0', 10);
            var minute = parseInt(matchYYYYMM[5] || '0', 10);
            var second = parseInt(matchYYYYMM[6] || '0', 10);
            var ampm = matchYYYYMM[7] ? matchYYYYMM[7].toLowerCase() : null;

            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;

            var d = new Date(year, month - 1, day, hour, minute, second);
            if (!isNaN(d.getTime())) {
                return d.getTime();
            }
        }

        // 4. Fallback to native Date.parse
        var stdParsed = Date.parse(str);
        if (!isNaN(stdParsed)) {
            if (stdParsed < 30000000000) stdParsed = stdParsed * 1000;
            return stdParsed;
        }

        return NaN;
    }

    function getUserLastLoginTime(userData) {
        if (!userData) return NaN;
        var fields = [
            'login', 'lastLogin', 'last_login', 'loginTime', 'login_time',
            'lastSeen', 'last_seen', 'updatedAt', 'created_at', 'createdAt'
        ];
        for (var i = 0; i < fields.length; i++) {
            var val = userData[fields[i]];
            if (val !== undefined && val !== null && val !== '' && val !== false && val !== '-') {
                if (typeof val === 'boolean' && val === true) {
                    return Date.now();
                }
                var parsed = parseTimestamp(val);
                if (!isNaN(parsed) && parsed > 0) {
                    return parsed;
                }
            }
        }
        return NaN;
    }

    function buildHeader(columns) {
        usersTableHead.innerHTML = '';
        columns.forEach(function(column) {
            var th = document.createElement('th');
            th.className = 'px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider';
            th.textContent = column.label;
            usersTableHead.appendChild(th);
        });
    }

    function createRow(userKey, userData, columns) {
        var tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 hover:bg-gray-50';

        columns.forEach(function(column) {
            var td = document.createElement('td');
            td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-700';
            var value = column.key === 'userId' ? userKey : userData[column.key];
            if (value === undefined || value === null || value === '') {
                value = '-';
            } else if (column.key === 'login' || column.key === 'lastLogin' || column.key === 'createdAt') {
                if (typeof value === 'string' && value.includes('-') && value.includes(':')) {
                    // Keep exact pre-formatted date string as is (e.g. "20-07-2026 22:42:00")
                } else {
                    var parsed = parseTimestamp(value);
                    if (!isNaN(parsed)) {
                        value = new Date(parsed).toLocaleString();
                    }
                }
            }
            td.textContent = value;
            tr.appendChild(td);
        });

        return tr;
    }

    function isObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function flattenUserData(userData) {
        var flattened = {};
        Object.keys(userData || {}).forEach(function(key) {
            if (key === 'notifications' || key === 'notification') return;
            var value = userData[key];
            if (isObject(value)) {
                flattened[key] = JSON.stringify(value);
            } else {
                flattened[key] = value;
            }
        });
        return flattened;
    }

    function matchesFilter(userData) {
        if (currentFilterMode === 'all') {
            return true;
        }

        var loginTime = getUserLastLoginTime(userData);

        if (currentFilterMode === '24h') {
            if (isNaN(loginTime)) {
                // Include user if no timestamp parsed, so no user is hidden
                return true;
            }
            var now = Date.now();
            var twentyFourHours = 24 * 60 * 60 * 1000;
            var diff = now - loginTime;
            // Include if logged in within 24h window (with 12h margin for clock/timezone difference)
            return diff >= -86400000 && diff <= (twentyFourHours + 12 * 3600 * 1000);
        }

        if (currentFilterMode === 'date' && selectedDateString) {
            if (isNaN(loginTime)) return false;
            var loginDate = new Date(loginTime);

            var parts = selectedDateString.split('-');
            if (parts.length === 3) {
                var targetYear = parseInt(parts[0], 10);
                var targetMonth = parseInt(parts[1], 10) - 1;
                var targetDay = parseInt(parts[2], 10);

                return loginDate.getFullYear() === targetYear &&
                       loginDate.getMonth() === targetMonth &&
                       loginDate.getDate() === targetDay;
            }
        }

        return true;
    }

    function updateButtonUI() {
        if (!filter24hBtn) return;
        if (currentFilterMode === '24h') {
            filter24hBtn.className = 'px-4 py-2 text-xs font-semibold rounded-full bg-blue-600 text-white border border-blue-600 shadow-sm transition cursor-pointer';
            if (dateFilterInput && dateFilterInput.parentElement && dateFilterInput.parentElement.parentElement) {
                dateFilterInput.parentElement.parentElement.className = 'relative flex items-center bg-gray-50 border border-gray-300 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-blue-500 transition';
            }
        } else if (currentFilterMode === 'date') {
            filter24hBtn.className = 'px-4 py-2 text-xs font-semibold rounded-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition cursor-pointer';
            if (dateFilterInput && dateFilterInput.parentElement && dateFilterInput.parentElement.parentElement) {
                dateFilterInput.parentElement.parentElement.className = 'relative flex items-center bg-blue-50 border border-blue-500 rounded-full px-4 py-2 ring-2 ring-blue-500 transition';
            }
        } else { // 'all'
            filter24hBtn.className = 'px-4 py-2 text-xs font-semibold rounded-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition cursor-pointer';
            if (dateFilterInput && dateFilterInput.parentElement && dateFilterInput.parentElement.parentElement) {
                dateFilterInput.parentElement.parentElement.className = 'relative flex items-center bg-gray-50 border border-gray-300 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-blue-500 transition';
            }
        }
    }

    function renderFilteredUsers() {
        updateButtonUI();
        usersTableBody.innerHTML = '';

        var userKeys = Object.keys(rawUsersData || {});
        if (userKeys.length === 0) {
            emptyState.classList.remove('hidden');
            if (emptyTitle) emptyTitle.textContent = 'No users available.';
            if (emptyDescription) emptyDescription.textContent = 'No user accounts exist in the database.';
            showStatus('No users found in database.');
            return;
        }

        var columnMap = new Map();
        columnMap.set('userId', { key: 'userId', label: 'User ID' });
        var rows = [];

        userKeys.forEach(function(key) {
            var rawData = rawUsersData[key] || {};
            if (matchesFilter(rawData)) {
                var userData = flattenUserData(rawData);
                rows.push({ key: key, data: userData, raw: rawData });
                Object.keys(userData).forEach(function(field) {
                    if (field !== 'notifications' && field !== 'notification' && !columnMap.has(field)) {
                        columnMap.set(field, {
                            key: field,
                            label: labelizeField(field)
                        });
                    }
                });
            }
        });

        if (rows.length === 0) {
            emptyState.classList.remove('hidden');
            var filterDesc = currentFilterMode === '24h' 
                ? 'in the last 24 hours.' 
                : (currentFilterMode === 'date' ? 'on date ' + selectedDateString + '.' : 'matching filter criteria.');
            if (emptyTitle) emptyTitle.textContent = 'No matching recent users.';
            if (emptyDescription) emptyDescription.textContent = 'No user accounts logged in ' + filterDesc;
            showStatus('No users found ' + filterDesc);
            return;
        }

        // Sort rows by recency of last login time
        rows.sort(function(a, b) {
            var timeA = getUserLastLoginTime(a.raw);
            if (isNaN(timeA)) timeA = 0;

            var timeB = getUserLastLoginTime(b.raw);
            if (isNaN(timeB)) timeB = 0;

            if (timeA === timeB) {
                return b.key.localeCompare(a.key);
            }
            return timeB - timeA;
        });

        // Ensure common fields appear first
        var preferredFields = ['userId', 'firstName', 'lastName', 'username', 'email', 'phoneNumber', 'phone', 'login', 'lastLogin', 'createdAt'];
        var columns = [];
        preferredFields.forEach(function(field) {
            if (columnMap.has(field)) {
                columns.push(columnMap.get(field));
                columnMap.delete(field);
            }
        });

        columnMap.forEach(function(value) {
            columns.push(value);
        });

        buildHeader(columns);

        rows.forEach(function(row) {
            usersTableBody.appendChild(createRow(row.key, row.data, columns));
        });

        emptyState.classList.add('hidden');
        var statusLabel = currentFilterMode === '24h'
            ? 'active in the last 24 hours.'
            : (currentFilterMode === 'date' ? 'logged in on ' + selectedDateString + '.' : 'all registered users.');
        showStatus('Loaded ' + rows.length + ' user' + (rows.length === 1 ? '' : 's') + ' (' + statusLabel + ')');
    }

    function handleDateFilterChange() {
        if (dateFilterInput && dateFilterInput.value) {
            currentFilterMode = 'date';
            selectedDateString = dateFilterInput.value;
        } else {
            currentFilterMode = '24h';
            selectedDateString = '';
        }
        renderFilteredUsers();
    }

    // Set up filter controls event listeners
    if (filter24hBtn) {
        filter24hBtn.addEventListener('click', function() {
            currentFilterMode = '24h';
            selectedDateString = '';
            if (dateFilterInput) dateFilterInput.value = '';
            renderFilteredUsers();
        });
    }

    if (dateFilterInput) {
        dateFilterInput.addEventListener('change', handleDateFilterChange);
        dateFilterInput.addEventListener('input', handleDateFilterChange);
    }

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', function() {
            currentFilterMode = 'all';
            selectedDateString = '';
            if (dateFilterInput) dateFilterInput.value = '';
            renderFilteredUsers();
        });
    }

    // Fetch data from Firebase Realtime Database
    showStatus('Loading users from database...');
    firebase.database().ref('users').once('value').then(function(snapshot) {
        if (!snapshot.exists()) {
            rawUsersData = {};
        } else {
            rawUsersData = snapshot.val() || {};
        }
        renderFilteredUsers();
    }).catch(function(error) {
        console.error('Fetch users failed:', error);
        showStatus('Failed to load users. Please refresh the page.');
    });
});
