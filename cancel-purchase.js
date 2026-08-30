document.addEventListener('DOMContentLoaded', function () {
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var statusMessage = document.getElementById('status-message');
    var usersTableHead = document.getElementById('users-table-head');
    var usersTableBody = document.getElementById('users-table-body');
    var emptyState = document.getElementById('empty-state');

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
    var modalBatchToolbar = document.getElementById('modal-batch-toolbar');
    var modalSelectAllCb = document.getElementById('modal-select-all-cb');
    var modalSelectAllText = document.getElementById('modal-select-all-text');
    var modalCancelSelectedBtn = document.getElementById('modal-cancel-selected-btn');

    var rawUsersData = {};
    var playlistsCache = {};
    var coursesCache = {};
    var currentSelectedUserKey = null;
    var currentModalPurchases = [];

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
        firebase.database().ref('playlists').once('value').then(function (snap) {
            if (snap.exists()) playlistsCache = snap.val() || {};
            renderTable();
        });
        firebase.database().ref('courses').once('value').then(function (snap) {
            if (snap.exists()) coursesCache = snap.val() || {};
            renderTable();
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
        purchasesModal.addEventListener('click', function (e) {
            if (e.target === purchasesModal) {
                closeModal();
            }
        });
    }

    if (manualCancelBtn) {
        manualCancelBtn.addEventListener('click', function () {
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
            .replace(/^./, function (char) { return char.toUpperCase(); })
            .trim();
    }

    function buildHeader(columns) {
        usersTableHead.innerHTML = '';
        columns.forEach(function (column) {
            var th = document.createElement('th');
            th.className = 'px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider';
            th.textContent = column.label;
            usersTableHead.appendChild(th);
        });

        // Actions Column Header
        var thActions = document.createElement('th');
        thActions.className = 'px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider';
        thActions.textContent = 'Actions';
        usersTableHead.appendChild(thActions);
    }

    function createRow(userKey, userData, rawUser, columns) {
        var tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 hover:bg-gray-50 transition';

        columns.forEach(function (column) {
            var td = document.createElement('td');
            td.className = 'px-6 py-4 text-sm text-gray-700';

            if (column.key === 'purchasedCourses') {
                var boughtList = getUserPurchasesList(rawUser);
                if (boughtList.length === 0) {
                    td.innerHTML = '<span class="text-xs text-gray-400 italic">No Courses</span>';
                } else {
                    var badgesHtml = boughtList.map(function (courseName) {
                        return '<span class="inline-block px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 mr-1 my-0.5">' + escapeHtml(courseName) + '</span>';
                    }).join('');
                    td.innerHTML = '<div class="flex flex-wrap gap-1 max-w-xs">' + badgesHtml + '</div>';
                }
            } else {
                td.classList.add('whitespace-nowrap');
                var value = column.key === 'userId' ? userKey : userData[column.key];
                if (value === undefined || value === null || value === '') {
                    value = '-';
                }
                td.textContent = value;
            }
            tr.appendChild(td);
        });

        // Actions Cell: Cancel Purchase Action Button
        var tdActions = document.createElement('td');
        tdActions.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium';

        var cancelActionBtn = document.createElement('button');
        cancelActionBtn.type = 'button';
        cancelActionBtn.className = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl text-xs font-semibold border border-red-200 transition cursor-pointer shadow-sm';
        cancelActionBtn.innerHTML = '<span>🚫</span> Cancel Purchase';
        cancelActionBtn.onclick = function () {
            openPurchasesModal(userKey, rawUser);
        };

        tdActions.appendChild(cancelActionBtn);
        tr.appendChild(tdActions);

        return tr;
    }

    function isObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function isExcludedField(key) {
        if (!key) return false;
        var k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        var excludedList = [
            'login',
            'createdat',
            'goalid',
            'goal',
            'goalname',
            'lastlogin',
            'selectedclassid',
            'selectedclass',
            'classid',
            'uid'
        ];
        return excludedList.indexOf(k) !== -1;
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

        Object.keys(userData || {}).forEach(function (key) {
            if (ignoreKeys.indexOf(key) !== -1 || isExcludedField(key)) return;
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
            Object.keys(rawUser).forEach(function (topKey) {
                if (topKey === 'notifications' || topKey === 'notification' || topKey === 'cancelled_purchases') return;

                var val = rawUser[topKey];
                if (val === null || val === false) return;

                if (isKnownCourseOrPlaylist(topKey)) {
                    addTitle(topKey, val);
                    return;
                }

                if (Array.isArray(val)) {
                    val.forEach(function (elem) {
                        if (typeof elem === 'string') addTitle(elem, { title: elem });
                        else if (elem && typeof elem === 'object') addTitle(elem.id || elem.playlistId || elem.courseId, elem);
                    });
                } else if (val && typeof val === 'object') {
                    Object.keys(val).forEach(function (subKey) {
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
        return new Promise(function (resolve) {
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
                Object.keys(rawUser).forEach(function (topKey) {
                    if (topKey === 'notifications' || topKey === 'notification' || topKey === 'cancelled_purchases') return;

                    var val = rawUser[topKey];
                    if (val === null || val === false) return;

                    if (isKnownCourseOrPlaylist(topKey)) {
                        addPurchaseItem(topKey, 'user_root', val);
                        return;
                    }

                    if (Array.isArray(val)) {
                        val.forEach(function (elem, idx) {
                            if (typeof elem === 'string') {
                                addPurchaseItem(elem, topKey, { title: elem });
                            } else if (elem && typeof elem === 'object') {
                                var k = elem.id || elem.playlistId || elem.courseId || ('item_' + idx);
                                addPurchaseItem(k, topKey, elem);
                            }
                        });
                    }
                    else if (val && typeof val === 'object') {
                        Object.keys(val).forEach(function (subKey) {
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

            var promises = rootRefs.map(function (path) {
                return firebase.database().ref(path).once('value').catch(function () { return null; });
            });

            Promise.all(promises).then(function (snapshots) {
                snapshots.forEach(function (snap, idx) {
                    if (snap && snap.exists()) {
                        var source = rootRefs[idx].split('/')[0];
                        var data = snap.val();
                        if (typeof data === 'object') {
                            Object.keys(data).forEach(function (k) {
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

        fetchAllUserPurchases(userKey, rawUser).then(function (purchases) {
            renderModalPurchases(userKey, rawUser, purchases);
            if (modalStatusMsg) modalStatusMsg.textContent = 'Purchases for ' + name;
        });
    }

    function renderModalPurchases(userKey, rawUser, purchases) {
        if (!modalPurchasesContainer) return;
        modalPurchasesContainer.innerHTML = '';
        currentModalPurchases = purchases || [];

        if (!purchases || purchases.length === 0) {
            if (modalBatchToolbar) modalBatchToolbar.classList.add('hidden');
            modalPurchasesContainer.innerHTML = `
                <div class="text-center py-8 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <div class="text-3xl mb-1">🛒</div>
                    <p class="text-gray-800 font-semibold text-sm">No Purchases Found</p>
                </div>
            `;
            return;
        }

        // Show batch toolbar with Select All and Cancel Selected/All
        if (modalBatchToolbar) {
            modalBatchToolbar.classList.remove('hidden');
            if (modalSelectAllCb) modalSelectAllCb.checked = true;
            if (modalSelectAllText) modalSelectAllText.textContent = 'Select All (' + purchases.length + ')';
            if (modalCancelSelectedBtn) {
                modalCancelSelectedBtn.disabled = false;
                modalCancelSelectedBtn.innerHTML = '<span>🚫 Cancel Selected (' + purchases.length + ')</span>';
            }
        }

        var checkboxes = [];

        purchases.forEach(function (p, index) {
            var card = document.createElement('div');
            card.className = 'p-4 rounded-2xl border border-gray-200 bg-white shadow-sm flex items-center justify-between gap-4 hover:border-red-200 transition';

            var leftDiv = document.createElement('div');
            leftDiv.className = 'flex items-center gap-3 min-w-0 flex-1';

            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = true;
            cb.className = 'w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer purchase-item-cb shrink-0';
            cb.dataset.index = index;
            checkboxes.push(cb);

            var titleEl = document.createElement('h4');
            titleEl.className = 'font-bold text-gray-900 text-base truncate';
            titleEl.textContent = p.title;

            var badge = document.createElement('span');
            badge.className = 'px-2.5 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200 shrink-0';
            badge.textContent = 'Active';

            leftDiv.appendChild(cb);
            leftDiv.appendChild(titleEl);
            leftDiv.appendChild(badge);
            card.appendChild(leftDiv);

            var actionDiv = document.createElement('div');
            actionDiv.className = 'shrink-0';

            var cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition cursor-pointer';
            cancelBtn.textContent = 'Cancel Purchase';
            cancelBtn.onclick = function () {
                promptAndCancelMultiplePurchases(userKey, [p]);
            };

            actionDiv.appendChild(cancelBtn);
            card.appendChild(actionDiv);
            modalPurchasesContainer.appendChild(card);
        });

        function updateSelectionState() {
            var checkedCount = 0;
            checkboxes.forEach(function (c) {
                if (c.checked) checkedCount++;
            });

            if (modalSelectAllCb) {
                modalSelectAllCb.checked = (checkedCount === checkboxes.length && checkboxes.length > 0);
            }
            if (modalCancelSelectedBtn) {
                modalCancelSelectedBtn.disabled = (checkedCount === 0);
                if (checkedCount === checkboxes.length) {
                    modalCancelSelectedBtn.innerHTML = '<span>🚫 Cancel All Purchases (' + checkedCount + ')</span>';
                } else {
                    modalCancelSelectedBtn.innerHTML = '<span>🚫 Cancel Selected (' + checkedCount + ')</span>';
                }
            }
        }

        // Attach Select All checkbox listener
        if (modalSelectAllCb) {
            modalSelectAllCb.onchange = function () {
                var isAll = modalSelectAllCb.checked;
                checkboxes.forEach(function (c) {
                    c.checked = isAll;
                });
                updateSelectionState();
            };
        }

        // Attach individual checkbox listeners
        checkboxes.forEach(function (c) {
            c.onchange = updateSelectionState;
        });

        // Attach Cancel Selected button listener
        if (modalCancelSelectedBtn) {
            modalCancelSelectedBtn.onclick = function () {
                var selectedPurchases = [];
                checkboxes.forEach(function (c, idx) {
                    if (c.checked && currentModalPurchases[idx]) {
                        selectedPurchases.push(currentModalPurchases[idx]);
                    }
                });

                if (selectedPurchases.length === 0) {
                    alert('Please select at least one purchase to cancel.');
                    return;
                }

                promptAndCancelMultiplePurchases(userKey, selectedPurchases);
            };
        }
    }

    function promptAndCancelPurchase(userKey, purchase) {
        promptAndCancelMultiplePurchases(userKey, [purchase]);
    }

    function promptAndCancelMultiplePurchases(userKey, purchasesList) {
        if (!purchasesList || purchasesList.length === 0) return;

        var userObj = rawUsersData[userKey] || {};
        var count = purchasesList.length;
        var confirmText = count === 1
            ? ('Are you sure you want to cancel purchase for "' + purchasesList[0].title + '"?')
            : ('Are you sure you want to cancel ALL ' + count + ' selected purchases for this student?');

        if (!confirm(confirmText)) {
            return;
        }

        if (modalStatusMsg) modalStatusMsg.textContent = 'Cancelling ' + count + ' purchase(s) in Firebase...';

        var updates = {};

        // Collect all possible phone/UID keys for this user
        var userKeys = new Set();
        if (userKey) userKeys.add(userKey);
        if (userObj.uid) userKeys.add(userObj.uid);
        if (userObj.userId) userKeys.add(userObj.userId);
        if (userObj.phone) userKeys.add(userObj.phone);
        if (userObj.phoneNumber) userKeys.add(userObj.phoneNumber);
        if (userObj.mobile) userKeys.add(userObj.mobile);

        var phoneStr = (userObj.phone || userObj.phoneNumber || userObj.mobile || userKey || '').toString().replace(/\D/g, '');
        if (phoneStr) {
            userKeys.add(phoneStr);
            if (phoneStr.length >= 10) {
                var last10 = phoneStr.slice(-10);
                userKeys.add(last10);
                userKeys.add('+91' + last10);
                userKeys.add('91' + last10);
            }
        }

        var standardNodes = [
            'purchases', 'courses', 'myCourses', 'purchasedPlaylists',
            'myPlaylists', 'subscriptions', 'playlists', 'mahapacks',
            'enrolled', 'enrolledCourses', 'enrolledPlaylists', 'bought',
            'boughtCourses', 'boughtPlaylists', 'purchased', 'purchasedCourses',
            'orders', 'transactions', 'unlockedCourses', 'userCourses', 'userPlaylists'
        ];

        var rootPaths = [];
        userKeys.forEach(function (uK) {
            rootPaths.push('purchases/' + uK);
            rootPaths.push('user_purchases/' + uK);
            rootPaths.push('orders/' + uK);
            rootPaths.push('user_courses/' + uK);
            rootPaths.push('subscriptions/' + uK);
            rootPaths.push('user_playlists/' + uK);
        });

        // 1. Recursive deep purger of userObj for all target IDs
        function purgeUserObjectForTargets(obj, currentPath, targetIdsSet) {
            if (!obj || typeof obj !== 'object') return;

            Object.keys(obj).forEach(function (k) {
                if (k === 'notifications' || k === 'notification') return;

                var val = obj[k];
                var path = currentPath + '/' + k;

                if (targetIdsSet.has(k)) {
                    updates[path] = null;
                    return;
                }

                if (val && typeof val === 'object') {
                    var pId = val.playlistId || val.courseId || val.id || val.key;
                    if (targetIdsSet.has(pId) || (val.title && targetIdsSet.has(val.title))) {
                        updates[path] = null;
                    } else if (!Array.isArray(val)) {
                        purgeUserObjectForTargets(val, path, targetIdsSet);
                    }
                } else if (typeof val === 'string' && targetIdsSet.has(val)) {
                    updates[path] = null;
                }
            });
        }

        var targetIdsSet = new Set();
        purchasesList.forEach(function (p) {
            var targetId = p.playlistId || p.key;
            if (targetId) targetIdsSet.add(targetId);
            if (p.key) targetIdsSet.add(p.key);
            if (p.title) targetIdsSet.add(p.title);
        });

        userKeys.forEach(function (uK) {
            purgeUserObjectForTargets(userObj, 'users/' + uK, targetIdsSet);

            purchasesList.forEach(function (p) {
                var targetId = p.playlistId || p.key;
                standardNodes.forEach(function (nodeName) {
                    updates['users/' + uK + '/' + nodeName + '/' + targetId] = null;
                    updates['users/' + uK + '/' + nodeName + '/' + p.key] = null;
                });
                updates['users/' + uK + '/' + targetId] = null;
                updates['users/' + uK + '/' + p.key] = null;
                updates['users/' + uK + '/course_' + targetId] = null;
                updates['users/' + uK + '/playlist_' + targetId] = null;
            });
        });

        var fetchPromises = rootPaths.map(function (rp) {
            return firebase.database().ref(rp).once('value').catch(function () { return null; });
        });

        Promise.all(fetchPromises).then(function (snapshots) {
            snapshots.forEach(function (snap, idx) {
                if (snap && snap.exists()) {
                    var rp = rootPaths[idx];
                    var data = snap.val();
                    if (typeof data === 'object') {
                        Object.keys(data).forEach(function (k) {
                            if (targetIdsSet.has(k)) {
                                updates[rp + '/' + k] = null;
                            } else {
                                var item = data[k];
                                if (item && typeof item === 'object') {
                                    var pId = item.playlistId || item.courseId || item.id || item.key;
                                    if (targetIdsSet.has(pId) || (item.title && targetIdsSet.has(item.title))) {
                                        updates[rp + '/' + k] = null;
                                    }
                                }
                            }
                        });
                    }
                }
            });

            // Send cancellation notification
            var notifId = 'notif_cancel_all_' + Date.now();
            var titlesSummary = purchasesList.map(function (p) { return p.title; }).join(', ');
            userKeys.forEach(function (uK) {
                updates['users/' + uK + '/notifications/' + notifId] = {
                    title: '🚫 Course Access Cancelled',
                    message: 'Your purchase(s) for ' + titlesSummary + ' have been cancelled.',
                    type: 'purchase_cancellation',
                    read: false,
                    sentAt: firebase.database.ServerValue.TIMESTAMP
                };
            });

            return firebase.database().ref().update(updates);
        }).then(function () {
            alert('Successfully cancelled ' + count + ' purchase(s)!');

            return firebase.database().ref('users/' + userKey).once('value');
        }).then(function (userSnap) {
            if (userSnap && userSnap.exists()) {
                rawUsersData[userKey] = userSnap.val();
            } else {
                rawUsersData[userKey] = null;
            }
            renderTable();
            openPurchasesModal(userKey, rawUsersData[userKey] || {});
        }).catch(function (error) {
            console.error('Error cancelling purchases:', error);
            alert('Failed to cancel purchases: ' + error.message);
            if (modalStatusMsg) modalStatusMsg.textContent = 'Error cancelling purchases.';
        });
    }

    var phoneSearchBar = document.getElementById('phone-search-bar');
    if (phoneSearchBar) {
        phoneSearchBar.addEventListener('input', function () {
            renderTable();
        });
    }

    function renderTable() {
        usersTableBody.innerHTML = '';
        var userKeys = Object.keys(rawUsersData || {});
        if (userKeys.length === 0) {
            emptyState.classList.remove('hidden');
            showStatus('No users available yet.');
            return;
        }

        var searchQuery = (phoneSearchBar ? phoneSearchBar.value.trim().toLowerCase() : '');
        var searchDigits = searchQuery.replace(/\D/g, '');

        var columnMap = new Map();
        columnMap.set('userId', { key: 'userId', label: 'User ID' });
        var rows = [];

        userKeys.forEach(function (key) {
            var rawData = rawUsersData[key] || {};
            var hasProfile = rawData.firstName || rawData.name || rawData.username || rawData.email || rawData.phoneNumber || rawData.phone || rawData.mobile || rawData.uid || rawData.createdAt || rawData.login;
            if (!hasProfile) return;

            var phone = (rawData.phoneNumber || rawData.phone || rawData.mobile || '').toString();
            var phoneDigits = phone.replace(/\D/g, '');
            var name = ((rawData.firstName || rawData.name || '') + ' ' + (rawData.lastName || '')).trim().toLowerCase();
            var email = (rawData.email || '').toString().toLowerCase();
            var uid = (rawData.uid || '').toString().toLowerCase();

            // Search filter by phone digits, name, email, userId
            if (searchQuery) {
                var isPhoneMatch = searchDigits && (phoneDigits.includes(searchDigits) || key.includes(searchDigits));
                var isTextMatch = name.includes(searchQuery) || email.includes(searchQuery) || uid.includes(searchQuery) || key.toLowerCase().includes(searchQuery);
                if (!isPhoneMatch && !isTextMatch) {
                    return;
                }
            }

            var userData = flattenUserData(rawData);
            rows.push({ key: key, data: userData, raw: rawData });
            Object.keys(userData).forEach(function (field) {
                if (field !== 'notifications' && field !== 'notification' && !isExcludedField(field) && !columnMap.has(field)) {
                    columnMap.set(field, {
                        key: field,
                        label: labelizeField(field)
                    });
                }
            });
        });

        // Register Purchased Courses column
        columnMap.set('purchasedCourses', { key: 'purchasedCourses', label: 'Purchased Courses' });

        // Ensure common fields appear first, including Purchased Courses
        var preferredFields = ['userId', 'firstName', 'lastName', 'username', 'email', 'phoneNumber', 'phone', 'purchasedCourses'];
        var columns = [];
        preferredFields.forEach(function (field) {
            if (columnMap.has(field)) {
                columns.push(columnMap.get(field));
                columnMap.delete(field);
            }
        });

        columnMap.forEach(function (value) {
            columns.push(value);
        });

        buildHeader(columns);

        if (rows.length === 0) {
            emptyState.classList.remove('hidden');
            showStatus(searchQuery ? 'No users matching search query.' : 'No users available.');
            return;
        }

        rows.forEach(function (row) {
            usersTableBody.appendChild(createRow(row.key, row.data, row.raw, columns));
        });

        emptyState.classList.add('hidden');
        showStatus('Showing ' + rows.length + ' user' + (rows.length === 1 ? '' : 's') + (searchQuery ? ' (filtered)' : '') + '.');
    }

    showStatus('Loading users...');
    firebase.database().ref('users').once('value').then(function (snapshot) {
        if (!snapshot.exists()) {
            rawUsersData = {};
        } else {
            rawUsersData = snapshot.val() || {};
        }
        renderTable();
    }).catch(function (error) {
        console.error('Fetch users failed:', error);
        showStatus('Failed to load users. Please refresh the page.');
    });
});
