// Logout logic for both desktop1 and desktop2
function handleLogout() {
    sessionStorage.removeItem('loggedIn');
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', function() {
    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});
