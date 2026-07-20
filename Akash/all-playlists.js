document.addEventListener('DOMContentLoaded', function() {
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var playlistsGrid = document.getElementById('playlists-grid');
    var emptyState = document.getElementById('empty-state');
    var statusMessage = document.getElementById('status-message');
    var preferenceTabsContainer = document.getElementById('preference-tabs');

    var allPlaylists = [];
    var categories = ['All'];
    var activeCategory = 'All';

    function showStatus(text) {
        statusMessage.textContent = text;
    }

    function showMessageFromQuery() {
        var params = new URLSearchParams(window.location.search);
        var message = params.get('message');
        if (message) {
            showStatus(decodeURIComponent(message));
        }
    }

    function createPlaylistCard(playlistId, playlist) {
        var card = document.createElement('a');
        var playlistName = encodeURIComponent(playlist.name || '');
        card.href = 'playlist_dashboard.html?playlistId=' + encodeURIComponent(playlistId) + '&playlistName=' + playlistName;
        card.className = 'group block bg-white rounded-3xl border border-gray-200 card-shadow overflow-hidden hover:shadow-xl transition cursor-pointer relative';
        
        var isMahapack = playlist.isMahapack === true || playlist.type === 'mahapack';
        var badgeHtml = isMahapack 
            ? '<span class="absolute top-3 right-3 bg-purple-600 text-white font-bold px-3 py-1 rounded-full text-[10px] tracking-wider shadow-md uppercase">📦 MAHAPACK</span>'
            : '';

        var includedCount = 0;
        if (isMahapack && playlist.includedPlaylists) {
            includedCount = Array.isArray(playlist.includedPlaylists) ? playlist.includedPlaylists.length : Object.keys(playlist.includedPlaylists).length;
        }

        var mahapackBadge = isMahapack && includedCount > 0
            ? '<span class="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-semibold">Included: ' + includedCount + ' Playlists</span>'
            : '';

        var authorName = playlist.author || 'Akash Ascent Team';
        var authorHtml = '<p class="mt-2 text-sm text-gray-700 font-semibold flex items-center gap-1"><span class="text-xs text-gray-500 font-normal">Author:</span> ' + escapeHtml(authorName) + '</p>';

        card.innerHTML = '<div class="relative h-44 bg-gray-100 overflow-hidden">'
            + '<img src="' + (playlist.thumbnailUrl || 'logo.png') + '" alt="' + escapeHtml(playlist.name) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />'
            + badgeHtml
            + '</div>'
            + '<div class="p-5">'
            + '<h2 class="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors">' + escapeHtml(playlist.name) + '</h2>'
            + authorHtml
            + '<div class="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">'
            + '<span class="px-3 py-1 bg-gray-100 rounded-full">Class: ' + escapeHtml(playlist.class) + '</span>'
            + '<span class="px-3 py-1 bg-gray-100 rounded-full">Price: ₹' + escapeHtml(playlist.price || '-') + '</span>'
            + mahapackBadge
            + '</div>'
            + '</div>';
        return card;
    }

    function escapeHtml(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function renderPlaylists() {
        playlistsGrid.innerHTML = '';
        var filtered = allPlaylists;
        if (activeCategory !== 'All') {
            filtered = allPlaylists.filter(function(p) {
                return p.category === activeCategory;
            });
        }

        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
            showStatus('No playlists found under "' + activeCategory + '".');
        } else {
            emptyState.classList.add('hidden');
            filtered.forEach(function(p) {
                playlistsGrid.appendChild(createPlaylistCard(p.key, p.data));
            });
            showStatus('Showing ' + filtered.length + ' playlist' + (filtered.length === 1 ? '' : 's') + ' under "' + activeCategory + '".');
        }
    }

    function renderTabs() {
        if (!preferenceTabsContainer) return;
        preferenceTabsContainer.innerHTML = '';

        categories.forEach(function(cat) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'px-4 py-2 text-xs font-semibold rounded-full border transition cursor-pointer ';
            
            if (cat === activeCategory) {
                btn.className += 'bg-blue-600 text-white border-blue-600 shadow-sm';
            } else {
                btn.className += 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50';
            }
            
            btn.textContent = cat;
            btn.addEventListener('click', function() {
                activeCategory = cat;
                renderTabs();
                renderPlaylists();
            });
            preferenceTabsContainer.appendChild(btn);
        });
    }

    showMessageFromQuery();
    showStatus('Loading playlists and preferences...');

    // Fetch concurrent data
    Promise.all([
        firebase.database().ref('playlists').once('value'),
        firebase.database().ref('preferences').once('value')
    ]).then(function(results) {
        var playlistSnapshot = results[0];
        var prefSnapshot = results[1];

        // 1. Build map of class name -> preference category name
        var classToPreferenceMap = {};
        if (prefSnapshot.exists()) {
            var preferencesData = prefSnapshot.val();
            Object.keys(preferencesData).forEach(function(prefId) {
                var pref = preferencesData[prefId];
                var classesObj = pref.classes || {};
                Object.keys(classesObj).forEach(function(classId) {
                    var className = classesObj[classId].name;
                    classToPreferenceMap[className] = pref.name;
                });
            });
        }

        // 2. Load playlists
        allPlaylists = [];
        if (playlistSnapshot.exists()) {
            var playlistsData = playlistSnapshot.val();
            Object.keys(playlistsData).forEach(function(key) {
                var p = playlistsData[key];
                var category = classToPreferenceMap[p.class] || 'Others';
                allPlaylists.push({
                    key: key,
                    data: p,
                    category: category
                });
            });
        }

        // 3. Build unique active categories list for tabs
        categories = ['All'];
        var uniqueCategories = new Set();
        allPlaylists.forEach(function(p) {
            uniqueCategories.add(p.category);
        });

        // Add categories to list, ensuring "Others" is at the end
        uniqueCategories.forEach(function(cat) {
            if (cat !== 'Others') {
                categories.push(cat);
            }
        });
        if (uniqueCategories.has('Others')) {
            categories.push('Others');
        }

        // 4. Render
        renderTabs();
        renderPlaylists();

    }).catch(function(error) {
        console.error('Fetch failed:', error);
        showStatus('Failed to load playlists. Please refresh the page.');
    });
});
