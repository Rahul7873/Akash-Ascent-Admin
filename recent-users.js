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

    // Modal DOM Elements
    var purchasesModal = document.getElementById('purchases-modal');
    var closeModalBtn = document.getElementById('close-modal-btn');
    var closeModalBottomBtn = document.getElementById('close-modal-bottom-btn');
    var modalUserName = document.getElementById('modal-user-name');
    var modalUserId = document.getElementById('modal-user-id');
    var modalUserContact = document.getElementById('modal-user-contact');
    var modalPurchasesContainer = document.getElementById('modal-purchases-container');
    var modalStatusMsg = document.getElementById('modal-status-msg');
    var manualCourseIdInput = document.getElementById('manual-course-id-input');
    var manualCancelBtn = document.getElementById('manual-cancel-btn');

    var rawUsersData = {};
    var playlistsCache = {};
    var coursesCache = {};
    var currentFilterMode = '24h';
    var selectedDateString = '';
    var currentSelectedUserKey = null;

    function showStatus(text) {
        if (statusMessage) {
            statusMessage.textContent = text;
        }
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    // Cache playlists and courses for title resolution
    function cachePlaylistsAndCourses() {
        firebase.database().ref('playlists').once('value').then(function(snap) {
            if (snap.exists()) playlistsCache = snap.val() || {};
            renderFilteredUsers();
        });
        firebase.database().ref('courses').once('value').then(function(snap) {
            if (snap.exists()) coursesCache = snap.val() || {};
            renderFilteredUsers();
        });
    }
    cachePlaylistsAndCourses();

    function closeModal() {
        if (purchasesModal) {
            purchasesModal.classList.add('hidden');
        }
        currentSelectedUserKey = null;
        if (manualCourseIdInput) manualCourseIdInput.value = '';
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (closeModalBottomBtn) closeModalBottomBtn.addEventListener('click', closeModal);
    if (purchasesModal) {
        purchasesModal.addEventListener('click', function(e) {
            if (e.target === purchasesModal) {
                closeModal();
            }
        });
    }

    if (manualCancelBtn) {
        manualCancelBtn.addEventListener('click', function() {
            if (!currentSelectedUserKey) return;
            var customId = (manualCourseIdInput ? manualCourseIdInput.value.trim() : '');
            if (!customId) {
                alert('Please enter a Playlist or Course ID to cancel.');
                return;
            }
            promptAndCancelPurchase(currentSelectedUserKey, {
                key: customId,
                source: 'purchases',
                playlistId: customId,
                title: resolveTitle(customId, { title: customId }),
                raw: {}
            });
        });
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

        if (typeof value === 'number') {
            var time = value;
            if (time < 30000000000) time = time * 1000;
            return time;
        }

        var str = String(value).trim();
        if (str === '' || str === '-') return NaN;

        if (/^\d+$/.test(str)) {
            var num = Number(str);
            if (num < 30000000000) num = num * 1000;
            return num;
        }

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

        // Actions Header
        var thActions = document.createElement('th');
        thActions.className = 'px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider';
        thActions.textContent = 'Actions';
        usersTableHead.appendChild(thActions);
    }

    function createRow(userKey, userData, rawUser, columns) {
        var tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 hover:bg-gray-50 transition';

        columns.forEach(function(column) {
            var td = document.createElement('td');
            td.className = 'px-6 py-4 text-sm text-gray-700';

            if (column.key === 'purchasedCourses') {
                var boughtList = getUserPurchasesList(rawUser);
                if (boughtList.length === 0) {
                    td.innerHTML = '<span class="text-xs text-gray-400 italic">No Courses</span>';
                } else {
                    var badgesHtml = boughtList.map(function(courseName) {
                        return '<span class="inline-block px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 mr-1 my-0.5">' + escapeHtml(courseName) + '</span>';
                    }).join('');
                    td.innerHTML = '<div class="flex flex-wrap gap-1 max-w-xs">' + badgesHtml + '</div>';
                }
            } else {
                td.classList.add('whitespace-nowrap');
                var value = column.key === 'userId' ? userKey : userData[column.key];
                if (value === undefined || value === null || value === '') {
                    value = '-';
                } else if (column.key === 'login' || column.key === 'lastLogin' || column.key === 'createdAt') {
                    if (typeof value === 'string' && value.includes('-') && value.includes(':')) {
                        // Keep formatted string
                    } else {
                        var parsed = parseTimestamp(value);
                        if (!isNaN(parsed)) {
                            value = new Date(parsed).toLocaleString();
                        }
                    }
                }
                td.textContent = value;
            }
            tr.appendChild(td);
        });

        // Actions Cell
        var tdActions = document.createElement('td');
        tdActions.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium';

        var manageBtn = document.createElement('button');
        manageBtn.type = 'button';
        manageBtn.className = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold border border-blue-200 transition cursor-pointer shadow-sm';
        manageBtn.innerHTML = '<span>🛒</span> Purchases';
        manageBtn.onclick = function() {
            openPurchasesModal(userKey, rawUser);
        };

        tdActions.appendChild(manageBtn);
        tr.appendChild(tdActions);

        return tr;
    }

    function isObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function flattenUserData(userData) {
        var flattened = {};
        var ignoreKeys = [
            'notifications', 'notification', 'cancelled_purchases',
            'purchases', 'courses', 'myCourses', 'purchasedPlaylists',
            'myPlaylists', 'subscriptions', 'playlists', 'mahapacks',
            'enrolled', 'enrolledCourses', 'enrolledPlaylists', 'bought',
            'boughtCourses', 'boughtPlaylists', 'purchased', 'purchasedCourses',
            'orders', 'transactions', 'unlockedCourses', 'userCourses', 'userPlaylists'
        ];

        Object.keys(userData || {}).forEach(function(key) {
            if (ignoreKeys.indexOf(key) !== -1) return;
            var value = userData[key];
            if (isObject(value)) {
                return;
            }
            flattened[key] = value;
        });
        return flattened;
    }

    function resolveTitle(key, itemObj) {
        if (!itemObj) itemObj = {};
        var playlistId = itemObj.playlistId || itemObj.courseId || itemObj.id || key;
        var cachedP = playlistsCache[playlistId] || playlistsCache[key] || {};
        var cachedC = coursesCache[playlistId] || coursesCache[key] || {};

        return itemObj.title || itemObj.courseName || itemObj.playlistTitle || 
               itemObj.playlistName || itemObj.name || 
               cachedP.name || cachedP.title || 
               cachedC.name || cachedC.title || 
               ('Course (' + key + ')');
    }

    function getUserPurchasesList(rawUser) {
        if (!rawUser) return [];
        var list = [];
        var seenKeys = new Set();

        function isKnownCourseOrPlaylist(k) {
            return !!(playlistsCache[k] || coursesCache[k]);
        }

        function addTitle(k, itemData) {
            if (!k || seenKeys.has(k)) return;
            var itemObj = (itemData && typeof itemData === 'object') ? itemData : {};

            var isCancelled = (itemObj.status === 'cancelled') || 
                               (rawUser && rawUser.cancelled_purchases && rawUser.cancelled_purchases[k]);
            if (isCancelled || itemData === false || itemData === null) {
                return;
            }

            seenKeys.add(k);
            var title = resolveTitle(k, itemObj);
            list.push(title);
        }

        if (rawUser) {
            Object.keys(rawUser).forEach(function(topKey) {
                if (topKey === 'notifications' || topKey === 'notification' || topKey === 'cancelled_purchases') return;

                var val = rawUser[topKey];
                if (val === null || val === false) return;

                if (isKnownCourseOrPlaylist(topKey)) {
                    addTitle(topKey, val);
                    return;
                }

                if (Array.isArray(val)) {
                    val.forEach(function(elem) {
                        if (typeof elem === 'string') addTitle(elem, { title: elem });
                        else if (elem && typeof elem === 'object') addTitle(elem.id || elem.playlistId || elem.courseId, elem);
                    });
                } else if (val && typeof val === 'object') {
                    Object.keys(val).forEach(function(subKey) {
                        var subVal = val[subKey];
                        var isPurchaseNode = /purchase|course|playlist|subscription|mahapack|enrolled|bought|order|transaction|unlocked|access/i.test(topKey);
                        if ((isPurchaseNode || isKnownCourseOrPlaylist(subKey)) && subVal !== false && subVal !== null) {
                            addTitle(subKey, subVal);
                        }
                    });
                }
            });
        }

        return list;
    }

    function fetchAllUserPurchases(userKey, rawUser) {
        return new Promise(function(resolve) {
            var list = [];
            var seenKeys = new Set();

            function isKnownCourseOrPlaylist(k) {
                return !!(playlistsCache[k] || coursesCache[k]);
            }

            function addPurchaseItem(key, source, itemData) {
                if (!key || seenKeys.has(key)) return;

                var itemObj = (itemData && typeof itemData === 'object') ? itemData : {};

                if (itemData === false || itemData === null) return;

                seenKeys.add(key);

                var playlistId = itemObj.playlistId || itemObj.courseId || itemObj.id || key;
                var title = resolveTitle(key, itemObj);

                list.push({
                    key: key,
                    source: source,
                    raw: itemData,
                    playlistId: playlistId,
                    title: title,
                    status: 'active'
                });
            }

            if (rawUser) {
                Object.keys(rawUser).forEach(function(topKey) {
                    if (topKey === 'notifications' || topKey === 'notification' || topKey === 'cancelled_purchases') return;

                    var val = rawUser[topKey];
                    if (val === null || val === false) return;

                    if (isKnownCourseOrPlaylist(topKey)) {
                        addPurchaseItem(topKey, 'user_root', val);
                        return;
                    }

                    if (Array.isArray(val)) {
                        val.forEach(function(elem, idx) {
                            if (typeof elem === 'string') {
                                addPurchaseItem(elem, topKey, { title: elem });
                            } else if (elem && typeof elem === 'object') {
                                var k = elem.id || elem.playlistId || elem.courseId || ('item_' + idx);
                                addPurchaseItem(k, topKey, elem);
                            }
                        });
                    } 
                    else if (val && typeof val === 'object') {
                        Object.keys(val).forEach(function(subKey) {
                            var subVal = val[subKey];
                            if (subVal === false || subVal === null) return;

                            var isPurchaseNode = /purchase|course|playlist|subscription|mahapack|enrolled|bought|order|transaction|unlocked|access/i.test(topKey);
                            if (isPurchaseNode || isKnownCourseOrPlaylist(subKey)) {
                                addPurchaseItem(subKey, topKey, subVal);
                            }
                        });
                    }
                });
            }

            var rootRefs = [
                'purchases/' + userKey,
                'user_purchases/' + userKey,
                'orders/' + userKey,
                'user_courses/' + userKey,
                'subscriptions/' + userKey,
                'user_playlists/' + userKey
            ];

            var promises = rootRefs.map(function(path) {
                return firebase.database().ref(path).once('value').catch(function() { return null; });
            });

            Promise.all(promises).then(function(snapshots) {
                snapshots.forEach(function(snap, idx) {
                    if (snap && snap.exists()) {
                        var source = rootRefs[idx].split('/')[0];
                        var data = snap.val();
                        if (typeof data === 'object') {
                            Object.keys(data).forEach(function(k) {
                                var val = data[k];
                                if (val !== false && val !== null) {
                                    addPurchaseItem(k, source, val);
                                }
                            });
                        }
                    }
                });

                resolve(list);
            });
        });
    }

    function openPurchasesModal(userKey, rawUser) {
        currentSelectedUserKey = userKey;
        var name = (rawUser.firstName || rawUser.name || rawUser.username || 'User') + 
                   (rawUser.lastName ? ' ' + rawUser.lastName : '');
        var contact = rawUser.email || rawUser.phoneNumber || rawUser.phone || '';

        if (modalUserName) modalUserName.textContent = name + "'s Purchases";
        if (modalUserId) modalUserId.textContent = 'ID: ' + userKey;
        if (modalUserContact) modalUserContact.textContent = contact;
        if (modalStatusMsg) modalStatusMsg.textContent = 'Loading purchases...';
        if (modalPurchasesContainer) {
            modalPurchasesContainer.innerHTML = '<div class="text-center py-6 text-gray-500 text-sm">Scanning purchases...</div>';
        }

        if (purchasesModal) {
            purchasesModal.classList.remove('hidden');
        }

        fetchAllUserPurchases(userKey, rawUser).then(function(purchases) {
            renderModalPurchases(userKey, rawUser, purchases);
            if (modalStatusMsg) modalStatusMsg.textContent = 'Purchases for ' + name;
        });
    }

    function renderModalPurchases(userKey, rawUser, purchases) {
        if (!modalPurchasesContainer) return;
        modalPurchasesContainer.innerHTML = '';

        if (!purchases || purchases.length === 0) {
            modalPurchasesContainer.innerHTML = `
                <div class="text-center py-8 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <div class="text-3xl mb-1">🛒</div>
                    <p class="text-gray-800 font-semibold text-sm">No Purchases Found</p>
                </div>
            `;
            return;
        }

        purchases.forEach(function(p) {
            var card = document.createElement('div');
            card.className = 'p-4 rounded-2xl border border-gray-200 bg-white shadow-sm flex items-center justify-between gap-4 hover:border-blue-200 transition';

            var leftDiv = document.createElement('div');
            leftDiv.className = 'flex items-center gap-3 min-w-0 flex-1';

            var titleEl = document.createElement('h4');
            titleEl.className = 'font-bold text-gray-900 text-base truncate';
            titleEl.textContent = p.title;

            var badge = document.createElement('span');
            badge.className = 'px-2.5 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200 shrink-0';
            badge.textContent = 'Active';

            leftDiv.appendChild(titleEl);
            leftDiv.appendChild(badge);
            card.appendChild(leftDiv);

            var actionDiv = document.createElement('div');
            actionDiv.className = 'shrink-0';

            var cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition cursor-pointer';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = function() {
                promptAndCancelPurchase(userKey, p);
            };

            actionDiv.appendChild(cancelBtn);
            card.appendChild(actionDiv);
            modalPurchasesContainer.appendChild(card);
        });
    }

    function promptAndCancelPurchase(userKey, purchase) {
        var userObj = rawUsersData[userKey] || {};
        var targetId = purchase.playlistId || purchase.key;

        var confirmDelete = confirm('Are you sure you want to cancel purchase for "' + purchase.title + '"?');

        if (!confirmDelete) {
            return;
        }

        if (modalStatusMsg) modalStatusMsg.textContent = 'Cancelling course in Firebase...';

        var updates = {};

        // 1. Recursive deep purger of userObj
        function purgeUserObject(obj, currentPath) {
            if (!obj || typeof obj !== 'object') return;

            Object.keys(obj).forEach(function(k) {
                if (k === 'notifications' || k === 'notification') return;

                var val = obj[k];
                var path = currentPath + '/' + k;

                if (k === targetId || k === purchase.key) {
                    updates[path] = null;
                    return;
                }

                if (val && typeof val === 'object') {
                    var pId = val.playlistId || val.courseId || val.id || val.key;
                    if (pId === targetId || pId === purchase.key || (val.title && val.title === purchase.title)) {
                        updates[path] = null;
                    } else if (!Array.isArray(val)) {
                        purgeUserObject(val, path);
                    }
                } else if (typeof val === 'string' && (val === targetId || val === purchase.key)) {
                    updates[path] = null;
                }
            });
        }

        purgeUserObject(userObj, 'users/' + userKey);

        // 2. Wipe standard access nodes explicitly
        var standardNodes = [
            'purchases', 'courses', 'myCourses', 'purchasedPlaylists',
            'myPlaylists', 'subscriptions', 'playlists', 'mahapacks',
            'enrolled', 'enrolledCourses', 'enrolledPlaylists', 'bought',
            'boughtCourses', 'boughtPlaylists', 'purchased', 'purchasedCourses',
            'orders', 'transactions', 'unlockedCourses', 'userCourses', 'userPlaylists'
        ];

        standardNodes.forEach(function(nodeName) {
            updates['users/' + userKey + '/' + nodeName + '/' + targetId] = null;
            updates['users/' + userKey + '/' + nodeName + '/' + purchase.key] = null;
        });

        updates['users/' + userKey + '/' + targetId] = null;
        updates['users/' + userKey + '/' + purchase.key] = null;

        // 3. Scan external root database nodes for pushId or targetId matches
        var rootPaths = [
            'purchases/' + userKey,
            'user_purchases/' + userKey,
            'orders/' + userKey,
            'user_courses/' + userKey,
            'subscriptions/' + userKey,
            'user_playlists/' + userKey
        ];

        var fetchPromises = rootPaths.map(function(rp) {
            return firebase.database().ref(rp).once('value').catch(function() { return null; });
        });

        Promise.all(fetchPromises).then(function(snapshots) {
            snapshots.forEach(function(snap, idx) {
                if (snap && snap.exists()) {
                    var rp = rootPaths[idx];
                    var data = snap.val();
                    if (typeof data === 'object') {
                        Object.keys(data).forEach(function(k) {
                            if (k === targetId || k === purchase.key) {
                                updates[rp + '/' + k] = null;
                            } else {
                                var item = data[k];
                                if (item && typeof item === 'object') {
                                    var pId = item.playlistId || item.courseId || item.id || item.key;
                                    if (pId === targetId || pId === purchase.key || item.title === purchase.title) {
                                        updates[rp + '/' + k] = null;
                                    }
                                }
                            }
                        });
                    }
                }
            });

            // 4. Send student notification
            var notifId = 'notif_cancel_' + targetId + '_' + Date.now();
            updates['users/' + userKey + '/notifications/' + notifId] = {
                title: '🚫 Course Purchase Cancelled',
                message: 'Your purchase for "' + purchase.title + '" has been cancelled.',
                courseName: purchase.title,
                playlistId: targetId,
                type: 'purchase_cancellation',
                read: false,
                sentAt: firebase.database.ServerValue.TIMESTAMP
            };

            // 5. Execute multi-path update in Firebase
            return firebase.database().ref().update(updates);
        }).then(function() {
            alert('Course "' + purchase.title + '" purchase cancelled successfully!');

            return firebase.database().ref('users/' + userKey).once('value');
        }).then(function(userSnap) {
            if (userSnap && userSnap.exists()) {
                rawUsersData[userKey] = userSnap.val();
            } else {
                rawUsersData[userKey] = null;
            }
            if (typeof renderFilteredUsers === 'function') renderFilteredUsers();
            openPurchasesModal(userKey, rawUsersData[userKey] || {});
        }).catch(function(error) {
            console.error('Error cancelling course:', error);
            alert('Failed to cancel course: ' + error.message);
            if (modalStatusMsg) modalStatusMsg.textContent = 'Error cancelling course.';
        });
    }

    function matchesFilter(userData) {
        if (currentFilterMode === 'all') {
            return true;
        }

        var loginTime = getUserLastLoginTime(userData);

        if (currentFilterMode === '24h') {
            if (isNaN(loginTime)) {
                return true;
            }
            var now = Date.now();
            var twentyFourHours = 24 * 60 * 60 * 1000;
            var diff = now - loginTime;
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

        // Register Purchased Courses column
        columnMap.set('purchasedCourses', { key: 'purchasedCourses', label: 'Purchased Courses' });

        // Ensure common fields appear first, including Purchased Courses
        var preferredFields = ['userId', 'firstName', 'lastName', 'username', 'email', 'phoneNumber', 'phone', 'purchasedCourses', 'login', 'createdAt'];
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
            usersTableBody.appendChild(createRow(row.key, row.data, row.raw, columns));
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
