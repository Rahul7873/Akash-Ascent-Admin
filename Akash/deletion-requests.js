document.addEventListener('DOMContentLoaded', function() {
    // Auth Check
    if (!sessionStorage.getItem('loggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    var statusMessage = document.getElementById('status-message');
    var requestsTableBody = document.getElementById('requests-table-body');
    var emptyState = document.getElementById('empty-state');
    var refreshBtn = document.getElementById('refresh-btn');

    var currentFilter = 'all';
    var allRequests = [];

    // Filter Buttons Setup
    var filterButtons = {
        'all': document.getElementById('filter-all'),
        'pending': document.getElementById('filter-pending'),
        'processed': document.getElementById('filter-processed'),
        'rejected': document.getElementById('filter-rejected')
    };

    Object.keys(filterButtons).forEach(function(key) {
        var btn = filterButtons[key];
        if (btn) {
            btn.addEventListener('click', function() {
                currentFilter = key;
                updateFilterUI();
                renderTable();
            });
        }
    });

    function updateFilterUI() {
        Object.keys(filterButtons).forEach(function(key) {
            var btn = filterButtons[key];
            if (!btn) return;
            if (key === currentFilter) {
                btn.className = 'filter-tab px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white shadow-sm';
            } else {
                btn.className = 'filter-tab px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-100 border border-gray-200';
            }
        });
    }

    function showStatus(text) {
        if (statusMessage) {
            statusMessage.textContent = text;
        }
    }

    function formatDate(req) {
        if (req.submittedAtString) return req.submittedAtString;
        if (req.createdAt) {
            return new Date(req.createdAt).toLocaleString();
        }
        return 'N/A';
    }

    function renderStatusBadge(status) {
        var st = (status || 'pending').toLowerCase();
        if (st === 'approved_and_deleted' || st === 'processed' || st === 'completed') {
            return '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Approved & Deleted</span>';
        } else if (st === 'rejected') {
            return '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Rejected</span>';
        } else {
            return '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending Approval</span>';
        }
    }

    function loadRequests() {
        showStatus('Loading requests...');
        requestsTableBody.innerHTML = '';
        emptyState.classList.add('hidden');

        firebase.database().ref('account_deletion_requests').once('value').then(function(snapshot) {
            allRequests = [];
            if (snapshot.exists()) {
                var data = snapshot.val();
                Object.keys(data).forEach(function(key) {
                    var req = data[key];
                    req.key = key;
                    allRequests.push(req);
                });
                // Sort newest first
                allRequests.sort(function(a, b) {
                    return (b.createdAt || 0) - (a.createdAt || 0);
                });
            }
            renderTable();
        }).catch(function(error) {
            console.error('Error fetching deletion requests:', error);
            showStatus('Failed to load requests.');
        });
    }

    function renderTable() {
        requestsTableBody.innerHTML = '';

        var filtered = allRequests.filter(function(req) {
            var st = (req.status || 'pending').toLowerCase();
            if (currentFilter === 'all') return true;
            if (currentFilter === 'pending') return st === 'pending';
            if (currentFilter === 'processed') return st === 'approved_and_deleted' || st === 'processed' || st === 'completed';
            if (currentFilter === 'rejected') return st === 'rejected';
            return true;
        });

        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
            showStatus('0 requests found.');
            return;
        }

        emptyState.classList.add('hidden');
        showStatus('Showing ' + filtered.length + ' of ' + allRequests.length + ' requests.');

        filtered.forEach(function(req) {
            var tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition';

            var dateCell = document.createElement('td');
            dateCell.className = 'px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono';
            dateCell.textContent = formatDate(req);

            var nameCell = document.createElement('td');
            nameCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800';
            nameCell.textContent = req.fullName || 'N/A';

            var contactCell = document.createElement('td');
            contactCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-800';
            var contactHTML = '<div class="font-medium text-blue-600">' + escapeHtml(req.userIdentifier || 'N/A') + '</div>';
            if (req.userId) {
                contactHTML += '<div class="text-[11px] text-gray-400 font-mono">ID: ' + escapeHtml(req.userId) + '</div>';
            }
            if (req.accountVerified) {
                contactHTML += '<div class="text-[10px] text-green-600 font-semibold mt-0.5">✓ Account Verified</div>';
            }
            if (req.otpVerified) {
                contactHTML += '<div class="text-[10px] text-blue-600 font-semibold mt-0.5">✓ OTP Verified</div>';
            }
            contactCell.innerHTML = contactHTML;

            var detailsCell = document.createElement('td');
            detailsCell.className = 'px-6 py-4 text-xs text-gray-600 max-w-xs';
            var reasonHTML = '<div class="font-semibold text-gray-800">' + escapeHtml(req.reason || 'No reason specified') + '</div>';
            if (req.details) {
                reasonHTML += '<div class="text-gray-500 italic mt-0.5">' + escapeHtml(req.details) + '</div>';
            }
            detailsCell.innerHTML = reasonHTML;

            var statusCell = document.createElement('td');
            statusCell.className = 'px-6 py-4 whitespace-nowrap text-xs';
            statusCell.innerHTML = renderStatusBadge(req.status);

            var actionsCell = document.createElement('td');
            actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-2';

            var st = (req.status || 'pending').toLowerCase();

            if (st === 'pending') {
                var approveDeleteBtn = document.createElement('button');
                approveDeleteBtn.className = 'px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition shadow-sm';
                approveDeleteBtn.textContent = 'Approve & Delete Account';
                approveDeleteBtn.onclick = function() {
                    approveAndDeleteAccount(req);
                };
                actionsCell.appendChild(approveDeleteBtn);

                var rejectBtn = document.createElement('button');
                rejectBtn.className = 'px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium transition shadow-sm';
                rejectBtn.textContent = 'Reject';
                rejectBtn.onclick = function() {
                    updateStatus(req.key, 'rejected');
                };
                actionsCell.appendChild(rejectBtn);
            }

            var removeRecordBtn = document.createElement('button');
            removeRecordBtn.className = 'px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded font-medium transition';
            removeRecordBtn.textContent = 'Remove Log';
            removeRecordBtn.onclick = function() {
                deleteRecord(req.key);
            };
            actionsCell.appendChild(removeRecordBtn);

            tr.appendChild(dateCell);
            tr.appendChild(nameCell);
            tr.appendChild(contactCell);
            tr.appendChild(detailsCell);
            tr.appendChild(statusCell);
            tr.appendChild(actionsCell);

            requestsTableBody.appendChild(tr);
        });
    }

    function approveAndDeleteAccount(req) {
        var userDesc = req.userIdentifier + (req.fullName ? ' (' + req.fullName + ')' : '');
        var confirmMsg = 'WARNING: Are you sure you want to approve this request and PERMANENTLY DELETE the account "' + userDesc + '" from the database?\n\nThis action cannot be undone.';
        
        if (!confirm(confirmMsg)) {
            return;
        }

        showStatus('Deleting user account from database...');

        var deletePromise;

        if (req.userId) {
            deletePromise = firebase.database().ref('users/' + req.userId).remove();
        } else {
            deletePromise = firebase.database().ref('users').once('value').then(function(snapshot) {
                var users = snapshot.val() || {};
                var targetKey = null;
                var searchClean = (req.userIdentifier || '').trim().toLowerCase();

                Object.keys(users).forEach(function(key) {
                    var u = users[key] || {};
                    if (key.toLowerCase() === searchClean ||
                        (u.email || '').toLowerCase() === searchClean ||
                        (u.username || '').toLowerCase() === searchClean ||
                        (u.phone || u.phoneNumber || '').toString() === req.userIdentifier) {
                        targetKey = key;
                    }
                });

                if (targetKey) {
                    return firebase.database().ref('users/' + targetKey).remove();
                } else {
                    console.warn('User account record not found in users node at time of approval.');
                    return Promise.resolve();
                }
            });
        }

        deletePromise.then(function() {
            return firebase.database().ref('account_deletion_requests/' + req.key).update({
                status: 'approved_and_deleted',
                approvedAt: firebase.database.ServerValue.TIMESTAMP
            });
        }).then(function() {
            alert('SUCCESS: Account "' + userDesc + '" has been permanently deleted from the database!');
            loadRequests();
        }).catch(function(error) {
            console.error('Error during account deletion:', error);
            alert('Failed to delete account from database: ' + error.message);
            showStatus('Error processing deletion.');
        });
    }

    function updateStatus(key, newStatus) {
        showStatus('Updating request status...');
        firebase.database().ref('account_deletion_requests/' + key + '/status').set(newStatus)
            .then(function() {
                loadRequests();
            })
            .catch(function(error) {
                console.error('Failed to update status:', error);
                alert('Error updating status: ' + error.message);
                showStatus('Error updating request.');
            });
    }

    function deleteRecord(key) {
        if (!confirm('Are you sure you want to remove this deletion request log entry?')) {
            return;
        }
        showStatus('Deleting log record...');
        firebase.database().ref('account_deletion_requests/' + key).remove()
            .then(function() {
                loadRequests();
            })
            .catch(function(error) {
                console.error('Failed to delete log record:', error);
                alert('Error deleting record: ' + error.message);
                showStatus('Error removing request.');
            });
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadRequests);
    }

    // Initial Load
    loadRequests();
});
