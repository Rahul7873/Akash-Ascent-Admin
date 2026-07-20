document.addEventListener('DOMContentLoaded', function() {
    // Session Guard
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var mahapackForm = document.getElementById('mahapack-form');
    var thumbnailUpload = document.getElementById('thumbnail-upload');
    var thumbnailPreview = document.getElementById('thumbnail-preview');
    var courseClassSelect = document.getElementById('course-class');
    var playlistsContainer = document.getElementById('playlists-checkbox-container');
    var selectedCountBadge = document.getElementById('selected-count');
    var uploadStatus = document.getElementById('upload-status');
    var submitBtn = document.getElementById('submit-btn');

    var loadedPlaylists = {};

    function showStatus(text) {
        if (uploadStatus) {
            uploadStatus.textContent = text;
        }
    }

    function updateSelectedCount() {
        var checkedBoxes = playlistsContainer.querySelectorAll('.playlist-checkbox:checked');
        if (selectedCountBadge) {
            selectedCountBadge.textContent = checkedBoxes.length + ' selected';
        }
    }

    // 1. Populate Preference Classes Dropdown
    firebase.database().ref('preferences').once('value').then(function(snapshot) {
        if (!courseClassSelect) return;
        courseClassSelect.innerHTML = '';

        if (!snapshot.exists()) {
            courseClassSelect.innerHTML = '<option value="" disabled selected>No preference categories found. Add preferences first.</option>';
            return;
        }

        var defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.disabled = true;
        defaultOpt.selected = true;
        defaultOpt.textContent = 'Select a preference class';
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
    }).catch(function(error) {
        console.error('Failed to load preferences:', error);
        if (courseClassSelect) {
            courseClassSelect.innerHTML = '<option value="" disabled selected>Failed to load classes</option>';
        }
    });

    // 2. Fetch playlists when a Preference Class is selected
    courseClassSelect.addEventListener('change', function() {
        var selectedClass = courseClassSelect.value;
        if (!selectedClass) return;

        playlistsContainer.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-gray-500 text-sm"><span>Loading playlists for "' + selectedClass + '"...</span></div>';
        
        firebase.database().ref('playlists').once('value').then(function(snapshot) {
            playlistsContainer.innerHTML = '';
            if (!snapshot.exists()) {
                playlistsContainer.innerHTML = '<div class="p-8 text-center text-gray-500 text-sm">No playlists created yet. Create a playlist under this class first.</div>';
                updateSelectedCount();
                return;
            }

            var allPlaylistsObj = snapshot.val();
            loadedPlaylists = {};
            var matchingPlaylists = [];

            Object.keys(allPlaylistsObj).forEach(function(key) {
                var p = allPlaylistsObj[key];
                // Include playlists matching the selected class (excluding other mahapacks)
                if (p.class === selectedClass && !p.isMahapack && p.type !== 'mahapack') {
                    matchingPlaylists.push({ id: key, data: p });
                    loadedPlaylists[key] = p;
                }
            });

            if (matchingPlaylists.length === 0) {
                playlistsContainer.innerHTML = '<div class="p-8 text-center text-gray-500 text-sm font-medium">No individual playlists found for class "' + selectedClass + '". Please create playlists under this class first.</div>';
                updateSelectedCount();
                return;
            }

            matchingPlaylists.forEach(function(item) {
                var pId = item.id;
                var p = item.data;
                var videoCount = p.videos ? Object.keys(p.videos).length : 0;
                var thumb = p.thumbnailUrl || 'logo.png';

                var row = document.createElement('label');
                row.className = 'flex items-center gap-4 bg-white p-3.5 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-sm transition cursor-pointer group';
                row.innerHTML = ''
                    + '<input type="checkbox" value="' + pId + '" class="playlist-checkbox w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer shrink-0" />'
                    + '<img src="' + thumb + '" alt="' + (p.name || '') + '" class="w-16 h-12 object-cover rounded-lg border border-gray-200 shrink-0" />'
                    + '<div class="min-w-0 flex-1">'
                    + '<h4 class="text-sm font-bold text-gray-900 group-hover:text-purple-700 truncate">' + (p.name || 'Untitled') + '</h4>'
                    + '<p class="text-xs text-gray-500 truncate mt-0.5">' + (p.description || 'No description') + '</p>'
                    + '</div>'
                    + '<div class="text-right shrink-0">'
                    + '<span class="block text-xs font-semibold text-gray-900">₹' + (p.price || '-') + '</span>'
                    + '<span class="block text-[10px] text-gray-500">' + videoCount + ' video' + (videoCount === 1 ? '' : 's') + '</span>'
                    + '</div>';

                playlistsContainer.appendChild(row);
            });

            // Attach checkbox change handlers
            var checkboxes = playlistsContainer.querySelectorAll('.playlist-checkbox');
            checkboxes.forEach(function(cb) {
                cb.addEventListener('change', updateSelectedCount);
            });

            updateSelectedCount();
        }).catch(function(error) {
            console.error('Failed to load playlists:', error);
            playlistsContainer.innerHTML = '<div class="p-8 text-center text-red-500 text-sm">Failed to load playlists. Please try again.</div>';
        });
    });

    // 3. Thumbnail Preview Listener
    thumbnailUpload.addEventListener('change', function() {
        var file = thumbnailUpload.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                thumbnailPreview.src = e.target.result;
                thumbnailPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            thumbnailPreview.src = '';
            thumbnailPreview.classList.add('hidden');
        }
    });

    // 4. Form Submit Listener
    mahapackForm.addEventListener('submit', function(e) {
        e.preventDefault();

        var title = document.getElementById('mahapack-title').value.trim();
        var author = document.getElementById('mahapack-author').value.trim();
        var price = document.getElementById('mahapack-price').value.trim();
        var description = document.getElementById('mahapack-description').value.trim();
        var selectedClass = courseClassSelect.value;
        var thumbnailFile = thumbnailUpload.files[0];

        var checkedCheckboxes = playlistsContainer.querySelectorAll('.playlist-checkbox:checked');
        var selectedPlaylistIds = [];
        checkedCheckboxes.forEach(function(cb) {
            selectedPlaylistIds.push(cb.value);
        });

        if (!title || !author || !price || !description || !selectedClass) {
            alert('Please fill in all required fields (Title, Author, Price, Description, and Class).');
            return;
        }

        if (!thumbnailFile) {
            alert('Please upload a thumbnail image for this Mahapack.');
            return;
        }

        if (selectedPlaylistIds.length === 0) {
            alert('Please select at least one playlist to include in this Mahapack.');
            return;
        }

        function sanitizeId(str) {
            return str.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }

        var mahapackId = 'mahapack-' + sanitizeId(title + '-' + selectedClass);

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Creating Mahapack...';
        }

        showStatus('Uploading thumbnail photo...');

        var storageRef = firebase.storage().ref();
        var thumbRef = storageRef.child('playlists/' + mahapackId + '/thumbnail_' + Date.now() + '_' + thumbnailFile.name);
        var uploadTask = thumbRef.put(thumbnailFile);

        uploadTask.on('state_changed', function(snapshot) {
            var progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            showStatus('Uploading thumbnail: ' + progress + '%');
        }, function(error) {
            console.error('Thumbnail upload error:', error);
            showStatus('Thumbnail upload failed. Please try again.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Create Mahapack';
            }
        }, function() {
            uploadTask.snapshot.ref.getDownloadURL().then(function(thumbnailUrl) {
                showStatus('Saving Mahapack details...');
                var mahapackData = {
                    playlistId: mahapackId,
                    name: title,
                    title: title,
                    author: author,
                    description: description,
                    price: price,
                    class: selectedClass,
                    thumbnailUrl: thumbnailUrl,
                    isMahapack: true,
                    type: 'mahapack',
                    includedPlaylists: selectedPlaylistIds,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                };

                return firebase.database().ref('playlists/' + mahapackId).set(mahapackData);
            }).then(function() {
                showStatus('Mahapack created successfully! Redirecting to All Playlists...');
                setTimeout(function() {
                    window.location.href = 'all-playlists.html?message=' + encodeURIComponent('Mahapack "' + title + '" created successfully!');
                }, 1000);
            }).catch(function(error) {
                console.error('Mahapack save error:', error);
                showStatus('Failed to create Mahapack. Check console for details.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Create Mahapack';
                }
            });
        });
    });
});
