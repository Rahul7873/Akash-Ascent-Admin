document.addEventListener('DOMContentLoaded', function() {
    // 1. Session Check
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var notificationForm = document.getElementById('notification-form');
    var photoUpload = document.getElementById('photo-upload');
    var photoPreview = document.getElementById('photo-preview');
    var notifTitleInput = document.getElementById('notif-title');
    var notifMessageInput = document.getElementById('notif-message');
    var targetAudienceSelect = document.getElementById('target-audience');
    var submitBtn = document.getElementById('submit-btn');
    var uploadStatus = document.getElementById('upload-status');

    var minutesInputContainer = document.getElementById('minutes-input-container');
    var hoursInputContainer = document.getElementById('hours-input-container');
    var scheduleInputContainer = document.getElementById('schedule-input-container');

    var sendAfterMinutesInput = document.getElementById('send-after-minutes');
    var sendAfterHoursInput = document.getElementById('send-after-hours');
    var sendScheduleDatetimeInput = document.getElementById('send-schedule-datetime');
    var scheduledSummaryText = document.getElementById('scheduled-summary-text');

    // Preview Elements
    var previewTitleText = document.getElementById('preview-title-text');
    var previewMessageText = document.getElementById('preview-message-text');
    var previewPhotoBox = document.getElementById('preview-photo-box');
    var previewPhotoImg = document.getElementById('preview-photo-img');
    var previewTime = document.getElementById('preview-time');

    function showStatus(text) {
        if (uploadStatus) uploadStatus.textContent = text;
    }

    // Set default datetime picker to 1 hour in future
    if (sendScheduleDatetimeInput) {
        var now = new Date();
        now.setHours(now.getHours() + 1);
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        sendScheduleDatetimeInput.value = now.toISOString().slice(0, 16);
    }

    // 2. Populate Preference Classes into Target Audience Dropdown
    firebase.database().ref('preferences').once('value').then(function(snapshot) {
        if (!targetAudienceSelect || !snapshot.exists()) return;

        var preferences = snapshot.val();
        Object.keys(preferences).forEach(function(prefId) {
            var pref = preferences[prefId];
            var classes = pref.classes || {};
            var classKeys = Object.keys(classes);

            if (classKeys.length > 0) {
                var optgroup = document.createElement('optgroup');
                optgroup.label = 'Class: ' + pref.name;

                classKeys.forEach(function(classId) {
                    var option = document.createElement('option');
                    option.value = 'class_' + classes[classId].name;
                    option.textContent = '📚 Class ' + classes[classId].name + ' Users';
                    optgroup.appendChild(option);
                });

                targetAudienceSelect.appendChild(optgroup);
            }
        });
    }).catch(function(err) {
        console.error('Failed to load classes for audience:', err);
    });

    // 3. Photo Preview and Live Card Preview Listeners
    photoUpload.addEventListener('change', function() {
        var file = photoUpload.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                photoPreview.src = e.target.result;
                photoPreview.classList.remove('hidden');

                previewPhotoImg.src = e.target.result;
                previewPhotoBox.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            photoPreview.src = '';
            photoPreview.classList.add('hidden');

            previewPhotoImg.src = '';
            previewPhotoBox.classList.add('hidden');
        }
    });

    notifTitleInput.addEventListener('input', function() {
        previewTitleText.textContent = notifTitleInput.value.trim() || 'Notification Title';
    });

    notifMessageInput.addEventListener('input', function() {
        previewMessageText.textContent = notifMessageInput.value.trim() || 'Notification message will appear here...';
    });

    // 4. Send Mode Radio Toggle Handler
    function getSelectedSendMode() {
        var radios = document.getElementsByName('send-mode');
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].checked) return radios[i].value;
        }
        return 'now';
    }

    function updateSendModeUI() {
        var mode = getSelectedSendMode();

        minutesInputContainer.classList.add('hidden');
        hoursInputContainer.classList.add('hidden');
        scheduleInputContainer.classList.add('hidden');

        if (mode === 'minutes') {
            minutesInputContainer.classList.remove('hidden');
            var mins = parseInt(sendAfterMinutesInput.value, 10) || 10;
            scheduledSummaryText.textContent = 'In ' + mins + ' minutes';
            previewTime.textContent = 'In ' + mins + ' min';
        } else if (mode === 'hours') {
            hoursInputContainer.classList.remove('hidden');
            var hrs = parseInt(sendAfterHoursInput.value, 10) || 1;
            scheduledSummaryText.textContent = 'In ' + hrs + ' hour(s)';
            previewTime.textContent = 'In ' + hrs + ' hr';
        } else if (mode === 'schedule') {
            scheduleInputContainer.classList.remove('hidden');
            var dtVal = sendScheduleDatetimeInput.value;
            if (dtVal) {
                var d = new Date(dtVal);
                scheduledSummaryText.textContent = d.toLocaleString();
                previewTime.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                scheduledSummaryText.textContent = 'Custom Scheduled Time';
                previewTime.textContent = 'Scheduled';
            }
        } else {
            scheduledSummaryText.textContent = 'Immediately (Now)';
            previewTime.textContent = 'Just Now';
        }
    }

    var sendModeRadios = document.getElementsByName('send-mode');
    sendModeRadios.forEach(function(radio) {
        radio.addEventListener('change', updateSendModeUI);
    });

    sendAfterMinutesInput.addEventListener('input', updateDurationSummary);
    sendAfterHoursInput.addEventListener('input', updateDurationSummary);
    sendScheduleDatetimeInput.addEventListener('change', updateDurationSummary);

    function updateDurationSummary() {
        updateSendModeUI();
    }

    updateSendModeUI();

    // 5. Form Submission Handler
    notificationForm.addEventListener('submit', function(e) {
        e.preventDefault();

        if (submitBtn && submitBtn.disabled) {
            alert('Send Notification service is temporarily unavailable due to system maintenance.');
            return;
        }

        var title = notifTitleInput.value.trim();
        var message = notifMessageInput.value.trim();
        var audience = targetAudienceSelect.value;
        var mode = getSelectedSendMode();
        var photoFile = photoUpload.files[0];

        if (!title || !message) {
            alert('Please enter notification title and message.');
            return;
        }

        var nowMs = Date.now();
        var scheduledTimeMs = nowMs;

        if (mode === 'minutes') {
            var mins = parseInt(sendAfterMinutesInput.value, 10) || 0;
            if (mins <= 0) {
                alert('Please enter a valid number of minutes.');
                return;
            }
            scheduledTimeMs = nowMs + (mins * 60 * 1000);
        } else if (mode === 'hours') {
            var hrs = parseInt(sendAfterHoursInput.value, 10) || 0;
            if (hrs <= 0) {
                alert('Please enter a valid number of hours.');
                return;
            }
            scheduledTimeMs = nowMs + (hrs * 60 * 60 * 1000);
        } else if (mode === 'schedule') {
            var dtVal = sendScheduleDatetimeInput.value;
            if (!dtVal) {
                alert('Please select a valid date and time for scheduling.');
                return;
            }
            scheduledTimeMs = new Date(dtVal).getTime();
            if (isNaN(scheduledTimeMs)) {
                alert('Invalid scheduled date and time.');
                return;
            }
        }

        var isImmediate = scheduledTimeMs <= (nowMs + 10000); // 10s buffer

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Processing...</span>';
        }

        var notifId = 'notif_' + Date.now();

        function dispatchNotification(photoUrl) {
            showStatus('Dispatching notification...');

            var notificationPayload = {
                notificationId: notifId,
                title: title,
                message: message,
                photoUrl: photoUrl || '',
                targetAudience: audience,
                sendMode: mode,
                scheduledTime: scheduledTimeMs,
                status: isImmediate ? 'sent' : 'scheduled',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                sentAt: isImmediate ? firebase.database.ServerValue.TIMESTAMP : null
            };

            // 1. Save in master notifications log
            var savePromises = [
                firebase.database().ref('broadcast_notifications/' + notifId).set(notificationPayload)
            ];

            // 2. Fetch users and dispatch directly if immediate or targeted
            firebase.database().ref('users').once('value').then(function(snapshot) {
                var users = snapshot.val() || {};
                var updates = {};

                Object.keys(users).forEach(function(userId) {
                    var user = users[userId];
                    if (!user) return;

                    var isMatch = false;
                    if (audience === 'all' || audience === 'android_all') {
                        isMatch = true;
                    } else if (audience.startsWith('class_')) {
                        var targetClass = audience.replace('class_', '');
                        if (user.class === targetClass || user.preferenceClass === targetClass || user.courseClass === targetClass) {
                            isMatch = true;
                        }
                    }

                    if (isMatch) {
                        updates['users/' + userId + '/notifications/' + notifId] = {
                            title: title,
                            message: message,
                            photoUrl: photoUrl || '',
                            notifId: notifId,
                            type: 'broadcast',
                            platform: 'android',
                            status: isImmediate ? 'sent' : 'scheduled',
                            scheduledTime: scheduledTimeMs,
                            read: false,
                            createdAt: Date.now()
                        };
                    }
                });

                if (Object.keys(updates).length > 0) {
                    return firebase.database().ref().update(updates);
                }
            }).then(function() {
                // Call Firebase Functions FCM push notification endpoint for Android devices
                if (isImmediate && firebase.functions) {
                    try {
                        var sendFCM = firebase.functions().httpsCallable('sendAndroidFCMNotification');
                        return sendFCM({
                            title: title,
                            message: message,
                            photoUrl: photoUrl || '',
                            targetAudience: audience
                        }).then(function(res) {
                            console.log('FCM Push Result:', res.data);
                        }).catch(function(err) {
                            console.warn('FCM Push Cloud Function call warning:', err);
                        });
                    } catch (e) {
                        console.warn('Functions SDK warning:', e);
                    }
                }
            }).then(function() {
                var successMsg = isImmediate 
                    ? '✅ Notification sent & pushed to Android phones!' 
                    : '📅 Notification scheduled successfully for ' + new Date(scheduledTimeMs).toLocaleString() + '!';

                showStatus(successMsg);
                alert(successMsg);

                notificationForm.reset();
                photoPreview.src = '';
                photoPreview.classList.add('hidden');
                previewPhotoImg.src = '';
                previewPhotoBox.classList.add('hidden');
                previewTitleText.textContent = 'Notification Title';
                previewMessageText.textContent = 'Notification message will appear here...';
                updateSendModeUI();

                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>Send Notification</span>';
                }
            }).catch(function(error) {
                console.error('Notification dispatch failed:', error);
                showStatus('Failed to send notification. Check console for details.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>Send Notification</span>';
                }
            });
        }

        if (photoFile) {
            showStatus('Uploading notification photo...');
            var storageRef = firebase.storage().ref();
            var photoRef = storageRef.child('notifications/photos/' + notifId + '_' + photoFile.name);
            var uploadTask = photoRef.put(photoFile);

            uploadTask.on('state_changed', function(snapshot) {
                var progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                showStatus('Uploading photo: ' + progress + '%');
            }, function(error) {
                console.error('Photo upload error:', error);
                showStatus('Photo upload failed. Proceeding without image...');
                dispatchNotification('');
            }, function() {
                uploadTask.snapshot.ref.getDownloadURL().then(function(photoUrl) {
                    dispatchNotification(photoUrl);
                }).catch(function(err) {
                    console.error('Get photo URL error:', err);
                    dispatchNotification('');
                });
            });
        } else {
            dispatchNotification('');
        }
    });

    // 6. Notifications Dashboard Handler (Live updates, Resend, Delete)
    var dashboardList = document.getElementById('notifications-dashboard-list');
    var countBadge = document.getElementById('notif-count-badge');

    function formatAudience(audience) {
        if (!audience || audience === 'android_all') return '📱 Android App Users';
        if (audience === 'all') return '🌐 All Users';
        if (audience.startsWith('class_')) return '📚 Class ' + audience.replace('class_', '');
        return audience;
    }

    function formatTime(timestamp) {
        if (!timestamp) return 'Just now';
        var d = new Date(timestamp);
        if (isNaN(d.getTime())) return '';
        var diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
        if (diffSec < 60) return 'Just now';
        if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm ago';
        if (diffSec < 86400) return Math.floor(diffSec / 3600) + 'h ago';
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // Attach real-time listener for broadcast_notifications
    firebase.database().ref('broadcast_notifications').on('value', function(snapshot) {
        if (!dashboardList) return;
        dashboardList.innerHTML = '';

        if (!snapshot.exists()) {
            if (countBadge) countBadge.textContent = '0';
            dashboardList.innerHTML = `
                <div class="text-center py-8 text-xs text-gray-500 bg-white rounded-xl border border-dashed border-gray-200 p-4">
                    <p class="font-medium text-gray-700">No notifications sent yet</p>
                    <p class="mt-1 text-[11px] text-gray-400">Created notifications will appear here for review, resending, or deleting.</p>
                </div>
            `;
            return;
        }

        var notifsObj = snapshot.val();
        var keys = Object.keys(notifsObj || {});
        if (countBadge) countBadge.textContent = keys.length;

        var items = [];
        keys.forEach(function(k) {
            var item = notifsObj[k];
            item._key = k;
            items.push(item);
        });

        // Sort descending by createdAt or scheduledTime
        items.sort(function(a, b) {
            var timeA = a.createdAt || a.scheduledTime || 0;
            var timeB = b.createdAt || b.scheduledTime || 0;
            return timeB - timeA;
        });

        items.forEach(function(notif) {
            var isScheduled = notif.status === 'scheduled';
            var timeLabel = isScheduled ? 'Scheduled: ' + formatTime(notif.scheduledTime) : formatTime(notif.createdAt || notif.sentAt);

            var card = document.createElement('div');
            card.className = 'bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 hover:border-amber-300 transition space-y-2.5';
            
            var photoHTML = notif.photoUrl ? `
                <div class="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                    <img src="${notif.photoUrl}" alt="Thumbnail" class="w-full h-full object-cover" />
                </div>
            ` : '';

            card.innerHTML = `
                <div class="flex items-center justify-between gap-2 text-xs">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${isScheduled ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}">
                            ${isScheduled ? '⏳ Scheduled' : '✓ Sent'}
                        </span>
                        <span class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700">
                            ${formatAudience(notif.targetAudience)}
                        </span>
                    </div>
                    <span class="text-[11px] text-gray-400 font-medium shrink-0">${timeLabel}</span>
                </div>
                <div class="flex items-start gap-3">
                    ${photoHTML}
                    <div class="min-w-0 flex-1">
                        <h4 class="text-xs font-bold text-gray-900 leading-snug truncate" title="${notif.title || ''}">${notif.title || 'Untitled Notification'}</h4>
                        <p class="text-[11px] text-gray-600 mt-0.5 line-clamp-2 leading-relaxed" title="${notif.message || ''}">${notif.message || ''}</p>
                    </div>
                </div>
                <div class="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                    <button type="button" class="resend-notif-btn px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        <span>Resend</span>
                    </button>
                    <button type="button" class="delete-notif-btn px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold transition flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        <span>Delete</span>
                    </button>
                </div>
            `;

            var resendBtn = card.querySelector('.resend-notif-btn');
            var deleteBtn = card.querySelector('.delete-notif-btn');

            if (resendBtn) {
                resendBtn.addEventListener('click', function() {
                    handleResendNotification(notif);
                });
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', function() {
                    handleDeleteNotification(notif);
                });
            }

            dashboardList.appendChild(card);
        });
    });

    function handleResendNotification(notif) {
        if (!confirm('Are you sure you want to RESEND this notification now?\n\nTitle: "' + (notif.title || '') + '"')) {
            return;
        }

        showStatus('Resending notification...');
        var newNotifId = 'notif_' + Date.now();
        var nowMs = Date.now();

        var notificationPayload = {
            notificationId: newNotifId,
            title: notif.title || '',
            message: notif.message || '',
            photoUrl: notif.photoUrl || '',
            targetAudience: notif.targetAudience || 'android_all',
            sendMode: 'now',
            scheduledTime: nowMs,
            status: 'sent',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            sentAt: firebase.database.ServerValue.TIMESTAMP
        };

        firebase.database().ref('broadcast_notifications/' + newNotifId).set(notificationPayload)
        .then(function() {
            return firebase.database().ref('users').once('value');
        })
        .then(function(snapshot) {
            var users = snapshot.val() || {};
            var updates = {};
            var audience = notif.targetAudience || 'android_all';

            Object.keys(users).forEach(function(userId) {
                var user = users[userId];
                if (!user) return;

                var isMatch = false;
                if (audience === 'all' || audience === 'android_all') {
                    isMatch = true;
                } else if (audience.startsWith('class_')) {
                    var targetClass = audience.replace('class_', '');
                    if (user.class === targetClass || user.preferenceClass === targetClass || user.courseClass === targetClass) {
                        isMatch = true;
                    }
                }

                if (isMatch) {
                    updates['users/' + userId + '/notifications/' + newNotifId] = {
                        title: notif.title || '',
                        message: notif.message || '',
                        photoUrl: notif.photoUrl || '',
                        notifId: newNotifId,
                        type: 'broadcast',
                        platform: 'android',
                        status: 'sent',
                        scheduledTime: nowMs,
                        read: false,
                        createdAt: nowMs
                    };
                }
            });

            if (Object.keys(updates).length > 0) {
                return firebase.database().ref().update(updates);
            }
        })
        .then(function() {
            if (firebase.functions) {
                try {
                    var sendFCM = firebase.functions().httpsCallable('sendAndroidFCMNotification');
                    sendFCM({
                        title: notif.title || '',
                        message: notif.message || '',
                        photoUrl: notif.photoUrl || '',
                        targetAudience: notif.targetAudience || 'android_all'
                    });
                } catch (e) {
                    console.warn('FCM Push warning:', e);
                }
            }
        })
        .then(function() {
            showStatus('✅ Notification resent successfully!');
            alert('Notification resent successfully!');
        })
        .catch(function(err) {
            console.error('Resend failed:', err);
            showStatus('Failed to resend notification.');
            alert('Failed to resend notification.');
        });
    }

    function handleDeleteNotification(notif) {
        var key = notif._key || notif.notificationId;
        if (!key) return;

        if (!confirm('Are you sure you want to DELETE this notification?\n\nTitle: "' + (notif.title || '') + '"\n\nThis will remove it permanently.')) {
            return;
        }

        showStatus('Deleting notification...');

        firebase.database().ref('broadcast_notifications/' + key).remove()
        .then(function() {
            return firebase.database().ref('users').once('value');
        })
        .then(function(snapshot) {
            var users = snapshot.val() || {};
            var updates = {};
            Object.keys(users).forEach(function(userId) {
                if (users[userId] && users[userId].notifications && users[userId].notifications[key]) {
                    updates['users/' + userId + '/notifications/' + key] = null;
                }
            });

            if (Object.keys(updates).length > 0) {
                return firebase.database().ref().update(updates);
            }
        })
        .then(function() {
            showStatus('🗑️ Notification deleted successfully!');
        })
        .catch(function(err) {
            console.error('Delete notification failed:', err);
            showStatus('Failed to delete notification.');
            alert('Failed to delete notification.');
        });
    }
});
