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
});
