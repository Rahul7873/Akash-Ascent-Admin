document.addEventListener('DOMContentLoaded', function() {
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var statusMessage = document.getElementById('status-message');
    var usersTableHead = document.getElementById('users-table-head');
    var usersTableBody = document.getElementById('users-table-body');
    var emptyState = document.getElementById('empty-state');

    function showStatus(text) {
        if (statusMessage) {
            statusMessage.textContent = text;
        }
    }

    function labelizeField(field) {
        return field
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, function(char) { return char.toUpperCase(); })
            .trim();
    }

    function buildHeader(columns) {
        usersTableHead.innerHTML = '';
        columns.forEach(function(column) {
            var th = document.createElement('th');
            th.className = 'px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider';
            th.textContent = column.label;
            usersTableHead.appendChild(th);
        });
    }

    function createRow(userKey, userData, columns) {
        var tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 hover:bg-gray-50';

        columns.forEach(function(column) {
            var td = document.createElement('td');
            td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-700';
            var value = column.key === 'userId' ? userKey : userData[column.key];
            if (value === undefined || value === null || value === '') {
                value = '-';
            }
            td.textContent = value;
            tr.appendChild(td);
        });

        return tr;
    }

    function isObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function flattenUserData(userData) {
        var flattened = {};
        Object.keys(userData || {}).forEach(function(key) {
            var value = userData[key];
            if (isObject(value)) {
                flattened[key] = JSON.stringify(value);
            } else {
                flattened[key] = value;
            }
        });
        return flattened;
    }

    showStatus('Loading users...');
    firebase.database().ref('users').once('value').then(function(snapshot) {
        usersTableBody.innerHTML = '';
        if (!snapshot.exists()) {
            emptyState.classList.remove('hidden');
            showStatus('No users available yet.');
            return;
        }

        var users = snapshot.val();
        var userKeys = Object.keys(users || {});
        if (userKeys.length === 0) {
            emptyState.classList.remove('hidden');
            showStatus('No users available yet.');
            return;
        }

        var columnMap = new Map();
        columnMap.set('userId', { key: 'userId', label: 'User ID' });
        var rows = [];

        userKeys.forEach(function(key) {
            var rawData = users[key] || {};
            var userData = flattenUserData(rawData);
            rows.push({ key: key, data: userData });
            Object.keys(userData).forEach(function(field) {
                if (!columnMap.has(field)) {
                    columnMap.set(field, {
                        key: field,
                        label: labelizeField(field)
                    });
                }
            });
        });

        // Ensure common fields appear first
        var preferredFields = ['userId', 'firstName', 'lastName', 'username', 'email', 'phoneNumber', 'phone', 'listName', 'login', 'createdAt'];
        var columns = [];
        preferredFields.forEach(function(field) {
            if (columnMap.has(field)) {
                columns.push(columnMap.get(field));
                columnMap.delete(field);
            }
        });

        columnMap.forEach(function(value) {
            columns.push(value);
        });

        buildHeader(columns);

        rows.forEach(function(row) {
            usersTableBody.appendChild(createRow(row.key, row.data, columns));
        });

        emptyState.classList.add('hidden');
        showStatus('Loaded ' + rows.length + ' user' + (rows.length === 1 ? '' : 's') + '.');
    }).catch(function(error) {
        console.error('Fetch users failed:', error);
        showStatus('Failed to load users. Please refresh the page.');
    });
});
