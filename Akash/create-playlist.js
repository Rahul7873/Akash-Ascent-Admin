document.addEventListener('DOMContentLoaded', function() {
    // Redirect to login.html if the user is not logged in
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var playlistForm = document.getElementById('playlist-form');
    var thumbnailUpload = document.getElementById('thumbnail-upload');
    var thumbnailPreview = document.getElementById('thumbnail-preview');
    var uploadStatus = document.getElementById('upload-status');
    var courseClassSelect = document.getElementById('course-class');

    // Dynamic dropdown options population from database preferences
    firebase.database().ref('preferences').once('value').then(function(snapshot) {
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
        defaultOpt.selected = true;
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
                    option.value = classes[classId].name;
                    option.textContent = classes[classId].name;
                    optgroup.appendChild(option);
                });

                courseClassSelect.appendChild(optgroup);
            }
        });
        
        if (courseClassSelect.children.length === 1) {
            courseClassSelect.innerHTML = '<option value="" disabled selected>No classes available. Please add them under Preferences.</option>';
        }
    }).catch(function(err) {
        console.error('Failed to load preferences:', err);
        if (courseClassSelect) {
            courseClassSelect.innerHTML = '<option value="" disabled selected>Failed to load classes</option>';
        }
    });

    thumbnailUpload.addEventListener('change', function() {
        var file = thumbnailUpload.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(event) {
                thumbnailPreview.src = event.target.result;
                thumbnailPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            thumbnailPreview.src = '';
            thumbnailPreview.classList.add('hidden');
        }
    });

    playlistForm.addEventListener('submit', function(e) {
        e.preventDefault();

        var courseName = document.getElementById('course-name').value.trim();
        var courseDescription = document.getElementById('course-description').value.trim();
        var courseAuthor = document.getElementById('course-author') ? document.getElementById('course-author').value.trim() : '';
        var coursePrice = document.getElementById('course-price').value.trim();
        var courseClass = document.getElementById('course-class').value.trim();
        var thumbnailFile = thumbnailUpload.files[0];

        if (!courseName || !courseDescription || !coursePrice || !courseClass || !thumbnailFile) {
            alert('Please fill all fields and select a thumbnail image.');
            return;
        }

        function sanitizeId(value) {
            return value.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }

        var playlistId = sanitizeId(courseName + '-' + courseClass);
        if (!playlistId) {
            playlistId = 'playlist-' + Date.now();
        }

        var storageRef = firebase.storage().ref();
        var thumbnailRef = storageRef.child('playlists/' + playlistId + '/thumbnail_' + thumbnailFile.name);

        var uploadTask = thumbnailRef.put(thumbnailFile);

        uploadTask.on('state_changed', function(snapshot) {
            var progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            uploadStatus.textContent = 'Uploading thumbnail: ' + progress + '%';
        }, function(error) {
            console.error('Thumbnail upload error:', error);
            uploadStatus.textContent = 'Upload failed. Please try again.';
        }, function() {
            uploadTask.snapshot.ref.getDownloadURL().then(function(thumbnailUrl) {
                uploadStatus.textContent = 'Saving playlist...';
                var playlistData = {
                playlistId: playlistId,
                name: courseName,
                description: courseDescription,
                author: courseAuthor,
                price: coursePrice,
                class: courseClass,
                thumbnailUrl: thumbnailUrl,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

                return firebase.database().ref('playlists/' + playlistId).set(playlistData);
            }).then(function() {
                uploadStatus.textContent = 'Playlist created successfully!';
                playlistForm.reset();
                thumbnailPreview.src = '';
                thumbnailPreview.classList.add('hidden');
            }).catch(function(error) {
                console.error('Create playlist error:', error);
                uploadStatus.textContent = 'Failed to create playlist. Check console for details.';
            });
        });
    });
});
