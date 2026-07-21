// Function to show video preview
function showVideoPreview(event) {
    const file = event.target.files[0];
    if (file) {
        const preview = document.getElementById('video-preview');
        const icon = document.getElementById('video-icon');
        const text = document.getElementById('video-upload-text');
        
        const fileURL = URL.createObjectURL(file);
        preview.src = fileURL;
        preview.classList.remove('hidden');
        icon.classList.add('hidden');
        text.classList.add('hidden');
    }
}

// Function to show thumbnail preview
function showThumbnailPreview(event) {
    const file = event.target.files[0];
    if (file) {
        const preview = document.getElementById('thumbnail-preview');
        const icon = document.getElementById('thumbnail-icon');
        const text = document.getElementById('thumbnail-upload-text');
        
        const fileURL = URL.createObjectURL(file);
        preview.src = fileURL;
        preview.classList.remove('hidden');
        icon.classList.add('hidden');
        text.classList.add('hidden');
    }
}

// Handle Form Submission
const courseForm = document.getElementById('course-form');
if (courseForm) {
    courseForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerText;
        
        const formData = {
            title: document.getElementById('title-input').value,
            description: document.getElementById('description-input').value,
            serial: document.getElementById('serial-input').value,
            author: document.getElementById('author-input').value,
            video: document.getElementById('video-upload').files[0],
            thumbnail: document.getElementById('thumbnail-upload').files[0]
        };

        // Basic validation
        if (!formData.title || !formData.video || !formData.thumbnail) {
            alert('Please fill in the title and upload both a video and a thumbnail.');
            return;
        }

        // Disable button and show loading state
        submitBtn.disabled = true;
        submitBtn.innerText = 'Uploading...';

        const timestamp = Date.now();
        const storage = firebase.storage().ref();
        
        // 1. Prepare upload tasks
        const statusContainer = document.getElementById('status-container');
        const percentageText = document.getElementById('upload-percentage');
        const progressBar = document.getElementById('upload-progress-bar');

        if (statusContainer) statusContainer.classList.remove('hidden');

        const videoRef = storage.child(`videos/${timestamp}_${formData.video.name}`);
        const thumbRef = storage.child(`thumbnails/${timestamp}_${formData.thumbnail.name}`);

        const videoTask = videoRef.put(formData.video);
        const thumbTask = thumbRef.put(formData.thumbnail);

        let videoProgress = 0;
        let thumbProgress = 0;

        const updateStatus = () => {
            const overall = Math.round((videoProgress + thumbProgress) / 2);
            if (percentageText) percentageText.innerText = `${overall}%`;
            if (progressBar) progressBar.style.width = `${overall}%`;
        };

        videoTask.on('state_changed', (snapshot) => {
            videoProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            updateStatus();
        }, (error) => {
            console.error('Video upload error:', error);
        });

        thumbTask.on('state_changed', (snapshot) => {
            thumbProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            updateStatus();
        }, (error) => {
            console.error('Thumbnail upload error:', error);
        });

        // 2. Upload files and get URLs
        Promise.all([
            videoTask.then(snapshot => snapshot.ref.getDownloadURL()),
            thumbTask.then(snapshot => snapshot.ref.getDownloadURL())
        ]).then(urls => {
            const [videoUrl, thumbUrl] = urls;

            // 3. Save metadata to Realtime Database
            return firebase.database().ref('courses').push({
                title: formData.title,
                description: formData.description,
                serial: formData.serial,
                author: formData.author,
                videoUrl: videoUrl,
                thumbnailUrl: thumbUrl,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
        }).then(() => {
            alert('Course uploaded successfully!');
            courseForm.reset();
            resetPreviews();
        }).catch(error => {
            console.error('Upload failed:', error);
            handleUploadError(error);
        }).finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        });

        function handleUploadError(error) {
            alert('Upload failed! This is usually caused by the CORS policy. Please follow the instructions I provided to fix your Firebase settings. Error: ' + error.message);
            if (statusContainer) statusContainer.classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        }
    });

    // Handle Form Reset to clear previews
    courseForm.addEventListener('reset', function() {
        resetPreviews();
    });
}

function resetPreviews() {
    const videoPreview = document.getElementById('video-preview');
    const videoIcon = document.getElementById('video-icon');
    const videoText = document.getElementById('video-upload-text');
    
    const thumbPreview = document.getElementById('thumbnail-preview');
    const thumbIcon = document.getElementById('thumbnail-icon');
    const thumbText = document.getElementById('thumbnail-upload-text');

    const statusContainer = document.getElementById('status-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const percentageText = document.getElementById('upload-percentage');

    if (videoPreview) {
        videoPreview.classList.add('hidden');
        videoPreview.src = '';
    }
    videoIcon?.classList.remove('hidden');
    videoText?.classList.remove('hidden');

    if (thumbPreview) {
        thumbPreview.classList.add('hidden');
        thumbPreview.src = '';
    }
    thumbIcon?.classList.remove('hidden');
    thumbText?.classList.remove('hidden');

    if (statusContainer) statusContainer.classList.add('hidden');
    if (progressBar) progressBar.style.width = '0%';
    if (percentageText) percentageText.innerText = '0%';
}