# SmartCam Studio – Virtual Lab Camera

SmartCam Studio là ứng dụng web chuyên nghiệp, mã nguồn mở, được thiết kế riêng cho việc giảng dạy, học tập và nghiên cứu STEM / Thí nghiệm Vật lý số. Ứng dụng cung cấp giao diện trực quan, hiệu năng cao để kết nối camera trực tiếp, hỗ trợ chụp ảnh, quay video không lỗi và các công cụ hỗ trợ quan sát thí nghiệm.

---

## 🚀 Tính năng nổi bật
1. **Kết nối Camera chuyên nghiệp:** Hỗ trợ lựa chọn thiết bị phần cứng, cấu hình độ phân giải tùy chọn (HD, Full HD, VGA) thông qua `MediaDevices API`.
2. **Chụp ảnh độ phân giải cao:** Sử dụng `Canvas API` để trích xuất khung hình chuẩn xác từ luồng video, lưu trữ linh hoạt dưới dạng file ảnh có tên tự động theo thời gian thực.
3. **Quay video an toàn (MediaRecorder):** Tích hợp bộ đệm `timeslice` và cơ chế nhận diện định dạng tối ưu (`video/webm`, `video/mp4`) giúp đảm bảo tệp video sau khi dừng ghi hoàn toàn nguyên vẹn, không bị hỏng metadata và phát lại mượt mà trên mọi trình thiết bị.
4. **Hỗ trợ Thí nghiệm Vật lý:** Tích hợp sẵn lớp phủ **Lưới căn chỉnh (Grid overlay)**, tâm ngắm tiêu cự và chế độ lật hình quang học (Mirror) phục vụ quan sát chuyển động và đo đạc sơ bộ.
5. **Quản lý đa phương tiện thông minh:** Thư viện xem trước (Lightbox), phân loại tệp ảnh/video riêng biệt và hỗ trợ tải xuống hoặc dọn dẹp bộ nhớ phiên làm việc.
6. **Toast Notification thân thiện:** Hoàn toàn không sử dụng hộp thoại `alert()` truyền thống, đem lại trải nghiệm mượt mà, hiện đại.

---

## 🛠 Hướng dẫn Cài đặt & Chạy trên Localhost

Do chính sách bảo mật của các trình duyệt hiện đại (Chrome, Edge, Firefox, Safari), API truy cập camera (`navigator.mediaDevices.getUserMedia`) **bắt buộc** phải chạy trên môi trường bảo mật bảo vệ (`HTTPS` hoặc `localhost`).

### Bước 1: Chuẩn bị mã nguồn
Tạo một thư mục dự án tên là `smartcam-studio` và đặt 3 tệp sau vào cùng một thư mục:
- `index.html`
- `style.css`
- `script.js`

### Bước 2: Chạy ứng dụng
* **Cách nhanh nhất (Khuyên dùng với VS Code):**
  1. Mở thư mục dự án trong Visual Studio Code.
  2. Cài đặt tiện ích mở rộng **Live Server** (nếu chưa có).
  3. Nhấn chuột phải vào `index.html` và chọn **"Open with Live Server"**.
  4. Trình duyệt sẽ tự động mở trang web tại địa chỉ `http://127.0.0.1:5500`.

* **Cách dùng Python (Nếu máy đã cài Python):**
  Mở terminal tại thư mục dự án và chạy lệnh:
  ```bash
  python -m http.server 8000