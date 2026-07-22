document.addEventListener('DOMContentLoaded', function () {
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var statusMessage = document.getElementById('status-message');
    var playlistTableBody = document.getElementById('playlist-table-body');
    var emptyState = document.getElementById('empty-state');
    var emptyAddVideo = document.getElementById('empty-add-video');
    var playlistMeta = document.getElementById('playlist-meta');
    var selectedPlaylistId = new URLSearchParams(window.location.search).get('playlistId');
    var selectedPlaylistName = new URLSearchParams(window.location.search).get('playlistName');

    var playlistTitle = document.getElementById('playlist-title');

    function showStatus(text) {
        statusMessage.textContent = text;
    }

    function formatDate(timestamp) {
        if (!timestamp) return '-';
        var date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getNumericSerial(video) {
        if (!video) return Infinity;
        var s = video.serial || video.serialNumber || video.sn || video.order;
        if (s === undefined || s === null || s === '') return Infinity;
        var num = parseFloat(s);
        if (!isNaN(num)) return num;
        var match = String(s).match(/\d+/);
        if (match) return parseInt(match[0], 10);
        return Infinity;
    }

    function sortVideosBySerial(videosObj) {
        var videoKeys = Object.keys(videosObj || {});
        videoKeys.sort(function (a, b) {
            var videoA = videosObj[a] || {};
            var videoB = videosObj[b] || {};
            var numA = getNumericSerial(videoA);
            var numB = getNumericSerial(videoB);

            if (numA !== numB) {
                return numA - numB;
            }

            var timeA = videoA.createdAt || videoA.timestamp || 0;
            var timeB = videoB.createdAt || videoB.timestamp || 0;
            if (timeA !== timeB) {
                return timeA - timeB;
            }

            return a.localeCompare(b);
        });
        return videoKeys;
    }

    function loadPlaylists() {
        playlistTableBody.innerHTML = '';
        var mahapackContainer = document.getElementById('mahapack-sections-container');
        var standardContainer = document.getElementById('standard-table-container');

        if (mahapackContainer) mahapackContainer.innerHTML = '';

        if (!selectedPlaylistId) {
            showStatus('No playlist selected. Open a playlist from All Playlists.');
            emptyState.classList.remove('hidden');
            return;
        }

        showStatus('Loading selected playlist...');
        firebase.database().ref('playlists').once('value').then(function (snapshot) {
            if (!snapshot.exists()) {
                emptyState.classList.remove('hidden');
                showStatus('Playlists database is empty.');
                return;
            }

            var allPlaylists = snapshot.val();
            var playlist = allPlaylists[selectedPlaylistId];

            if (!playlist) {
                emptyState.classList.remove('hidden');
                showStatus('Selected playlist was not found.');
                return;
            }

            emptyState.classList.add('hidden');
            var displayName = decodeURIComponent(selectedPlaylistName || playlist.name || 'Selected Playlist');
            if (playlistTitle) {
                playlistTitle.textContent = displayName;
            }

            var isMahapack = playlist.isMahapack === true || playlist.type === 'mahapack';

            if (isMahapack) {
                // MAHAPACK SECTION-WISE RENDERING
                if (standardContainer) standardContainer.classList.add('hidden');
                if (mahapackContainer) mahapackContainer.classList.remove('hidden');

                var includedIds = playlist.includedPlaylists || [];
                if (!Array.isArray(includedIds) && typeof includedIds === 'object') {
                    includedIds = Object.keys(includedIds).map(function (k) { return includedIds[k]; });
                }

                var durationStr = playlist.courseDuration ? (' · 📅 Duration: ' + playlist.courseDuration + ' (Every Year)') : '';
                if (playlistMeta) {
                    playlistMeta.textContent = '📦 MAHAPACK · Class: ' + (playlist.class || '-') + ' · Price: ₹' + (playlist.price || '-') + ' · Author: ' + (playlist.author || 'Akash Ascent') + ' · Included Playlists: ' + includedIds.length + durationStr;
                }

                if (includedIds.length === 0) {
                    if (emptyState) emptyState.classList.remove('hidden');
                    showStatus('This Mahapack does not contain any bundled playlists yet.');
                    return;
                }

                var totalVideos = 0;
                mahapackContainer.innerHTML = '';

                includedIds.forEach(function (incId) {
                    var incPlaylist = allPlaylists[incId];
                    if (!incPlaylist) return;

                    var sectionCard = document.createElement('div');
                    sectionCard.className = 'bg-white rounded-3xl border border-gray-200 card-shadow overflow-hidden p-6 space-y-4';

                    var incVideos = incPlaylist.videos || {};
                    var sortedIncVideoKeys = sortVideosBySerial(incVideos);
                    totalVideos += sortedIncVideoKeys.length;

                    var sectionHeader = document.createElement('div');
                    sectionHeader.className = 'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100';
                    sectionHeader.innerHTML = ''
                        + '<div class="flex items-center gap-3">'
                        + '<img src="' + (incPlaylist.thumbnailUrl || 'logo.png') + '" alt="' + escapeHtml(incPlaylist.name) + '" class="w-14 h-14 object-cover rounded-2xl border border-gray-200 shrink-0" />'
                        + '<div>'
                        + '<h3 class="text-xl font-bold text-gray-900">📚 Section: ' + escapeHtml(incPlaylist.name) + '</h3>'
                        + '<p class="text-xs text-gray-500 font-medium">Author: ' + escapeHtml(incPlaylist.author || 'Akash Ascent Team') + ' · Price: ₹' + escapeHtml(incPlaylist.price || '-') + ' · ' + sortedIncVideoKeys.length + ' video(s)</p>'
                        + '</div>'
                        + '</div>'
                        + '<a href="playlist_dashboard.html?playlistId=' + encodeURIComponent(incId) + '&playlistName=' + encodeURIComponent(incPlaylist.name || '') + '" class="px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-bold hover:bg-blue-100 transition self-start sm:self-center shrink-0">Open Section Dashboard →</a>';

                    sectionCard.appendChild(sectionHeader);

                    var tableWrapper = document.createElement('div');
                    tableWrapper.className = 'overflow-x-auto';

                    if (sortedIncVideoKeys.length === 0) {
                        tableWrapper.innerHTML = '<div class="py-8 text-center text-sm text-gray-500 italic">No videos added to this section playlist yet.</div>';
                    } else {
                        var table = document.createElement('table');
                        table.className = 'min-w-full divide-y divide-gray-200';
                        table.innerHTML = '<thead class="bg-gray-50"><tr>'
                            + '<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Thumbnail</th>'
                            + '<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Video Title</th>'
                            + '<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>'
                            + '<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Serial</th>'
                            + '<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Author</th>'
                            + '<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Uploaded</th>'
                            + '<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Video</th>'
                            + '<th class="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>'
                            + '</tr></thead>';

                        var tbody = document.createElement('tbody');
                        tbody.className = 'bg-white divide-y divide-gray-200';

                        sortedIncVideoKeys.forEach(function (vId) {
                            var vData = incVideos[vId];
                            tbody.appendChild(createVideoRow(vId, vData, incId));
                        });

                        table.appendChild(tbody);
                        tableWrapper.appendChild(table);
                    }

                    sectionCard.appendChild(tableWrapper);
                    mahapackContainer.appendChild(sectionCard);
                });

                showStatus('Loaded Mahapack "' + displayName + '" containing ' + includedIds.length + ' section(s) and ' + totalVideos + ' video(s).');

            } else {
                // STANDARD PLAYLIST RENDERING
                if (mahapackContainer) mahapackContainer.classList.add('hidden');
                if (standardContainer) standardContainer.classList.remove('hidden');

                var durationStr = playlist.courseDuration ? (' · 📅 Duration: ' + playlist.courseDuration + ' (Every Year)') : '';
                if (playlistMeta) {
                    playlistMeta.textContent = 'Author: ' + (playlist.author || 'Akash Ascent Team') + ' · Class: ' + (playlist.class || playlist.courseClass || '-') + ' · Price: ₹' + (playlist.price || playlist.cost || '-') + durationStr + ' · Playlist ID: ' + selectedPlaylistId;
                }

                var videos = playlist.videos || {};
                playlistTableBody.innerHTML = '';
                var sortedVideoKeys = sortVideosBySerial(videos);
                var hasVideos = sortedVideoKeys.length > 0;

                sortedVideoKeys.forEach(function (videoId) {
                    var video = videos[videoId];
                    playlistTableBody.appendChild(createVideoRow(videoId, video, selectedPlaylistId));
                });

                if (!hasVideos) {
                    if (emptyAddVideo) {
                        emptyAddVideo.href = 'add-video.html?playlistId=' + encodeURIComponent(selectedPlaylistId) + '&playlistName=' + encodeURIComponent(displayName);
                    }
                    emptyState.classList.remove('hidden');
                }

                showStatus('Showing playlist "' + displayName + '" with ' + (hasVideos ? sortedVideoKeys.length : 0) + ' video(s) (Sorted by Serial Number).');
            }
        }).catch(function (error) {
            console.error('Fetch playlist failed:', error);
            showStatus('Failed to load the selected playlist. Please refresh the page.');
        });
    }

    function createVideoRow(videoId, video, targetPlaylistId) {
        var tr = document.createElement('tr');
        var isDemo = video.isDemo === true;
        var rawTitle = escapeHtml(video.title || 'Untitled Video');
        var titleHtml = isDemo
            ? rawTitle + ' <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 ml-1">🎬 DEMO</span>'
            : rawTitle;

        var description = escapeHtml(video.description || 'No description');
        var serial = escapeHtml(video.serial || '-');
        var author = escapeHtml(video.author || '-');
        var createdAt = formatDate(video.createdAt || video.timestamp);
        var thumbnailUrl = escapeHtml(video.thumbnailUrl || '');
        var videoUrl = escapeHtml(video.videoUrl || '#');
        var currentPId = targetPlaylistId || selectedPlaylistId;

        tr.innerHTML = '' +
            '<td class="px-6 py-5 whitespace-nowrap align-top">' +
            (thumbnailUrl ? '<img src="' + thumbnailUrl + '" alt="Thumbnail" class="h-24 w-40 object-cover rounded-lg border border-gray-200" />' : '<div class="h-24 w-40 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-xs text-gray-500">No thumbnail</div>') +
            '</td>' +
            '<td class="px-6 py-5 whitespace-normal max-w-xs font-medium text-gray-900">' + titleHtml + '</td>' +
            '<td class="px-6 py-5 whitespace-normal text-sm text-gray-600 max-w-xl">' + description + '</td>' +
            '<td class="px-6 py-5 whitespace-nowrap text-sm text-gray-700">' + serial + '</td>' +
            '<td class="px-6 py-5 whitespace-nowrap text-sm text-gray-700">' + author + '</td>' +
            '<td class="px-6 py-5 whitespace-nowrap text-sm text-gray-700">' + createdAt + '</td>' +
            '<td class="px-6 py-5 whitespace-nowrap text-sm font-medium">' +
            (videoUrl && videoUrl !== '#' ? '<a href="' + videoUrl + '" target="_blank" class="text-blue-600 hover:text-blue-800">Watch</a>' : '<span class="text-gray-500">Missing</span>') +
            '</td>' +
            '<td class="px-6 py-5 whitespace-nowrap text-right space-x-2">' +
            '<button type="button" class="inline-flex items-center px-3 py-2 bg-yellow-100 text-yellow-800 rounded-md text-xs font-semibold hover:bg-yellow-200" onclick="editVideo(\'' + encodeURIComponent(videoId) + '\', \'' + encodeURIComponent(currentPId) + '\')">Edit</button>' +
            '<button type="button" class="inline-flex items-center px-3 py-2 bg-red-100 text-red-800 rounded-md text-xs font-semibold hover:bg-red-200" onclick="deleteVideo(\'' + encodeURIComponent(videoId) + '\', \'' + encodeURIComponent(currentPId) + '\')">Delete</button>' +
            '</td>';
        return tr;
    }

    function deleteStorageFolder(path) {
        var ref = firebase.storage().ref(path);
        return ref.listAll().then(function (listResult) {
            var deletePromises = listResult.items.map(function (itemRef) {
                return itemRef.delete();
            });
            var prefixPromises = listResult.prefixes.map(function (prefixRef) {
                return deleteStorageFolder(prefixRef.fullPath);
            });
            return Promise.all(deletePromises.concat(prefixPromises));
        }).catch(function (error) {
            // If the folder doesn't exist or storage delete fails, ignore it and continue.
            console.warn('Storage delete warning:', error);
            return Promise.resolve();
        });
    }

    function handleAddVideo(playlistId, playlistName) {
        window.location.href = 'add-video.html?playlistId=' + encodeURIComponent(playlistId) + '&playlistName=' + encodeURIComponent(playlistName);
    }

    function handleEditPlaylist(playlistId, playlistName) {
        window.location.href = 'edit-playlist.html?playlistId=' + encodeURIComponent(playlistId) + '&playlistName=' + encodeURIComponent(playlistName);
    }

    function handleDeletePlaylist(playlistId) {
        if (!confirm('Delete this playlist permanently? This cannot be undone.')) {
            return;
        }

        showStatus('Deleting playlist...');
        firebase.database().ref('playlists/' + playlistId).remove().then(function () {
            return deleteStorageFolder('playlists/' + playlistId);
        }).then(function () {
            window.location.href = 'all-playlists.html?message=' + encodeURIComponent('Playlist deleted successfully.');
        }).catch(function (error) {
            console.error('Delete playlist failed:', error);
            showStatus('Failed to delete playlist. Please try again.');
        });
    }

    window.editVideo = function (videoId, targetPlaylistId) {
        var decodedVideoId = decodeURIComponent(videoId);
        var pId = targetPlaylistId ? decodeURIComponent(targetPlaylistId) : selectedPlaylistId;
        window.location.href = 'edit-video.html?playlistId=' + encodeURIComponent(pId) + '&playlistName=' + encodeURIComponent(selectedPlaylistName || '') + '&videoId=' + encodeURIComponent(decodedVideoId);
    };

    window.deleteVideo = function (videoId, targetPlaylistId) {
        var decodedVideoId = decodeURIComponent(videoId);
        var pId = targetPlaylistId ? decodeURIComponent(targetPlaylistId) : selectedPlaylistId;
        if (!confirm('Delete this video permanently? This cannot be undone.')) {
            return;
        }
        showStatus('Deleting video...');
        var videoRef = firebase.database().ref('playlists/' + pId + '/videos/' + decodedVideoId);
        videoRef.once('value').then(function (snapshot) {
            if (!snapshot.exists()) {
                throw new Error('Video not found.');
            }
            var video = snapshot.val();
            var deletePromises = [];
            if (video.videoPath) {
                deletePromises.push(firebase.storage().ref(video.videoPath).delete().catch(function () { return null; }));
            } else if (video.videoUrl) {
                deletePromises.push(firebase.storage().refFromURL(video.videoUrl).delete().catch(function () { return null; }));
            }
            if (video.thumbnailPath) {
                deletePromises.push(firebase.storage().ref(video.thumbnailPath).delete().catch(function () { return null; }));
            } else if (video.thumbnailUrl) {
                deletePromises.push(firebase.storage().refFromURL(video.thumbnailUrl).delete().catch(function () { return null; }));
            }
            return Promise.all(deletePromises).then(function () {
                return videoRef.remove();
            });
        }).then(function () {
            showStatus('Video deleted successfully.');
            loadPlaylists();
        }).catch(function (error) {
            console.error('Delete video failed:', error);
            showStatus('Failed to delete video. Please try again.');
        });
    };

    var pageEditPlaylistBtn = document.getElementById('page-edit-playlist-btn');
    var pageAddVideoBtn = document.getElementById('page-add-video-btn');
    var pageDeletePlaylistBtn = document.getElementById('page-delete-playlist-btn');

    if (pageEditPlaylistBtn) {
        pageEditPlaylistBtn.addEventListener('click', function () {
            handleEditPlaylist(selectedPlaylistId, selectedPlaylistName || '');
        });
    }

    if (pageAddVideoBtn) {
        pageAddVideoBtn.addEventListener('click', function () {
            handleAddVideo(selectedPlaylistId, selectedPlaylistName || '');
        });
    }

    if (pageDeletePlaylistBtn) {
        pageDeletePlaylistBtn.addEventListener('click', function () {
            handleDeletePlaylist(selectedPlaylistId);
        });
    }

    loadPlaylists();
});
