// Initialize Firebase using compat SDK so window.firebase is available
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDJgO1PJH3ndJ1em-vID6zxxLMcy35rPNk",
  authDomain: "akash-vidya.firebaseapp.com",
  databaseURL: "https://akash-vidya-default-rtdb.firebaseio.com",
  projectId: "akash-vidya",
  storageBucket: "akash-vidya.firebasestorage.app",
  messagingSenderId: "604364049005",
  appId: "1:604364049005:web:040bde23bd541a25080d64"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
if (firebase.analytics) {
  firebase.analytics();
}