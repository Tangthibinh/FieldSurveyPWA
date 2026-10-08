# VKU Field Survey PWA - Mini-Project 1

Ứng dụng Progressive Web App (PWA) hỗ trợ khảo sát hiện trạng cơ sở vật chất VKU. Ứng dụng dùng kiến trúc Mobile-First, Offline-First, IndexedDB và đồng bộ Google Sheets WebApp. Web app có thể đóng gói thành APK Android bằng Capacitor.

## Tính năng

- Form khảo sát sinh động từ `questions.md`, hỗ trợ text, number, select, radio, checkbox, photo và textarea.
- Tự động lưu nháp, hàng chờ offline và lịch sử khảo sát bằng IndexedDB.
- Đồng bộ tự động hoặc thủ công tới Google Sheets WebApp.
- Tra cứu dữ liệu cơ sở vật chất từ CSV và dữ liệu đã đồng bộ.
- PWA installable với Service Worker, cache app shell và fallback offline.
- Capacitor bridge cho Camera, Geolocation, Filesystem và Push Notifications.

## Kiến trúc Capacitor

Ứng dụng giữ nguyên UI và logic web trong WebView. `js/nativeBridge.js` là lớp adapter duy nhất:

- Trong APK: gọi plugin Capacitor để dùng camera, vị trí, bộ nhớ file và thông báo native.
- Trong trình duyệt: giữ fallback bằng input camera và Web Geolocation; thông báo native hiển thị trạng thái không khả dụng.
- Tọa độ được thêm vào payload khảo sát nếu người dùng cấp quyền.

## Cấu trúc chính

```text
FieldSurveyPWA/
├── index.html                 # UI PWA
├── index.css                  # Mobile-first design system
├── manifest.json              # PWA manifest
├── sw.js                      # Offline cache và background sync
├── questions.md               # Cấu hình câu hỏi
├── vku_facility_inspection_data.csv
├── package.json               # Vite và Capacitor scripts
├── capacitor.config.json      # appId và dist webDir
├── vite.config.js             # Copy asset runtime vào dist
├── js/
│   ├── app.js                 # Điều phối ứng dụng
│   ├── db.js                  # IndexedDB
│   ├── mdParser.js            # Markdown -> form HTML
│   ├── sync.js                # Đồng bộ Google Sheets
│   ├── nativeBridge.js         # Camera, vị trí, file, push
│   └── qaEngine.js             # Trợ lý hỏi đáp
└── google-apps-script/Code.gs # Google Apps Script endpoint
```

## Chạy local

Cần Node.js.

```bash
npm install
npm run dev
```

Mở URL Vite hiển thị trong terminal. Build production:

```bash
npm run build
```

Thư mục `dist` đã bao gồm `questions.md`, CSV, Service Worker và icons cần thiết lúc runtime.

## Đóng gói APK Android

Cần Android Studio và Android SDK.

```bash
# Chạy một lần cho project mới
npm run cap:add:android

# Chạy sau mỗi lần sửa web code
npm run cap:sync

# Mở project Android trong Android Studio
npm run cap:open:android

# Hoặc chạy trên emulator / thiết bị USB đã bật USB debugging
npm run cap:run:android
```

Các plugin sẽ khai báo quyền Android tương ứng sau `cap:sync`. Khi phát hành thật, kiểm tra lại quyền Camera, Location và Notifications trong Android Studio. Push Notifications cần cấu hình FCM nếu muốn nhận thông báo từ server.

### Cài APK bằng Android Studio

1. Mở Android Studio > **Open** > chọn thư mục `android` trong project này.
2. Chờ Gradle Sync hoàn tất; nếu Android Studio hỏi, cài Android SDK Platform và Build Tools được đề xuất.
3. Chọn emulator hoặc điện thoại Android đã bật **Developer options > USB debugging**.
4. Bấm nút **Run** để cài và chạy trực tiếp trên thiết bị.
5. Muốn xuất file APK: chọn **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
6. APK debug sẽ nằm tại `android/app/build/outputs/apk/debug/app-debug.apk`.

Có thể cài thủ công bằng ADB:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

APK debug chỉ dùng để thử nghiệm. Để phát hành, chọn **Build > Generate Signed App Bundle / APK**, tạo keystore và dùng bản `release` đã ký.

## Tùy biến câu hỏi

Sửa `questions.md` theo cú pháp:

```markdown
### Q1: Tên tòa nhà & Số phòng
- Type: text
- Required: true
- Placeholder: Ví dụ: Tòa nhà C - Phòng 204
- Info: Nhập đúng tên phòng.

### Q2: Tình trạng máy chiếu
- Type: select
- Options: [Hoạt động tốt, Hỏng nhẹ, Cần thay mới]
```

Trong app, mở tab Cấu hình và chọn làm mới form.

## Kết nối Google Sheets

1. Tạo Google Sheet và mở Extensions > Apps Script.
2. Dán nội dung `google-apps-script/Code.gs`.
3. Deploy thành Web App, thực thi dưới tài khoản của bạn và cấp quyền truy cập phù hợp.
4. Dán Web App URL vào tab Cấu hình của ứng dụng.

Nếu chưa cấu hình URL, app dùng chế độ mock để vẫn có thể kiểm tra UI và hàng chờ.

## Đánh giá Mini-Project

- [x] PWA installable, responsive và offline-first.
- [x] IndexedDB draft, queue, history và background sync.
- [x] Dynamic Markdown parser.
- [x] Google Sheets WebApp integration.
- [x] Capacitor WebView + native bridge + plugin setup.
- [ ] Cấu hình FCM server cho push notification production.
