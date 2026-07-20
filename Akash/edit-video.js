document.addEventListener('DOMContentLoaded', function() {
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var params = new URLSearchParams(window.location.search);
    var playlistId = params.get('playlistId');
    var playlistName = decodeURIComponent(params.get('playlistName') || '');
    var videoId = params.get('videoId') ? decodeURIComponent(params.get('videoId')) : null;

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
    var currentVideoData = null;

    if (!playlistId || !videoId) {
        alert('Invalid edit request. Please select a video from the playlist.');
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

    function loadPlaylistInfo() {
        showStatus('Loading playlist information...');
        firebase.database().ref('playlists/' + playlistId).once('value').then(function(snapshot) {
            if (!snapshot.exists()) {
                alert('Playlist not found. Please choose a valid playlist.');
                window.location.href = 'all-playlists.html';
                return;
            }

            var playlistData = snapshot.val();
            var displayName = playlistData.name || playlistName || playlistId;
            if (playlistTitle) playlistTitle.textContent = 'Edit Video';
            if (playlistTagline) {
                playlistTagline.textContent = 'Update video for playlist: ' + displayName + ' (' + (playlistData.class || '-') + ')';
            }
            if (backBtn) {
                backBtn.href = 'playlist_dashboard.html?playlistId=' + encodeURIComponent(playlistId) + '&playlistName=' + encodeURIComponent(displayName);
            }
            if (submitBtn) {
                submitBtn.innerText = 'UPDATE';
            }
            loadVideoData(videoId);
        }).catch(function(error) {
            console.error('Failed to load playlist:', error);
            alert('Unable to load playlist details. Please try again.');
            window.location.href = 'all-playlists.html';
        });
    }

    function loadVideoData(videoId) {
        showStatus('Loading video details...');
        firebase.database().ref('playlists/' + playlistId + '/videos/' + videoId).once('value').then(function(snapshot) {
            if (!snapshot.exists()) {
                alert('Video not found. Please select another video.');
                window.location.href = 'playlist_dashboard.html?playlistId=' + encodeURIComponent(playlistId) + '&playlistName=' + encodeURIComponent(playlistName);
                return;
            }

            currentVideoData = snapshot.val();
            document.getElementById('title-input').value = currentVideoData.title || '';
            document.getElementById('description-input').value = currentVideoData.description || '';
            document.getElementById('serial-input').value = currentVideoData.serial || '';
            document.getElementById('author-input').value = currentVideoData.author || '';
            if (document.getElementById('demo-checkbox')) {
                document.getElementById('demo-checkbox').checked = currentVideoData.isDemo === true;
            }

            if (currentVideoData.thumbnailUrl) {
                var thumbPreview = document.getElementById('thumbnail-preview');
                var thumbIcon = document.getElementById('thumbnail-icon');
                var thumbText = document.getElementById('thumbnail-upload-text');
                thumbPreview.src = currentVideoData.thumbnailUrl;
                thumbPreview.classList.remove('hidden');
                thumbIcon.classList.add('hidden');
                thumbText.classList.add('hidden');
            }

            if (currentVideoData.videoUrl) {
                var videoPreview = document.getElementById('video-preview');
                var videoIcon = document.getElementById('video-icon');
                var videoText = document.getElementById('video-upload-text');
                videoPreview.src = currentVideoData.videoUrl;
                videoPreview.classList.remove('hidden');
                videoIcon.classList.add('hidden');
                videoText.classList.add('hidden');
            }

            showStatus('Editing "' + (currentVideoData.title || '') + '". Select new files only if you want to replace the existing media.');
        }).catch(function(error) {
            console.error('Failed to load video:', error);
            alert('Unable to load video details. Please try again.');
            window.location.href = 'playlist_dashboard.html?playlistId=' + encodeURIComponent(playlistId) + '&playlistName=' + encodeURIComponent(playlistName);
        });
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

        if (!currentVideoData) {
            alert('Unable to update until the video details finish loading.');
            return;
        }

        var title = document.getElementById('title-input').value.trim();
        var description = document.getElementById('description-input').value.trim();
        var serial = document.getElementById('serial-input').value.trim();
        var author = document.getElementById('author-input').value.trim();
        var videoFile = videoUpload.files[0];
        var thumbnailFile = thumbnailUpload.files[0];

        if (!title) {
            alert('Please enter the video title.');
            return;
        }

        var originalBtnText = submitBtn ? submitBtn.innerText : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Updating...';
        }

        var timestamp = Date.now();
        var newVideoId = sanitizeVideoId(title, serial);
        var renameVideo = newVideoId !== videoId;
        var storage = firebase.storage().ref();
        var videoRef = videoFile ? storage.child('playlists/' + playlistId + '/videos/' + timestamp + '_' + videoFile.name) : null;
        var thumbRef = thumbnailFile ? storage.child('playlists/' + playlistId + '/videos/' + timestamp + '_' + thumbnailFile.name) : null;

        var videoTaskPromise = videoFile ? videoRef.put(videoFile).then(function(snapshot) { return snapshot.ref.getDownloadURL(); }) : Promise.resolve(currentVideoData.videoUrl || null);
        var thumbTaskPromise = thumbnailFile ? thumbRef.put(thumbnailFile).then(function(snapshot) { return snapshot.ref.getDownloadURL(); }) : Promise.resolve(currentVideoData.thumbnailUrl || null);

        if (videoFile) {
            var videoUploadTask = videoRef.put(videoFile);
            videoUploadTask.on('state_changed', function(snapshot) {
                var progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                if (uploadPercentage && uploadProgressBar) {
                    var overall = videoFile && thumbnailFile ? Math.round((progress + parseInt(uploadPercentage.textContent || '0', 10)) / 2) : progress;
                    uploadPercentage.textContent = overall + '%';
                    uploadProgressBar.style.width = overall + '%';
                }
            }, function(error) {
                console.error('Video upload error:', error);
                showStatus('Video upload failed. Please try again.');
            });
        }

        if (thumbnailFile) {
            var thumbUploadTask = thumbRef.put(thumbnailFile);
            thumbUploadTask.on('state_changed', function(snapshot) {
                var progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                if (uploadPercentage && uploadProgressBar) {
                    var previous = videoFile ? parseInt(uploadPercentage.textContent || '0', 10) : 0;
                    var overall = thumbnailFile && videoFile ? Math.round((previous + progress) / 2) : progress;
                    uploadPercentage.textContent = overall + '%';
                    uploadProgressBar.style.width = overall + '%';
                }
            }, function(error) {
                console.error('Thumbnail upload error:', error);
                showStatus('Thumbnail upload failed. Please try again.');
            });
        }

        showStatus('Starting update...');

        Promise.all([videoTaskPromise, thumbTaskPromise]).then(function(urls) {
            var videoUrl = urls[0];
            var thumbUrl = urls[1];
            var isDemo = document.getElementById('demo-checkbox') ? document.getElementById('demo-checkbox').checked : false;
            var updates = {
                title: title,
                description: description,
                serial: serial,
                author: author,
                isDemo: isDemo,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };

            if (videoUrl != null) {
                updates.videoUrl = videoUrl;
            }
            if (thumbUrl != null) {
                updates.thumbnailUrl = thumbUrl;
            }
            if (videoFile && videoRef) {
                updates.videoPath = videoRef.fullPath;
            } else if (currentVideoData.videoPath) {
                updates.videoPath = currentVideoData.videoPath;
            }
            if (thumbnailFile && thumbRef) {
                updates.thumbnailPath = thumbRef.fullPath;
            } else if (currentVideoData.thumbnailPath) {
                updates.thumbnailPath = currentVideoData.thumbnailPath;
            }

            var cleanupPromises = [];
            if (videoFile && currentVideoData.videoPath) {
                cleanupPromises.push(firebase.storage().ref(currentVideoData.videoPath).delete().catch(function() { return null; }));
            }
            if (thumbnailFile && currentVideoData.thumbnailPath) {
                cleanupPromises.push(firebase.storage().ref(currentVideoData.thumbnailPath).delete().catch(function() { return null; }));
            }

            return Promise.all(cleanupPromises).then(function() {
                var currentRef = firebase.database().ref('playlists/' + playlistId + '/videos/' + videoId);
                if (renameVideo) {
                    var newRef = firebase.database().ref('playlists/' + playlistId + '/videos/' + newVideoId);
                    return newRef.once('value').then(function(snapshot) {
                        if (snapshot.exists()) {
                            throw new Error('A video with the same title and serial already exists.');
                        }
                        return newRef.set(updates);
                    }).then(function() {
                        return currentRef.remove();
                    });
                }
                return currentRef.update(updates);
            });
        }).then(function() {
            showStatus('Video updated successfully. Redirecting back to playlist.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
            }
            window.location.href = 'playlist_dashboard.html?playlistId=' + encodeURIComponent(playlistId) + '&playlistName=' + encodeURIComponent(playlistName);
        }).catch(function(error) {
            console.error('Update failed:', error);
            showStatus('Update failed. ' + (error && error.message ? error.message : 'Please try again.'));
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
            }
        });
    });

    courseForm.addEventListener('reset', function() {
        if (videoId) {
            loadVideoData(videoId);
        } else {
            resetPreviews();
        }
    });

    loadPlaylistInfo();
});
