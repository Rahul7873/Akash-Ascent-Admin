import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5500,
    host: '0.0.0.0'
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        dashboard: resolve(__dirname, 'Dashboard.html'),
        accountDeletion: resolve(__dirname, 'account-deletion.html'),
        deletionRequests: resolve(__dirname, 'deletion-requests.html'),
        allPlaylists: resolve(__dirname, 'all-playlists.html'),
        allUsers: resolve(__dirname, 'all-users.html'),
        recentUsers: resolve(__dirname, 'recent-users.html'),
        addPreference: resolve(__dirname, 'add-preference.html'),
        addVideo: resolve(__dirname, 'add-video.html'),
        createPlaylist: resolve(__dirname, 'create-playlist.html'),
        createMahapack: resolve(__dirname, 'create-mahapack.html'),
        sendNotification: resolve(__dirname, 'send-notification.html'),
        editPlaylist: resolve(__dirname, 'edit-playlist.html'),
        editVideo: resolve(__dirname, 'edit-video.html'),
        playlistDashboard: resolve(__dirname, 'playlist_dashboard.html'),
        desktop2: resolve(__dirname, 'desktop2.html')
      }
    }
  }
});
