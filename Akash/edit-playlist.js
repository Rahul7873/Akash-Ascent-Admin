document.addEventListener('DOMContentLoaded', function() {
    // Session check
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var params = new URLSearchParams(window.location.search);
    var playlistId = params.get('playlistId');
    var playlistNameParam = decodeURIComponent(params.get('playlistName') || '');

    var playlistForm = document.getElementById('playlist-form');
    var thumbnailUpload = document.getElementById('thumbnail-upload');
    var thumbnailPreview = document.getElementById('thumbnail-preview');
    var uploadStatus = document.getElementById('upload-status');
    var courseClassSelect = document.getElementById('course-class');
    var backBtn = document.getElementById('back-btn');
    var submitBtn = document.getElementById('submit-btn');

    var currentPlaylistData = null;

    if (!playlistId) {
        alert('No playlist selected to edit.');
        window.location.href = 'all-playlists.html';
        return;
    }

    // Configure back button link
    if (backBtn) {
        backBtn.href = 'playlist_dashboard.html?playlistId=' + encodeURIComponent(playlistId) + '&playlistName=' + encodeURIComponent(playlistNameParam);
    }

    function showStatus(text) {
        if (uploadStatus) {
            uploadStatus.textContent = text;
        }
    }

    // 1. Populate class dropdown from preferences database node
    function loadPreferences(selectedClass) {
        return firebase.database().ref('preferences').once('value').then(function(snapshot) {
            if (!courseClassSelect) return;
            courseClassSelect.innerHTML = '';

            if (!snapshot.exists()) {
                var defaultOpt = document.createElement('option');
                defaultOpt.value = '';
                defaultOpt.disabled = true;
                defaultOpt.selected = true;
                defaultOpt.textContent = 'No preferences added. Please add them first.';
                courseClassSelect.appendChild(defaultOpt);
                return;
            }

            var defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.disabled = true;
            defaultOpt.textContent = 'Select a class';
            courseClassSelect.appendChild(defaultOpt);

            var preferences = snapshot.val();
            Object.keys(preferences).forEach(function(prefId) {
                var pref = preferences[prefId];
                var classes = pref.classes || {};
                var classKeys = Object.keys(classes);

                if (classKeys.length > 0) {
                    var optgroup = document.createElement('optgroup');
                    optgroup.label = pref.name;
                    
                    classKeys.forEach(function(classId) {
                        var option = document.createElement('option');
                        var className = classes[classId].name;
                        option.value = className;
                        option.textContent = className;
                        if (selectedClass && selectedClass === className) {
                            option.selected = true;
                        }
                        optgroup.appendChild(option);
                    });

                    courseClassSelect.appendChild(optgroup);
                }
            });

            if (selectedClass) {
                courseClassSelect.value = selectedClass;
            }
        }).catch(function(err) {
            console.error('Failed to load preferences:', err);
            if (courseClassSelect) {
                courseClassSelect.innerHTML = '<option value="" disabled selected>Failed to load classes</option>';
            }
        });
    }

    // Populate End Day dropdown 01 to 31 & Duration Preview Handler
    function populateDayDropdowns() {
        var endDaySelect = document.getElementById('duration-end-day');
        if (!endDaySelect) return;

        for (var i = 1; i <= 31; i++) {
            var dayVal = i < 10 ? '0' + i : '' + i;
            var opt = document.createElement('option');
            opt.value = dayVal;
            opt.textContent = dayVal;
            endDaySelect.appendChild(opt);
        }
    }

    function updateDurationPreview() {
        var eDay = document.getElementById('duration-end-day') ? document.getElementById('duration-end-day').value : '';
        var eMonth = document.getElementById('duration-end-month') ? document.getElementById('duration-end-month').value : '';
        var previewEl = document.getElementById('duration-preview-text');

        if (!previewEl) return;

        if (eDay && eMonth) {
            previewEl.textContent = 'Valid from purchase date until ' + eDay + ' ' + eMonth;
        } else {
            previewEl.textContent = 'Not configured';
        }
    }

    populateDayDropdowns();

    ['duration-end-day', 'duration-end-month'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', updateDurationPreview);
        }
    });

    // 2. Load existing playlist details and pre-fill form
    function loadPlaylistData() {
        showStatus('Loading playlist details...');
        firebase.database().ref('playlists/' + playlistId).once('value').then(function(snapshot) {
            if (!snapshot.exists()) {
                alert('Selected playlist was not found.');
                window.location.href = 'all-playlists.html';
                return;
            }

            currentPlaylistData = snapshot.val();
            var name = currentPlaylistData.name || '';
            var description = currentPlaylistData.description || '';
            var author = currentPlaylistData.author || '';
            var price = currentPlaylistData.price || '';
            var className = currentPlaylistData.class || currentPlaylistData.courseClass || '';
            var thumbnailUrl = currentPlaylistData.thumbnailUrl || '';

            document.getElementById('course-name').value = name;
            document.getElementById('course-description').value = description;
            if (document.getElementById('course-author')) {
                document.getElementById('course-author').value = author;
            }
            document.getElementById('course-price').value = price;

            if (currentPlaylistData.durationEndDay && document.getElementById('duration-end-day')) {
                document.getElementById('duration-end-day').value = currentPlaylistData.durationEndDay;
            }
            if (currentPlaylistData.durationEndMonth && document.getElementById('duration-end-month')) {
                document.getElementById('duration-end-month').value = currentPlaylistData.durationEndMonth;
            }
            updateDurationPreview();

            if (thumbnailUrl) {
                thumbnailPreview.src = thumbnailUrl;
                thumbnailPreview.classList.remove('hidden');
            }

            // Load preferences and pre-select current class
            loadPreferences(className);
            showStatus('Editing playlist "' + name + '". Modify any fields below to update.');
        }).catch(function(error) {
            console.error('Load playlist error:', error);
            showStatus('Failed to load playlist data. Please try again.');
        });
    }

    // Thumbnail input change listener
    thumbnailUpload.addEventListener('change', function() {
        var file = thumbnailUpload.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(event) {
                thumbnailPreview.src = event.target.result;
                thumbnailPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else if (currentPlaylistData && currentPlaylistData.thumbnailUrl) {
            thumbnailPreview.src = currentPlaylistData.thumbnailUrl;
            thumbnailPreview.classList.remove('hidden');
        } else {
            thumbnailPreview.src = '';
            thumbnailPreview.classList.add('hidden');
        }
    });

    // Form submit listener
    playlistForm.addEventListener('submit', function(e) {
        e.preventDefault();

        var courseName = document.getElementById('course-name').value.trim();
        var courseDescription = document.getElementById('course-description').value.trim();
        var courseAuthor = document.getElementById('course-author') ? document.getElementById('course-author').value.trim() : '';
        var coursePrice = document.getElementById('course-price').value.trim();
        var courseClass = document.getElementById('course-class').value.trim();
        var thumbnailFile = thumbnailUpload.files[0];

        var durationEndDay = document.getElementById('duration-end-day') ? document.getElementById('duration-end-day').value : '';
        var durationEndMonth = document.getElementById('duration-end-month') ? document.getElementById('duration-end-month').value : '';

        var courseDuration = '';
        if (durationEndDay && durationEndMonth) {
            courseDuration = 'Valid until ' + durationEndDay + ' ' + durationEndMonth;
        }

        if (!courseName || !courseDescription || !coursePrice || !courseClass) {
            alert('Please fill in all required fields (Name, Description, Price, and Class).');
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Updating...';
        }

        showStatus('Updating playlist details...');

        var updates = {
            name: courseName,
            description: courseDescription,
            author: courseAuthor,
            price: coursePrice,
            class: courseClass,
            durationEndDay: durationEndDay,
            durationEndMonth: durationEndMonth,
            courseDuration: courseDuration,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };

        function updateDatabase(updatedPlaylistData) {
            firebase.database().ref('playlists/' + playlistId).update(updatedPlaylistData).then(function() {
                showStatus('Playlist updated successfully! Redirecting back to playlist dashboard...');
                setTimeout(function() {
                    window.location.href = 'playlist_dashboard.html?playlistId=' + encodeURIComponent(playlistId) + '&playlistName=' + encodeURIComponent(courseName);
                }, 1000);
            }).catch(function(error) {
                console.error('Update playlist error:', error);
                showStatus('Failed to update playlist. Check console for details.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Update Playlist';
                }
            });
        }

        if (thumbnailFile) {
            showStatus('Uploading new thumbnail image...');
            var storageRef = firebase.storage().ref();
            var thumbnailRef = storageRef.child('playlists/' + playlistId + '/thumbnail_' + Date.now() + '_' + thumbnailFile.name);
            var uploadTask = thumbnailRef.put(thumbnailFile);

            uploadTask.on('state_changed', function(snapshot) {
                var progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                showStatus('Uploading thumbnail: ' + progress + '%');
            }, function(error) {
                console.error('Thumbnail upload error:', error);
                showStatus('Thumbnail upload failed. Please try again.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Update Playlist';
                }
            }, function() {
                uploadTask.snapshot.ref.getDownloadURL().then(function(thumbnailUrl) {
                    updates.thumbnailUrl = thumbnailUrl;
                    updateDatabase(updates);
                }).catch(function(error) {
                    console.error('Get download URL error:', error);
                    showStatus('Failed to retrieve thumbnail URL.');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = 'Update Playlist';
                    }
                });
            });
        } else {
            // Keep existing thumbnail URL
            if (currentPlaylistData && currentPlaylistData.thumbnailUrl) {
                updates.thumbnailUrl = currentPlaylistData.thumbnailUrl;
            }
            updateDatabase(updates);
        }
    });

    loadPlaylistData();
});
