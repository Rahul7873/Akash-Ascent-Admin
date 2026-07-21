document.addEventListener('DOMContentLoaded', function() {
    // 1. Session validation
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var preferenceForm = document.getElementById('preference-form');
    var preferenceNameInput = document.getElementById('preference-name');
    var preferencesList = document.getElementById('preferences-list');
    var statusMessage = document.getElementById('status-message');
    var emptyState = document.getElementById('empty-state');
    var loadingPlaceholder = document.getElementById('loading-placeholder');

    function showStatus(text, isError) {
        if (statusMessage) {
            statusMessage.textContent = text;
            statusMessage.className = 'text-xs font-medium mt-2 ' + (isError ? 'text-red-500' : 'text-blue-500');
            setTimeout(function() {
                statusMessage.textContent = '';
            }, 3000);
        }
    }

    // 2. Form submission for creating new preference
    preferenceForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var name = preferenceNameInput.value.trim();
        if (!name) return;

        showStatus('Saving preference...');
        var prefRef = firebase.database().ref('preferences').push();
        var prefId = prefRef.key;

        prefRef.set({
            id: prefId,
            name: name,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        }).then(function() {
            showStatus('Preference category saved!');
            preferenceForm.reset();
        }).catch(function(error) {
            console.error('Save preference failed:', error);
            showStatus('Failed to save preference.', true);
        });
    });

    // 3. Real-time Firebase Database listener for preferences list
    firebase.database().ref('preferences').on('value', function(snapshot) {
        if (loadingPlaceholder) {
            loadingPlaceholder.classList.add('hidden');
        }

        // Clear existing items but preserve the form or headings
        preferencesList.innerHTML = '';

        if (!snapshot.exists()) {
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        var preferencesVal = snapshot.val();
        var prefKeys = Object.keys(preferencesVal || {});

        prefKeys.forEach(function(prefId) {
            var prefData = preferencesVal[prefId];
            var prefName = prefData.name;
            var classesObj = prefData.classes || {};
            var classKeys = Object.keys(classesObj);

            // Create Card Element
            var card = document.createElement('div');
            card.className = 'bg-white rounded-3xl border border-gray-200 p-6 card-shadow flex flex-col justify-between gap-6';

            // Top Header: Name + Delete Button
            var cardHeader = document.createElement('div');
            cardHeader.className = 'flex items-center justify-between w-full pb-3 border-b border-gray-100';
            cardHeader.innerHTML = `
                <h3 class="font-bold text-gray-800 text-lg truncate" title="${prefName}">${prefName}</h3>
                <button class="text-red-500 hover:text-red-700 transition text-xs font-semibold delete-pref-btn" data-id="${prefId}">
                    Delete Category
                </button>
            `;
            card.appendChild(cardHeader);

            // Middle section wrapper
            var contentWrap = document.createElement('div');
            contentWrap.className = 'flex-1 w-full space-y-4';

            // Classes Container
            var classesContainer = document.createElement('div');
            classesContainer.className = 'w-full space-y-2';
            classesContainer.innerHTML = `<h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Classes</h4>`;

            var classesList = document.createElement('div');
            classesList.className = 'flex flex-wrap gap-2';

            if (classKeys.length === 0) {
                classesList.innerHTML = `<span class="text-xs text-gray-400 italic py-1">No classes added yet.</span>`;
            } else {
                classKeys.forEach(function(classId) {
                    var className = classesObj[classId].name;
                    var pill = document.createElement('span');
                    pill.className = 'inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-700 rounded-full text-xs font-medium border border-gray-200';
                    pill.innerHTML = `
                        <span class="truncate max-w-[120px]" title="${className}">${className}</span>
                        <button class="text-gray-400 hover:text-red-500 font-bold delete-class-btn focus:outline-none ml-0.5" data-pref-id="${prefId}" data-class-id="${classId}">
                            &times;
                        </button>
                    `;
                    classesList.appendChild(pill);
                });
            }
            classesContainer.appendChild(classesList);
            contentWrap.appendChild(classesContainer);

            // Class input form controls
            var classFormWrap = document.createElement('div');
            classFormWrap.className = 'pt-4 border-t border-gray-100 flex gap-2 w-full';
            
            var classInput = document.createElement('input');
            classInput.type = 'text';
            classInput.placeholder = 'Add class (e.g. Class 10)';
            classInput.className = 'flex-1 p-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 class-input';
            
            var addClassBtn = document.createElement('button');
            addClassBtn.className = 'px-3 py-2 bg-blue-500 text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition shrink-0';
            addClassBtn.textContent = 'Add Class';

            // Add class trigger function
            var handleAddClass = function() {
                var className = classInput.value.trim();
                if (!className) return;

                firebase.database().ref('preferences/' + prefId + '/classes').push().set({
                    name: className,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                }).then(function() {
                    classInput.value = '';
                }).catch(function(err) {
                    console.error('Failed to add class:', err);
                });
            };

            // Trigger Add Class on Button Click or Enter Key
            addClassBtn.addEventListener('click', handleAddClass);
            classInput.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddClass();
                }
            });

            classFormWrap.appendChild(classInput);
            classFormWrap.appendChild(addClassBtn);
            contentWrap.appendChild(classFormWrap);

            card.appendChild(contentWrap);
            preferencesList.appendChild(card);
        });

        // Delegate delete event listeners
        attachDeleteListeners();
    }, function(error) {
        console.error('Read preferences failed:', error);
        if (loadingPlaceholder) {
            loadingPlaceholder.classList.add('hidden');
        }
        showStatus('Connection failed. Please refresh.', true);
    });

    // 4. Attach Delete Listeners for Category and Class
    function attachDeleteListeners() {
        // Delete Preference Category
        var deletePrefButtons = document.querySelectorAll('.delete-pref-btn');
        deletePrefButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = btn.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this preference category and all its classes?')) {
                    firebase.database().ref('preferences/' + id).remove().then(function() {
                        showStatus('Preference deleted.');
                    }).catch(function(err) {
                        console.error('Delete preference error:', err);
                    });
                }
            });
        });

        // Delete nested Class pill
        var deleteClassButtons = document.querySelectorAll('.delete-class-btn');
        deleteClassButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var prefId = btn.getAttribute('data-pref-id');
                var classId = btn.getAttribute('data-class-id');
                firebase.database().ref('preferences/' + prefId + '/classes/' + classId).remove().catch(function(err) {
                    console.error('Delete class error:', err);
                });
            });
        });
    }
});
