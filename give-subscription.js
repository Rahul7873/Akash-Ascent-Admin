document.addEventListener('DOMContentLoaded', function () {
    // 1. Session check
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    // DOM Elements - Status & Banner
    var statusBanner = document.getElementById('status-banner');
    var statusText = document.getElementById('status-text');
    var closeStatusBtn = document.getElementById('close-status-btn');

    // DOM Elements - User Search
    var searchUserForm = document.getElementById('search-user-form');
    var phoneSearchInput = document.getElementById('phone-search-input');
    var searchMatchesContainer = document.getElementById('search-matches-container');
    var searchMatchesList = document.getElementById('search-matches-list');

    // DOM Elements - User Card
    var selectedUserCard = document.getElementById('selected-user-card');
    var userPlaceholderCard = document.getElementById('user-placeholder-card');
    var userAvatar = document.getElementById('user-avatar');
    var userDisplayName = document.getElementById('user-display-name');
    var userDisplayId = document.getElementById('user-display-id');
    var userDisplayPhone = document.getElementById('user-display-phone');
    var userDisplayEmail = document.getElementById('user-display-email');
    var userDisplayClass = document.getElementById('user-display-class');
    var userDisplayCreated = document.getElementById('user-display-created');
    var userActiveCoursesList = document.getElementById('user-active-courses-list');
    var activeCoursesCount = document.getElementById('active-courses-count');

    // DOM Elements - Course Selection
    var classFilterSelect = document.getElementById('class-filter-select');
    var courseSearchInput = document.getElementById('course-search-input');
    var coursesContainer = document.getElementById('courses-container');

    // DOM Elements - Grant Config
    var selectedCourseTitle = document.getElementById('selected-course-title');
    var selectedCourseMeta = document.getElementById('selected-course-meta');
    var selectedCourseValidityBadge = document.getElementById('selected-course-validity-badge');
    var grantReasonInput = document.getElementById('grant-reason-input');
    var grantNotifCheckbox = document.getElementById('grant-notif-checkbox');
    var confirmGrantBtn = document.getElementById('confirm-grant-btn');

    // Application State
    var rawUsersData = {};
    var playlistsData = {};
    var preferencesData = {};
    var selectedUserKey = null;
    var selectedUserPhone = '';
    var selectedCourseId = null;

    // Banner Notification Helper
    function showBanner(message, type) {
        if (!statusBanner || !statusText) return;
        statusText.textContent = message;
        statusBanner.className = 'p-4 rounded-2xl text-sm font-medium transition duration-300 flex items-center justify-between mb-6 ';
        if (type === 'error') {
            statusBanner.className += 'bg-red-50 text-red-800 border border-red-200';
        } else if (type === 'success') {
            statusBanner.className += 'bg-emerald-50 text-emerald-800 border border-emerald-200';
        } else {
            statusBanner.className += 'bg-blue-50 text-blue-800 border border-blue-200';
        }
        statusBanner.classList.remove('hidden');
    }

    if (closeStatusBtn) {
        closeStatusBtn.addEventListener('click', function () {
            if (statusBanner) statusBanner.classList.add('hidden');
        });
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function normalizeDigits(input) {
        return String(input || '').replace(/\D/g, '');
    }

    function formatAppDate(date) {
        var d = ('0' + date.getDate()).slice(-2);
        var m = ('0' + (date.getMonth() + 1)).slice(-2);
        var y = date.getFullYear();
        var h = ('0' + date.getHours()).slice(-2);
        var min = ('0' + date.getMinutes()).slice(-2);
        var s = ('0' + date.getSeconds()).slice(-2);
        return d + '/' + m + '/' + y + ' ' + h + ':' + min + ':' + s;
    }

    // 2. Data Initialization from Firebase Realtime Database
    function loadInitialData() {
        showBanner('Loading available courses and students...', 'info');

        var playlistsPromise = firebase.database().ref('playlists').once('value').then(function (snap) {
            playlistsData = snap.val() || {};
        });

        var prefPromise = firebase.database().ref('preferences').once('value').then(function (snap) {
            preferencesData = snap.val() || {};
            populateClassFilter();
        });

        firebase.database().ref('users').on('value', function (snap) {
            rawUsersData = snap.val() || {};
            if (selectedUserKey && rawUsersData[selectedUserKey]) {
                renderSelectedUser(selectedUserKey, rawUsersData[selectedUserKey]);
                renderCoursesGrid();
            }
        });

        Promise.all([playlistsPromise, prefPromise]).then(function () {
            if (statusBanner) statusBanner.classList.add('hidden');
            renderCoursesGrid();
        }).catch(function (error) {
            console.error('Data initialization error:', error);
            showBanner('Failed to load database content. Please refresh.', 'error');
        });
    }

    // Populate Class Filter Options
    function populateClassFilter() {
        if (!classFilterSelect) return;
        var existingClasses = new Set();

        Object.keys(preferencesData || {}).forEach(function (prefId) {
            var pref = preferencesData[prefId];
            var classes = pref.classes || {};
            Object.keys(classes).forEach(function (cId) {
                if (classes[cId] && classes[cId].name) {
                    existingClasses.add(classes[cId].name.trim());
                }
            });
        });

        Object.keys(playlistsData || {}).forEach(function (pId) {
            var p = playlistsData[pId];
            if (p && p.class) {
                existingClasses.add(p.class.trim());
            }
        });

        classFilterSelect.innerHTML = '<option value="all">All Classes</option>';
        existingClasses.forEach(function (cls) {
            var opt = document.createElement('option');
            opt.value = cls;
            opt.textContent = cls;
            classFilterSelect.appendChild(opt);
        });
    }

    // 3. Search Users by Phone Number / Email / Name
    function findMatchingUsers(query) {
        var cleanQuery = query.trim().toLowerCase();
        var queryDigits = normalizeDigits(cleanQuery);
        var matches = [];

        Object.keys(rawUsersData).forEach(function (userKey) {
            var user = rawUsersData[userKey] || {};
            
            // Skip dummy or empty nodes
            var hasProfile = user.firstName || user.name || user.username || user.email || user.phoneNumber || user.phone || user.mobile || user.uid;
            if (!hasProfile) return;

            var phone = (user.phoneNumber || user.phone || user.mobile || '').toString();
            var phoneDigits = normalizeDigits(phone);
            var email = (user.email || '').toString().toLowerCase();
            var name = ((user.firstName || user.name || '') + ' ' + (user.lastName || '')).trim().toLowerCase();
            var username = (user.username || '').toString().toLowerCase();
            var uid = (user.uid || '').toString().toLowerCase();

            var isMatch = false;

            if (queryDigits && queryDigits.length >= 3) {
                if (phoneDigits === queryDigits ||
                    phoneDigits.endsWith(queryDigits) ||
                    queryDigits.endsWith(phoneDigits) ||
                    phoneDigits.indexOf(queryDigits) !== -1 ||
                    userKey === queryDigits ||
                    userKey === query) {
                    isMatch = true;
                }
            }

            if (!isMatch && cleanQuery.length >= 2) {
                if (email.indexOf(cleanQuery) !== -1 ||
                    name.indexOf(cleanQuery) !== -1 ||
                    username.indexOf(cleanQuery) !== -1 ||
                    uid === cleanQuery ||
                    userKey.toLowerCase() === cleanQuery) {
                    isMatch = true;
                }
            }

            if (isMatch) {
                matches.push({
                    key: userKey,
                    data: user,
                    displayName: (user.firstName || user.name || user.username || 'Student') + (user.lastName ? ' ' + user.lastName : ''),
                    phone: phone || userKey || 'No Phone',
                    email: email || 'No Email',
                    selectedClass: user.selectedClassName || user.selectedClass || user.class || '-'
                });
            }
        });

        return matches;
    }

    // Handle Search Form Submission
    searchUserForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var query = phoneSearchInput.value.trim();
        if (!query) return;

        var matches = findMatchingUsers(query);

        if (matches.length === 0) {
            showBanner('No registered student found with phone/email "' + query + '". Please verify the student account.', 'error');
            searchMatchesContainer.classList.add('hidden');
            return;
        }

        if (matches.length === 1) {
            searchMatchesContainer.classList.add('hidden');
            selectUser(matches[0].key, matches[0].data, query);
            showBanner('Student selected: ' + matches[0].displayName + ' (' + matches[0].phone + ')', 'success');
        } else {
            renderSearchMatches(matches, query);
            showBanner(matches.length + ' students found. Please click to select one.', 'info');
        }
    });

    // Render Multiple Search Matches List
    function renderSearchMatches(matches, rawQuery) {
        searchMatchesList.innerHTML = '';
        matches.forEach(function (m) {
            var item = document.createElement('div');
            item.className = 'p-2.5 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 rounded-xl cursor-pointer transition flex items-center justify-between gap-3 text-xs';
            item.innerHTML = `
                <div class="min-w-0 flex-1">
                    <span class="font-bold text-gray-900 block truncate">${escapeHtml(m.displayName)}</span>
                    <span class="text-gray-500 font-mono text-[11px] block truncate">📱 ${escapeHtml(m.phone)} | ✉️ ${escapeHtml(m.email)}</span>
                </div>
                <span class="px-2 py-1 bg-emerald-600 text-white rounded-lg font-semibold text-[10px] shrink-0">Select</span>
            `;
            item.addEventListener('click', function () {
                searchMatchesContainer.classList.add('hidden');
                selectUser(m.key, m.data, rawQuery);
            });
            searchMatchesList.appendChild(item);
        });
        searchMatchesContainer.classList.remove('hidden');
    }

    // 4. Select and Display User Profile
    function selectUser(userKey, userData, queryPhone) {
        selectedUserKey = userKey;
        selectedUserPhone = (userData.phoneNumber || userData.phone || userData.mobile || userKey || queryPhone || '').toString();
        renderSelectedUser(userKey, userData);
        renderCoursesGrid();
        updateGrantButtonState();
    }

    function getUserActivePurchases(userData) {
        var activeCourses = [];
        var seenIds = new Set();

        if (!userData) return activeCourses;

        // Check standard purchased_playlists node from mobile app
        var purchasedPlaylists = userData.purchased_playlists || {};
        if (typeof purchasedPlaylists === 'object') {
            Object.keys(purchasedPlaylists).forEach(function (k) {
                var p = purchasedPlaylists[k];
                if (!p || p === false || p.status === 'cancelled' || p.status === 'expired') return;
                var courseId = (p && typeof p === 'object') ? (p.playlistId || k) : k;
                if (!seenIds.has(courseId)) {
                    seenIds.add(courseId);
                    var cached = playlistsData[courseId] || {};
                    var title = cached.name || cached.title || courseId;
                    activeCourses.push({ id: courseId, title: title });
                }
            });
        }

        return activeCourses;
    }

    function renderSelectedUser(userKey, userData) {
        if (!userData) return;

        var name = (userData.firstName || userData.name || userData.username || 'Student') + (userData.lastName ? ' ' + userData.lastName : '');
        var phone = userData.phoneNumber || userData.phone || userData.mobile || userKey || selectedUserPhone || 'Not Provided';
        var email = userData.email || 'Not Provided';
        var selectedClass = userData.selectedClassName || userData.selectedClass || userData.class || 'Not Set';
        
        var createdDate = '-';
        if (userData.createdAt) {
            try {
                createdDate = new Date(userData.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                });
            } catch (e) {
                createdDate = String(userData.createdAt);
            }
        }

        userAvatar.textContent = name.charAt(0).toUpperCase() || 'U';
        userDisplayName.textContent = name;
        userDisplayId.textContent = 'ID: ' + userKey;
        userDisplayPhone.textContent = phone;
        userDisplayEmail.textContent = email;
        userDisplayClass.textContent = selectedClass;
        userDisplayCreated.textContent = createdDate;

        // Render Active Courses
        var activeCourses = getUserActivePurchases(userData);
        activeCoursesCount.textContent = activeCourses.length + ' Active';
        userActiveCoursesList.innerHTML = '';

        if (activeCourses.length === 0) {
            userActiveCoursesList.innerHTML = '<p class="text-xs text-gray-400 italic py-3 text-center bg-gray-50 rounded-xl">No active course subscriptions.</p>';
        } else {
            activeCourses.forEach(function (c) {
                var pCard = document.createElement('div');
                pCard.className = 'flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs gap-2';
                pCard.innerHTML = `
                    <div class="flex items-center gap-2 min-w-0 flex-1">
                        <span class="text-emerald-600 font-bold">✓</span>
                        <span class="font-semibold text-gray-800 truncate" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</span>
                    </div>
                    <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md shrink-0">Active</span>
                `;
                userActiveCoursesList.appendChild(pCard);
            });
        }

        userPlaceholderCard.classList.add('hidden');
        selectedUserCard.classList.remove('hidden');
    }

    // 5. Render Available Courses & Mahapacks
    function renderCoursesGrid() {
        coursesContainer.innerHTML = '';
        var selectedClassFilter = classFilterSelect ? classFilterSelect.value : 'all';
        var searchQuery = (courseSearchInput ? courseSearchInput.value.trim().toLowerCase() : '');

        var allPlaylistKeys = Object.keys(playlistsData || {});

        if (allPlaylistKeys.length === 0) {
            coursesContainer.innerHTML = `
                <div class="col-span-full py-12 text-center text-gray-400">
                    <p class="text-sm font-medium">No courses or Mahapacks found in database.</p>
                </div>
            `;
            return;
        }

        var activeUserCourseIds = new Set();
        if (selectedUserKey && rawUsersData[selectedUserKey]) {
            var activeList = getUserActivePurchases(rawUsersData[selectedUserKey]);
            activeList.forEach(function (ac) {
                activeUserCourseIds.add(ac.id);
            });
        }

        var matchCount = 0;

        allPlaylistKeys.forEach(function (pId) {
            var p = playlistsData[pId];
            if (!p) return;

            var title = (p.name || p.title || 'Untitled Course').trim();
            var pClass = (p.class || '').trim();
            var isMahapack = !!p.isMahapack || p.type === 'mahapack';
            var thumb = p.thumbnailUrl || 'logo.png';
            var price = p.price || 0;
            var durationText = (p.durationEndDay && p.durationEndMonth) ? ('Valid till ' + p.durationEndDay + ' ' + p.durationEndMonth) : 'Annual Validity';

            // Filter checks
            if (selectedClassFilter !== 'all' && pClass !== selectedClassFilter) {
                return;
            }

            if (searchQuery && title.toLowerCase().indexOf(searchQuery) === -1 && pClass.toLowerCase().indexOf(searchQuery) === -1) {
                return;
            }

            matchCount++;
            var isAlreadyEnrolled = activeUserCourseIds.has(pId);
            var isSelected = (selectedCourseId === pId);

            var card = document.createElement('div');
            card.className = 'p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-3 relative ' +
                (isSelected 
                    ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500 shadow-md' 
                    : (isAlreadyEnrolled 
                        ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300' 
                        : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-sm'));

            card.innerHTML = `
                <div class="flex items-start gap-3">
                    <img src="${escapeHtml(thumb)}" alt="${escapeHtml(title)}" class="w-16 h-14 object-cover rounded-xl border border-gray-100 shrink-0" />
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap mb-1">
                            <span class="px-2 py-0.5 ${isMahapack ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-blue-100 text-blue-800 border-blue-200'} border rounded-md text-[10px] font-bold">
                                ${isMahapack ? '📦 Mahapack' : '📚 Course'}
                            </span>
                            ${pClass ? `<span class="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">${escapeHtml(pClass)}</span>` : ''}
                        </div>
                        <h4 class="text-xs font-bold text-gray-900 line-clamp-2" title="${escapeHtml(title)}">${escapeHtml(title)}</h4>
                    </div>
                </div>

                <div class="flex items-center justify-between border-t border-gray-100 pt-2 text-[11px]">
                    <span class="text-gray-500 font-medium">${escapeHtml(durationText)}</span>
                    ${isAlreadyEnrolled 
                        ? '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">✓ Enrolled</span>' 
                        : `<span class="font-bold text-gray-900">₹${price}</span>`}
                </div>
            `;

            card.addEventListener('click', function () {
                selectCourse(pId, p);
            });

            coursesContainer.appendChild(card);
        });

        if (matchCount === 0) {
            coursesContainer.innerHTML = `
                <div class="col-span-full py-12 text-center text-gray-400">
                    <p class="text-sm font-medium">No courses found matching current filters.</p>
                </div>
            `;
        }
    }

    // Select a Course to grant
    function selectCourse(pId, courseData) {
        selectedCourseId = pId;
        var title = (courseData.name || courseData.title || 'Untitled Course').trim();
        var isMahapack = !!courseData.isMahapack || courseData.type === 'mahapack';
        var durationText = (courseData.durationEndDay && courseData.durationEndMonth) 
            ? ('Expires on ' + courseData.durationEndDay + ' ' + courseData.durationEndMonth + ' annually') 
            : 'Standard annual subscription validity';

        selectedCourseTitle.textContent = title;
        selectedCourseMeta.textContent = (isMahapack ? '📦 Mahapack Bundle' : '📚 Playlist Course') + 
            (courseData.class ? ' • Class ' + courseData.class : '') + 
            (courseData.price ? ' • Value: ₹' + courseData.price : '');
        
        selectedCourseValidityBadge.innerHTML = `
            <span class="text-xs font-semibold px-3 py-1 bg-white text-emerald-700 rounded-full border border-emerald-200">
                ${escapeHtml(durationText)}
            </span>
        `;

        renderCoursesGrid();
        updateGrantButtonState();
    }

    // Course filters listeners
    if (classFilterSelect) {
        classFilterSelect.addEventListener('change', renderCoursesGrid);
    }
    if (courseSearchInput) {
        courseSearchInput.addEventListener('input', renderCoursesGrid);
    }

    // 6. Update Grant Button State
    function updateGrantButtonState() {
        if (!confirmGrantBtn) return;
        if (selectedUserKey && selectedCourseId) {
            confirmGrantBtn.disabled = false;
            var targetName = (rawUsersData[selectedUserKey]) 
                ? (rawUsersData[selectedUserKey].firstName || rawUsersData[selectedUserKey].name || selectedUserPhone)
                : selectedUserPhone;
            confirmGrantBtn.innerHTML = '<span>🎁 Grant Course to ' + escapeHtml(targetName) + '</span>';
        } else {
            confirmGrantBtn.disabled = true;
            if (!selectedUserKey) {
                confirmGrantBtn.innerHTML = '<span>1. Please Search & Select a Student First</span>';
            } else {
                confirmGrantBtn.innerHTML = '<span>2. Please Select a Course to Grant</span>';
            }
        }
    }

    // 7. Grant Subscription Execution: Exactly writes to users/{userKey}/purchased_playlists
    confirmGrantBtn.addEventListener('click', function () {
        if (!selectedUserKey || !selectedCourseId) return;

        var targetUser = rawUsersData[selectedUserKey] || {};
        var targetCourse = playlistsData[selectedCourseId] || {};
        var courseTitle = (targetCourse.name || targetCourse.title || selectedCourseId).trim();
        var studentName = (targetUser.firstName || targetUser.name || targetUser.username || '') || selectedUserPhone;
        var grantReason = (grantReasonInput ? grantReasonInput.value.trim() : '') || 'Admin Granted';
        var shouldSendNotif = grantNotifCheckbox ? grantNotifCheckbox.checked : true;

        var confirmMsg = 'Confirm:\n\n' +
            '👤 Student: ' + studentName + ' (' + (targetUser.phoneNumber || targetUser.phone || selectedUserKey) + ')\n' +
            '🎓 Course: ' + courseTitle + '\n\n' +
            'Grant this course to the student on the mobile app?';

        if (!confirm(confirmMsg)) {
            return;
        }

        confirmGrantBtn.disabled = true;
        confirmGrantBtn.innerHTML = '<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Granting course in Firebase...';

        var nowDate = new Date();
        var purchaseDateStr = formatAppDate(nowDate);
        
        // 1 Year Expiry
        var expiryDate = new Date(nowDate.getTime() + 365 * 24 * 60 * 60 * 1000);
        expiryDate.setHours(23, 59, 59);
        var expiryDateStr = formatAppDate(expiryDate);

        var paymentId = 'admin_grant_' + Date.now();
        var uK = selectedUserKey;
        var updates = {};

        // Mobile App Schema: users/{userKey}/purchased_playlists/{playlistId}
        var appPurchaseObj = {
            expiryDate: expiryDateStr,
            isPurchased: true,
            paymentId: paymentId,
            playlistId: selectedCourseId,
            purchaseDate: purchaseDateStr
        };

        updates['users/' + uK + '/purchased_playlists/' + selectedCourseId] = appPurchaseObj;

        // If Mahapack, also grant every included individual playlist
        if (targetCourse.isMahapack && Array.isArray(targetCourse.includedPlaylists)) {
            targetCourse.includedPlaylists.forEach(function (subId) {
                updates['users/' + uK + '/purchased_playlists/' + subId] = {
                    expiryDate: expiryDateStr,
                    isPurchased: true,
                    paymentId: paymentId,
                    playlistId: subId,
                    purchaseDate: purchaseDateStr,
                    parentMahapackId: selectedCourseId
                };
            });
        }

        // Notification
        if (shouldSendNotif) {
            var notifId = 'notif_grant_' + selectedCourseId + '_' + Date.now();
            updates['users/' + uK + '/notifications/' + notifId] = {
                title: '🎉 Course Subscription Granted!',
                message: 'Admin has granted you full access to "' + courseTitle + '". Happy learning!',
                courseName: courseTitle,
                playlistId: selectedCourseId,
                type: 'course_assigned',
                read: false,
                sentAt: Date.now()
            };
        }

        // Execute update in Firebase Realtime Database
        firebase.database().ref().update(updates).then(function () {
            showBanner('🎉 Successfully granted course "' + courseTitle + '" to student ' + studentName + '!', 'success');
            if (grantReasonInput) grantReasonInput.value = '';

            return firebase.database().ref('users/' + selectedUserKey).once('value');
        }).then(function (snap) {
            if (snap && snap.exists()) {
                rawUsersData[selectedUserKey] = snap.val();
                renderSelectedUser(selectedUserKey, rawUsersData[selectedUserKey]);
                renderCoursesGrid();
            }
            updateGrantButtonState();
        }).catch(function (error) {
            console.error('Grant subscription failed:', error);
            showBanner('Failed to grant subscription. Error: ' + error.message, 'error');
            updateGrantButtonState();
        });
    });

    // Start loading
    loadInitialData();
});
