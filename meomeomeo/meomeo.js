/**
 * SmartCam Studio – Virtual Lab Camera
 * Xử lý logic kết nối MediaDevices, MediaRecorder, Canvas Snapshot, Quản lý tệp và Toast Notification.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const cameraVideo = document.getElementById('cameraVideo');
    const cameraPlaceholder = document.getElementById('cameraPlaceholder');
    const viewerContainer = document.getElementById('viewerContainer');
    const connectionBadge = document.getElementById('connectionBadge');
    const statusText = document.getElementById('statusText');
    
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const snapshotBtn = document.getElementById('snapshotBtn');
    const recordBtn = document.getElementById('recordBtn');
    const stopRecordBtn = document.getElementById('stopRecordBtn');
    
    const cameraSelect = document.getElementById('cameraSelect');
    const resolutionSelect = document.getElementById('resolutionSelect');
    
    const gridToggleBtn = document.getElementById('gridToggleBtn');
    const flipToggleBtn = document.getElementById('flipToggleBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    
    const labGridOverlay = document.getElementById('labGridOverlay');
    const recBadge = document.getElementById('recBadge');
    const recTimer = document.getElementById('recTimer');
    const resolutionInfo = document.getElementById('resolutionInfo');
    const deviceInfo = document.getElementById('deviceInfo');
    
    const mediaListContainer = document.getElementById('mediaListContainer');
    const emptyState = document.getElementById('emptyState');
    const fileCountBadge = document.getElementById('fileCountBadge');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    const snapshotCanvas = document.getElementById('snapshotCanvas');
    const toastContainer = document.getElementById('toastContainer');
    
    // Modal Elements
    const previewModal = document.getElementById('previewModal');
    const modalBody = document.getElementById('modalBody');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalMetaText = document.getElementById('modalMetaText');
    const modalDownloadBtn = document.getElementById('modalDownloadBtn');

    // App State
    let mediaStream = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let recordingTimerInterval = null;
    let recordingSeconds = 0;
    let mediaFiles = []; // Lưu trữ danh sách tệp trong phiên
    let currentFilter = 'all';
    let isMirrored = false;
    let isGridActive = false;

    // --- Khởi tạo ứng dụng & Load LocalStorage ---
    initThemePreference();
    checkSecureContextNotice();
    loadAvailableCameras();

    // Lắng nghe sự kiện thay đổi thiết bị phần cứng camera (cắm/rút webcam)
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', loadAvailableCameras);
    }

    // --- 1. Quản lý Theme (Giao diện Sáng / Tối) ---
    function initThemePreference() {
        const savedTheme = localStorage.getItem('smartcam_theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    }

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('smartcam_theme', isLight ? 'light' : 'dark');
        themeToggleBtn.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        showToast(isLight ? 'Đã chuyển sang giao diện sáng' : 'Đã chuyển sang giao diện tối', 'info');
    });

    // --- 2. Kiểm tra môi trường bảo mật HTTPS / Localhost ---
    function checkSecureContextNotice() {
        if (!window.isSecureContext) {
            showToast('Cảnh báo: Trình duyệt yêu cầu HTTPS hoặc Localhost để truy cập camera.', 'error', 6000);
        }
    }

    // --- 3. Quét danh sách thiết bị Camera ---
    async function loadAvailableCameras() {
        try {
            // Yêu cầu quyền tạm thời để enumerateDevices có nhãn thiết bị đầy đủ trên một số trình duyệt
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            tempStream.getTracks().forEach(track => track.stop());
        } catch (e) {
            // Bỏ qua nếu chưa cấp quyền
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            cameraSelect.innerHTML = '';
            if (videoDevices.length === 0) {
                cameraSelect.innerHTML = '<option value="">Không tìm thấy camera nào</option>';
                cameraSelect.disabled = true;
                return;
            }

            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.label = device.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(option);
            });
            cameraSelect.disabled = false;
        } catch (err) {
            console.error('Lỗi liệt kê thiết bị camera:', err);
        }
    }

    // --- 4. Kết nối và Ngắt kết nối Camera ---
    connectBtn.addEventListener('click', async () => {
        await startCamera();
    });

    disconnectBtn.addEventListener('click', () => {
        stopCamera();
        showToast('Đã ngắt kết nối camera.', 'info');
    });

    async function startCamera() {
        try {
            if (mediaStream) {
                stopCameraStreamTracks();
            }

            const selectedDeviceId = cameraSelect.value;
            const resolutionSetting = resolutionSelect.value;

            // Xây dựng ràng buộc constraints dựa trên lựa chọn độ phân giải
            let videoConstraints = {
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined
            };

            if (resolutionSetting === 'hd') {
                videoConstraints.width = { ideal: 1280 };
                videoConstraints.height = { ideal: 720 };
            } else if (resolutionSetting === 'fhd') {
                videoConstraints.width = { ideal: 1920 };
                videoConstraints.height = { ideal: 1080 };
            } else if (resolutionSetting === 'vga') {
                videoConstraints.width = { ideal: 640 };
                videoConstraints.height = { ideal: 480 };
            } else {
                videoConstraints.width = { ideal: 1280 };
                videoConstraints.height = { ideal: 720 };
            }

            const constraints = {
                video: videoConstraints,
                audio: true // Hỗ trợ thu âm khi quay video thí nghiệm
            };

            mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            cameraVideo.srcObject = mediaStream;
            
            await cameraVideo.play();

            // Cập nhật giao diện khi kết nối thành công
            cameraVideo.classList.add('active');
            cameraPlaceholder.style.display = 'none';
            viewerContainer.classList.add('connected');
            
            connectionBadge.classList.add('connected');
            statusText.textContent = 'Đã kết nối';

            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            snapshotBtn.disabled = false;
            recordBtn.disabled = false;
            resolutionSelect.disabled = true;
            cameraSelect.disabled = true;

            // Hiển thị thông tin luồng camera thực tế
            const videoTrack = mediaStream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            resolutionInfo.textContent = `Độ phân giải: ${settings.width || '---'} × ${settings.height || '---'}`;
            deviceInfo.textContent = `Thiết bị: ${videoTrack.label || 'Camera quang học'}`;

            showToast('Kết nối camera thành công!', 'success');
        } catch (err) {
            handleCameraError(err);
        }
    }

    function stopCameraStreamTracks() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        cameraVideo.srcObject = null;
    }

    function stopCamera() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            stopRecordingProcess();
        }
        stopCameraStreamTracks();

        cameraVideo.classList.remove('active');
        cameraPlaceholder.style.display = 'flex';
        viewerContainer.classList.remove('connected');

        connectionBadge.classList.remove('connected');
        statusText.textContent = 'Chưa kết nối';

        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        snapshotBtn.disabled = true;
        recordBtn.disabled = true;
        stopRecordBtn.style.display = 'none';
        stopRecordBtn.disabled = true;
        resolutionSelect.disabled = false;
        cameraSelect.disabled = false;

        resolutionInfo.textContent = 'Độ phân giải: --';
        deviceInfo.textContent = 'Thiết bị: Chưa chọn';
    }

    function handleCameraError(error) {
        console.error('Lỗi camera:', error);
        let msg = 'Không thể khởi động camera.';
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            msg = 'Bạn đã từ chối quyền truy cập camera. Vui lòng cấp phép trên trình duyệt.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            msg = 'Không tìm thấy thiết bị camera khả dụng trên hệ thống.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            msg = 'Camera đang bị chiếm quyền bởi ứng dụng khác.';
        } else if (error.name === 'OverconstrainedError') {
            msg = 'Độ phân giải yêu cầu vượt quá khả năng phần cứng của camera.';
        }
        showToast(msg, 'error', 5000);
    }

    // --- 5. Tính năng Chụp ảnh (Canvas API & Blob) ---
    snapshotBtn.addEventListener('click', () => {
        if (!mediaStream || !cameraVideo.videoWidth) {
            showToast('Camera chưa sẵn sàng để chụp ảnh.', 'error');
            return;
        }

        const width = cameraVideo.videoWidth;
        const height = cameraVideo.videoHeight;

        snapshotCanvas.width = width;
        snapshotCanvas.height = height;
        const ctx = snapshotCanvas.getContext('2d');

        // Nếu đang bật chế độ lật ngang (mirror), lật canvas để ảnh chụp đúng hướng thực tế
        if (isMirrored) {
            ctx.translate(width, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(cameraVideo, 0, 0, width, height);

        snapshotCanvas.toBlob((blob) => {
            if (!blob) {
                showToast('Không thể tạo tệp ảnh chụp.', 'error');
                return;
            }

            const timestamp = new Date();
            const timeString = timestamp.toISOString().replace(/[:.]/g, '-');
            const fileName = `lab-snapshot-${timeString}.png`;
            const fileUrl = URL.createObjectURL(blob);

            const fileObj = {
                id: Date.now(),
                type: 'image',
                name: fileName,
                url: fileUrl,
                blob: blob,
                timestamp: timestamp.toLocaleTimeString()
            };

            mediaFiles.unshift(fileObj);
            renderMediaList();
            showToast('Chụp ảnh thí nghiệm thành công!', 'success');
        }, 'image/png');
    });

    // --- 6. Tính năng Quay video (MediaRecorder API) ---
    recordBtn.addEventListener('click', () => {
        if (!mediaStream) {
            showToast('Vui lòng kết nối camera trước khi quay video.', 'error');
            return;
        }

        recordedChunks = [];
        let mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/mp4'; // Fallback
            }
        }

        try {
            mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
        } catch (e) {
            console.error('MediaRecorder error:', e);
            showToast('Trình duyệt không hỗ trợ định dạng ghi hình này.', 'error');
            return;
        }

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
            const timestamp = new Date();
            const timeString = timestamp.toISOString().replace(/[:.]/g, '-');
            const ext = mediaRecorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
            const fileName = `lab-recording-${timeString}.${ext}`;
            const fileUrl = URL.createObjectURL(blob);

            const fileObj = {
                id: Date.now(),
                type: 'video',
                name: fileName,
                url: fileUrl,
                blob: blob,
                timestamp: timestamp.toLocaleTimeString()
            };

            mediaFiles.unshift(fileObj);
            renderMediaList();
            showToast('Đã lưu video thí nghiệm hoàn chỉnh!', 'success');
        };

        // Bắt đầu quay với timeslice 100ms để gom dữ liệu an toàn tránh lỗi file
        mediaRecorder.start(100);

        // Chuyển đổi trạng thái nút bấm
        recordBtn.style.display = 'none';
        recordBtn.disabled = true;
        stopRecordBtn.style.display = 'inline-flex';
        stopRecordBtn.disabled = false;
        recBadge.style.display = 'flex';

        // Bắt đầu đếm giờ quay
        recordingSeconds = 0;
        updateRecordingTimerDisplay();
        recordingTimerInterval = setInterval(() => {
            recordingSeconds++;
            updateRecordingTimerDisplay();
        }, 1000);

        showToast('Bắt đầu ghi hình thí nghiệm...', 'info');
    });

    stopRecordBtn.addEventListener('click', () => {
        stopRecordingProcess();
    });

    function stopRecordingProcess() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        clearInterval(recordingTimerInterval);

        stopRecordBtn.style.display = 'none';
        stopRecordBtn.disabled = true;
        recordBtn.style.display = 'inline-flex';
        recordBtn.disabled = false;
        recBadge.style.display = 'none';
    }

    function updateRecordingTimerDisplay() {
        const mins = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
        const secs = (recordingSeconds % 60).toString().padStart(2, '0');
        recTimer.textContent = `${mins}:${secs}`;
    }

    // --- 7. Quản lý Tệp và Danh sách Sidebar ---
    function renderMediaList() {
        mediaListContainer.innerHTML = '';
        
        const filteredFiles = mediaFiles.filter(file => {
            if (currentFilter === 'all') return true;
            return file.type === currentFilter;
        });

        fileCountBadge.textContent = `${mediaFiles.length} tệp`;
        clearAllBtn.disabled = mediaFiles.length === 0;

        if (filteredFiles.length === 0) {
            emptyState.style.display = 'flex';
            mediaListContainer.appendChild(emptyState);
            return;
        }

        emptyState.style.display = 'none';

        filteredFiles.forEach((file) => {
            const item = document.createElement('div');
            item.className = 'media-item';

            let thumbContent = '';
            if (file.type === 'image') {
                thumbContent = `<img src="${file.url}" class="media-thumb" alt="Thumbnail" data-id="${file.id}">`;
            } else {
                thumbContent = `
                    <div class="media-thumb video-thumb-placeholder" data-id="${file.id}" style="display:flex;align-items:center;justify-content:center;background:#000;color:var(--accent-cyan);">
                        <i class="fa-solid fa-film"></i>
                    </div>`;
            }

            item.innerHTML = `
                ${thumbContent}
                <div class="media-info">
                    <span class="media-name" title="${file.name}">${file.name}</span>
                    <span class="media-meta">${file.timestamp} · ${file.type.toUpperCase()}</span>
                </div>
                <div class="media-actions">
                    <a href="${file.url}" download="${file.name}" class="media-action-btn" title="Tải xuống">
                        <i class="fa-solid fa-download"></i>
                    </a>
                    <button class="media-action-btn delete" data-id="${file.id}" title="Xóa tệp">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            // Xem trước khi click vào thumbnail
            const thumbEl = item.querySelector('.media-thumb');
            thumbEl.addEventListener('click', () => openPreviewModal(file));

            // Nút xóa từng tệp
            const deleteBtn = item.querySelector('.delete');
            deleteBtn.addEventListener('click', () => deleteFile(file.id));

            mediaListContainer.appendChild(item);
        });
    }

    // Lọc tệp qua tab
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-target');
            renderMediaList();
        });
    });

    function deleteFile(id) {
        const index = mediaFiles.findIndex(f => f.id === id);
        if (index !== -1) {
            URL.revokeObjectURL(mediaFiles[index].url); // Giải phóng bộ nhớ
            mediaFiles.splice(index, 1);
            renderMediaList();
            showToast('Đã xóa tệp khỏi danh sách.', 'info');
        }
    }

    clearAllBtn.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ tệp đã ghi trong phiên này?')) {
            mediaFiles.forEach(f => URL.revokeObjectURL(f.url));
            mediaFiles = [];
            renderMediaList();
            showToast('Đã làm sạch danh sách tệp.', 'info');
        }
    });

    // --- 8. Modal Lightbox Xem trước ---
    function openPreviewModal(file) {
        modalBody.innerHTML = '';
        if (file.type === 'image') {
            const img = document.createElement('img');
            img.src = file.url;
            modalBody.appendChild(img);
        } else {
            const video = document.createElement('video');
            video.src = file.url;
            video.controls = true;
            video.autoplay = true;
            modalBody.appendChild(video);
        }

        modalMetaText.textContent = `${file.name} — ${file.timestamp}`;
        modalDownloadBtn.href = file.url;
        modalDownloadBtn.download = file.name;

        previewModal.classList.add('active');
    }

    modalCloseBtn.addEventListener('click', () => {
        previewModal.classList.remove('active');
        modalBody.innerHTML = ''; // Dừng video đang phát
    });

    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            modalCloseBtn.click();
        }
    });

    // --- 9. Các tính năng bổ trợ cho Thí nghiệm Vật lý ---
    // Bật/tắt lưới quan sát
    gridToggleBtn.addEventListener('click', () => {
        isGridActive = !isGridActive;
        labGridOverlay.classList.toggle('active', isGridActive);
        gridToggleBtn.classList.toggle('active', isGridActive);
        showToast(isGridActive ? 'Đã bật lưới căn chỉnh thí nghiệm' : 'Đã tắt lưới căn chỉnh', 'info');
    });

    // Lật hình ngang (Mirror)
    flipToggleBtn.addEventListener('click', () => {
        isMirrored = !isMirrored;
        cameraVideo.classList.toggle('mirrored', isMirrored);
        flipToggleBtn.classList.toggle('active', isMirrored);
        showToast(isMirrored ? 'Đã bật chế độ lật hình ngang' : 'Đã tắt lật hình ngang', 'info');
    });

    // Toàn màn hình khung xem
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            viewerContainer.requestFullscreen().catch(err => {
                showToast('Không thể chuyển sang chế độ toàn màn hình.', 'error');
            });
        } else {
            document.exitFullscreen();
        }
    });

    // --- 10. Hệ thống Toast Notification ---
    function showToast(message, type = 'info', duration = 3500) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconClass = 'fa-solid fa-circle-info';
        if (type === 'success') iconClass = 'fa-solid fa-circle-check';
        if (type === 'error') iconClass = 'fa-solid fa-triangle-exclamation';

        toast.innerHTML = `
            <i class="${iconClass}"></i>
            <span>${message}</span>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOutToast 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Dọn dẹp tài nguyên khi người dùng tắt trang
    window.addEventListener('pagehide', () => {
        stopCameraStreamTracks();
        mediaFiles.forEach(f => URL.revokeObjectURL(f.url));
    });
});