document.addEventListener('DOMContentLoaded', function() {
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var params = new URLSearchParams(window.location.search);
    var playlistId = params.get('playlistId');
    var playlistName = decodeURIComponent(params.get('playlistName') || '');

    var playlistTitle = document.getElementById('main-title');
    var playlistTagline = document.getElementById('main-tagline');
    var backBtn = document.getElementById('back-btn');
    var courseForm = document.getElementById('course-form');
    var videoUpload = document.getElementById('video-upload');
    var thumbnailUpload = document.getElementById('thumbnail-upload');
    var uploadStatus = document.getElementById('status-text');
    var uploadPercentage = document.getElementById('upload-percentage');
    var uploadProgressBar = document.getElementById('upload-progress-bar');
    var statusContainer = document.getElementById('status-container');
    var submitBtn = courseForm.querySelector('button[type="submit"]');

    if (!playlistId) {
        alert('No playlist selected. Please choose a playlist first.');
        window.location.href = 'all-playlists.html';
        return;
    }

    function sanitizeVideoId(title, serial) {
        var normalizedTitle = (title || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
        var normalizedSerial = (serial || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
        if (normalizedSerial) {
            return normalizedTitle + '-' + normalizedSerial;
        }
        return normalizedTitle || 'video-' + Date.now();
    }

    function showStatus(message) {
        if (uploadStatus) uploadStatus.textContent = message;
        if (statusContainer) statusContainer.classList.remove('hidden');
    }

    function resetPreviews() {
        var videoPreview = document.getElementById('video-preview');
        var videoIcon = document.getElementById('video-icon');
        var videoText = document.getElementById('video-upload-text');
        var thumbPreview = document.getElementById('thumbnail-preview');
        var thumbIcon = document.getElementById('thumbnail-icon');
        var thumbText = document.getElementById('thumbnail-upload-text');

        if (videoPreview) {
            videoPreview.classList.add('hidden');
            videoPreview.src = '';
        }
        if (videoIcon) videoIcon.classList.remove('hidden');
        if (videoText) videoText.classList.remove('hidden');

        if (thumbPreview) {
            thumbPreview.classList.add('hidden');
            thumbPreview.src = '';
        }
        if (thumbIcon) thumbIcon.classList.remove('hidden');
        if (thumbText) thumbText.classList.remove('hidden');

        if (statusContainer) statusContainer.classList.add('hidden');
        if (uploadProgressBar) uploadProgressBar.style.width = '0%';
        if (uploadPercentage) uploadPercentage.textContent = '0%';
    }

    function updateProgress(videoProgress, thumbProgress) {
        if (uploadPercentage && uploadProgressBar) {
            var overall = Math.round((videoProgress + thumbProgress) / 2);
            uploadPercentage.textContent = overall + '%';
            uploadProgressBar.style.width = overall + '%';
        }
    }

    function loadPlaylistInfo() {
        showStatus('Loading playlist info...');
        firebase.database().ref('playlists/' + playlistId).once('value').then(function(snapshot) {
            if (!snapshot.exists()) {
                alert('Selected playlist not found.');
                window.location.href = 'all-playlists.html';
                return;
            }
            var playlistData = snapshot.val();
            playlistName = playlistData.name || playlistName || playlistId;
            if (playlistTitle) playlistTitle.textContent = 'Add Video';
            if (playlistTagline) {
                playlistTagline.textContent = 'Upload a video to playlist: ' + playlistName + ' (' + (playlistData.class || '-') + ')';
            }
            if (backBtn) {
                backBtn.href = 'playlist_dashboard.html?playlistId=' + encodeURIComponent(playlistId) + '&playlistName=' + encodeURIComponent(playlistName);
            }
            showStatus('Ready to upload video to playlist "' + playlistName + '".');
        }).catch(function(error) {
            console.error('Playlist load failed:', error);
            alert('Failed to load playlist details. Please try again.');
            window.location.href = 'all-playlists.html';
        });
    }

    window.showVideoPreview = function(event) {
        var file = event.target.files[0];
        if (!file) return;
        var preview = document.getElementById('video-preview');
        var icon = document.getElementById('video-icon');
        var text = document.getElementById('video-upload-text');
        var fileURL = URL.createObjectURL(file);

        preview.src = fileURL;
        preview.classList.remove('hidden');
        icon.classList.add('hidden');
        text.classList.add('hidden');
    };

    window.showThumbnailPreview = function(event) {
        var file = event.target.files[0];
        if (!file) return;
        var preview = document.getElementById('thumbnail-preview');
        var icon = document.getElementById('thumbnail-icon');
        var text = document.getElementById('thumbnail-upload-text');
        var fileURL = URL.createObjectURL(file);

        preview.src = fileURL;
        preview.classList.remove('hidden');
        icon.classList.add('hidden');
        text.classList.add('hidden');
    };

    courseForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var title = document.getElementById('title-input').value.trim();
        var description = document.getElementById('description-input').value.trim();
        var serial = document.getElementById('serial-input').value.trim();
        var author = document.getElementById('author-input').value.trim();
        var isDemo = document.getElementById('demo-checkbox') ? document.getElementById('demo-checkbox').checked : false;
        var videoFile = videoUpload.files[0];
        var thumbnailFile = thumbnailUpload.files[0];

        if (!title) {
            alert('Please enter the video title.');
            return;
        }
        if (!videoFile || !thumbnailFile) {
            alert('Please upload both a video and a thumbnail.');
            return;
        }

        var originalBtnText = submitBtn ? submitBtn.innerText : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Uploading...';
        }

        var timestamp = Date.now();
        var videoId = sanitizeVideoId(title, serial);
        var storageRef = firebase.storage().ref();
        var videoRef = storageRef.child('playlists/' + playlistId + '/videos/' + timestamp + '_' + videoFile.name);
        var thumbRef = storageRef.child('playlists/' + playlistId + '/videos/' + timestamp + '_' + thumbnailFile.name);
        var videoProgress = 0;
        var thumbProgress = 0;

        function restoreSubmitButton() {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
            }
        }

        var videoUploadTask = videoRef.put(videoFile);
        var thumbUploadTask = thumbRef.put(thumbnailFile);

        videoUploadTask.on('state_changed', function(snapshot) {
            videoProgress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            updateProgress(videoProgress, thumbProgress);
        }, function(error) {
            console.error('Video upload error:', error);
            showStatus('Video upload failed. Please try again.');
            restoreSubmitButton();
        });

        thumbUploadTask.on('state_changed', function(snapshot) {
            thumbProgress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            updateProgress(videoProgress, thumbProgress);
        }, function(error) {
            console.error('Thumbnail upload error:', error);
            showStatus('Thumbnail upload failed. Please try again.');
            restoreSubmitButton();
        });

        showStatus('Uploading video and thumbnail...');

        Promise.all([
            videoUploadTask.then(function(snapshot) { return snapshot.ref.getDownloadURL(); }),
            thumbUploadTask.then(function(snapshot) { return snapshot.ref.getDownloadURL(); })
        ]).then(function(urls) {
            var videoUrl = urls[0];
            var thumbnailUrl = urls[1];
            var updates = {
                title: title,
                description: description,
                serial: serial,
                author: author,
                isDemo: isDemo,
                videoUrl: videoUrl,
                thumbnailUrl: thumbnailUrl,
                videoPath: videoRef.fullPath,
                thumbnailPath: thumbRef.fullPath,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };

            var videoRefDb = firebase.database().ref('playlists/' + playlistId + '/videos/' + videoId);
            return videoRefDb.once('value').then(function(snapshot) {
                if (snapshot.exists()) {
                    throw new Error('A video with this title and serial already exists. Change the title or serial and try again.');
                }
                return videoRefDb.set(updates);
            });
        }).then(function() {
            showStatus('Video uploaded successfully.');
            restoreSubmitButton();
            courseForm.reset();
            resetPreviews();
        }).catch(function(error) {
            console.error('Upload failed:', error);
            showStatus('Upload failed. ' + (error && error.message ? error.message : 'Please try again.'));
            restoreSubmitButton();
        });
    });

    courseForm.addEventListener('reset', function() {
        resetPreviews();
    });

    loadPlaylistInfo();
});
