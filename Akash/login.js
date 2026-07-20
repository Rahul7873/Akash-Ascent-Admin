document.addEventListener('DOMContentLoaded', function() {
    // Login form logic using Firebase Realtime Database (search all users for username/password match)
    var loginForm = document.getElementById('login-form');
    var loginError = document.getElementById('login-error');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            var username = document.getElementById('username').value;
            var password = document.getElementById('password').value;
            loginError.textContent = '';
            // Reference to users node in Realtime Database
            firebase.database().ref('Admin').once('value').then(function(snapshot) {
                var users = snapshot.val();
                var foundKey = null;
                
                if (users) {
                    for (var key in users) {
                        if (users.hasOwnProperty(key)) {
                            var user = users[key];
                            if (user.username === username && user.password === password) {
                                foundKey = key;
                                break;
                            }
                        }
                    }
                }
                
                // If database has no Admin users yet, allow default admin credentials
                if (!users && (username === 'admin' && password === 'admin123')) {
                    var newAdminRef = firebase.database().ref('Admin').push();
                    newAdminRef.set({ username: 'admin', password: 'admin123', login: true });
                    foundKey = newAdminRef.key;
                }

                if (foundKey) {
                    // Set login:true for this user, then redirect only after update
                    firebase.database().ref('Admin/' + foundKey + '/login').set(true)
                        .then(function() {
                            try {
                                sessionStorage.setItem('loggedIn', 'true');
                                window.location.href = 'Dashboard.html';
                                setTimeout(function() {
                                    if (window.location.pathname.includes('login.html')) {
                                        loginError.textContent = 'Redirect failed. Please check if Dashboard.html exists.';
                                        console.error('Redirect to Dashboard.html failed.');
                                    }
                                }, 2000);
                            } catch (redirectError) {
                                loginError.textContent = 'Redirect error: ' + redirectError;
                                console.error('Redirect error:', redirectError);
                            }
                        })
                        .catch(function(error) {
                            sessionStorage.setItem('loggedIn', 'true');
                            window.location.href = 'Dashboard.html';
                        });
                } else {
                    loginError.textContent = 'Invalid username or password.';
                }
            }).catch(function(error) {
                console.error('Database connection error:', error);
                // Fallback login if offline or database initial setup
                if (username === 'admin' && password === 'admin123') {
                    sessionStorage.setItem('loggedIn', 'true');
                    window.location.href = 'Dashboard.html';
                } else {
                    loginError.textContent = 'Error connecting to database. Try admin / admin123 for initial access.';
                }
            });
        });
    }
   
});
