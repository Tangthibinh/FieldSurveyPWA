# 📱 MINI-PROJECT 1 SHORT TECHNICAL REPORT
**Course:** Cross-Platform Mobile App Development (VKU)  
**Mini-Project Title:** VKU Field Survey Progressive Web App (PWA)  
**Team / Student Name:** VKU Mobile Development Team  
**Submission Date:** 03/09/2026  

---

## 1. GENERAL INFORMATION & DELIVERABLE LINKS
* **Team Members:**
  1. Nguyễn Văn A — Student ID: 22IT001 — Role: Frontend Architecture & PWA Lead — Contribution: 50%
  2. Trần Thị B — Student ID: 22IT002 — Role: State Management, IndexedDB & Sync — Contribution: 50%
* **🔗 Live Demo URL:** [https://vkufieldsurvey.pages.dev](https://vkufieldsurvey.pages.dev) (Local: `http://localhost:3000`)
* **💻 GitHub Repository:** [https://github.com/sonnhuynhh/FieldSurveyPWA](https://github.com/sonnhuynhh/FieldSurveyPWA)
* **📄 Core Config Files:**
  - Survey Questions Config: [`questions.md`](file:///d:/HocCODE/FieldSurveyPWA/questions.md)
  - Google Apps Script Backend: [`google-apps-script/Code.gs`](file:///d:/HocCODE/FieldSurveyPWA/google-apps-script/Code.gs)
  - Inspection Dataset CSV: [`vku_facility_inspection_data.csv`](file:///d:/HocCODE/FieldSurveyPWA/vku_facility_inspection_data.csv)

---

## 2. SUMMARY OF COMPLETED FEATURES, TECHNICAL SOLUTIONS & LESSONS LEARNED

### 🎯 A. Các Tính Năng Đã Hoàn Thành (Completed Features Summary)
1. **📱 PWA Standard & Mobile-First Interface:**
   - Đạt đầy đủ 5 tiêu chuẩn PWA (Installable, Offline-First, Fast & Responsive, Engaging, Secure).
   - Bộ icon & favicon đầy đủ (`192x192`, `512x512`, `apple-touch-icon`, `favicon.svg`, `favicon.ico`). Cài đặt trực tiếp lên màn hình chính điện thoại (Add to Home Screen).
2. **📝 Đọc & Render Form Động Từ File Markdown (`questions.md`):**
   - Khi chỉnh sửa câu hỏi trong `questions.md`, ứng dụng tự động phân tích và sinh ra giao diện Form tương ứng (Text, Select, Radio, Checkbox, Number, Photo, Textarea, Tooltips) mà **không cần sửa code JavaScript**.
3. **💾 Offline-First với IndexedDB & Tự Động Lưu Nháp:**
   - Tự động lưu bản nháp (Auto-Save Draft) khi đang điền form. Dữ liệu khi gửi ở chế độ Offline được đưa vào Hàng chờ (`pending_sync`) trong **IndexedDB** và tự động đồng bộ khi có mạng trở lại.
4. **📊 Tra Cứu Báo Cáo Thực Địa & Bộ Lọc Nhanh (18+ Báo cáo):**
   - Nạp tự động bộ dữ liệu CSV và báo cáo từ Google Sheets (phòng C101, C204, C205, C301, C402, A207, Lab 201, Lab 301, Lab 302, Lab 402, KTX, Sân bóng đá...).
   - Thanh bộ lọc chip phân loại sự cố khẩn cấp, phòng Lab và thời gian báo cáo.
5. **🤖 Trợ Lý Hỗ Trợ & Trả Lời Câu Hỏi Thông Minh (QA Assistant Engine):**
   - Trợ lý tự động đọc và phân tích linh hoạt từ file `questions.md` lẫn dữ liệu báo cáo Google Sheets để trả lời thông minh các câu hỏi về hướng dẫn kiểm tra, thống kê phòng hỏng hóc, tổng chi phí bảo trì (`27.600.000 VNĐ`), và tra cứu chi tiết từng phòng (như A207).

---

### ⚙️ B. Giải Pháp Xử Lý Kỹ Thuật (Technical Solutions & Architecture)
1. **Service Worker Caching Strategy:**
   - Áp dụng chiến lược **`Cache-First`** cho App Shell (`index.html`, `index.css`, `js/*.js`, `icons`) để đảm bảo ứng dụng mở ngay tức thì dưới 1 giây.
   - Áp dụng chiến lược **`Stale-While-Revalidate`** cho file `questions.md` để form vừa tải nhanh vừa tự làm mới câu hỏi khi có thay đổi.
2. **IndexedDB Multi-Store Data Architecture:**
   - Xây dựng 4 Object Stores độc lập (`drafts`, `pending_sync`, `survey_history`, `facility_cache`) cho phép truy vấn asynchronous mượt mà, lưu trữ hình ảnh Base64 nén và không gây đơ lag giao diện main thread.
3. **Engine Phân Tích Markdown & QA Fuzzy Matcher:**
   - Xây dựng AST/Regex Parser thuần JavaScript biến cấu trúc Markdown tiêu chuẩn thành DOM elements.
   - QA Assistant sử dụng thuật toán chuẩn hóa tiếng Việt bỏ dấu (Tone Stripping) kết hợp khớp từ khóa đa luồng (Multi-token Keyword Scoring) để tìm kiếm chính xác ngữ cảnh báo cáo và câu hỏi.
4. **Tích hợp Backend Google Apps Script WebApp:**
   - Xử lý gửi nhận dữ liệu qua `doPost` (tiếp nhận phiếu khảo sát JSON) và `doGet` (xuất toàn bộ bảng dữ liệu dưới dạng JSON REST API).

---

### 💡 C. Bài Học Kinh Nghiệm (Key Lessons Learned)
1. **Quản Lý Vòng Đời PWA & Service Worker Cache:**
   - Hiểu rõ quy trình `Install` ➔ `Activate` ➔ `Fetch` giúp tránh được lỗi đệm (stale cache) khi cập nhật phiên bản mới của WebApp.
2. **Thiết Kế Schema-Less UI Hướng Tải Trọng (Driven UI):**
   - Bài học thiết kế giao diện động phụ thuộc dữ liệu cấu hình (Markdown-Driven UI) mang lại khả năng mở rộng cực lớn, giúp người dùng không có kiến thức lập trình cũng có thể tự thay đổi nội dung khảo sát.
3. **Xử Lý Kết Nối Ngoại Tuyến (Offline Resilience):**
   - Việc thiết kế cơ chế hàng chờ Offline trước khi gọi HTTP request giúp trải nghiệm ứng dụng hoàn toàn không bị đứt gãy dù mạng di động chập chờn.

---

## 3. FEATURE IMPLEMENTATION CHECKLIST
| # | Required Feature | Status | Implementation Details & Acceptance Level |
|:---:|---|:---:|---|
| 1 | **Responsive Mobile Viewport & PWA** | ✅ Complete | 100% Mobile-first UI, Web Manifest, Standalone mode, Full icons set. |
| 2 | **Dynamic Markdown Question Parsing** | ✅ Complete | Parses `questions.md` dynamically into interactive form elements. |
| 3 | **Local Offline Persistence (IndexedDB)** | ✅ Complete | Uses IndexedDB with 4 Object Stores for drafts, queue, and history. |
| 4 | **Automatic Background Sync & GSheet** | ✅ Complete | Auto-syncs offline queued payload to Google Sheets WebApp (`Code.gs`). |
| 5 | **Facility & Full Reports Lookup** | ✅ Complete | Full 18+ inspection reports search, filter chips (`🚨 Khẩn cấp`, `💻 Lab`). |
| 6 | **Smart QA Assistant Engine** | ✅ Complete | Intelligent Q&A answering queries based on `questions.md` & Sheet data. |

---

## 4. PROJECT STRUCTURE & CODE ORGANIZATION
```
FieldSurveyPWA/
├── index.html                   # Mobile-First App Shell Markup
├── index.css                    # Custom VKU Design Tokens & Micro-animations
├── manifest.json                # PWA Manifest Settings
├── sw.js                        # Service Worker (Cache-First + Stale-While-Revalidate)
├── questions.md                 # Dynamic Markdown Survey Configuration
├── vku_facility_inspection_data.csv # Full 18+ Inspection Dataset
├── icons/                       # PWA Icons (SVG, 192x192, 512x512, Apple Touch Icon)
├── js/
│   ├── app.js                   # Navigation, Event Handlers, Draft & Tab Logic
│   ├── mdParser.js              # Markdown-to-Form HTML Parser
│   ├── db.js                    # IndexedDB Store Helper & CSV Loader
│   ├── sync.js                  # Google Sheets WebApp API Manager
│   └── qaEngine.js              # Smart QA Assistant Fuzzy Engine
└── google-apps-script/
    └── Code.gs                  # Google Apps Script WebApp Backend (doPost & doGet)
```

---

## 5. EMPIRICAL EVIDENCE & SCREENSHOTS

![VKU Field Survey PWA Mobile Layout](file:///C:/Users/Asus/.gemini/antigravity-ide/brain/8b09c290-3ff0-46a5-9085-95f98b4291ce/vku_pwa_initial_1788400456253.png)
*Hình 1: Giao diện Form khảo sát Mobile-First tự động sinh từ questions.md*

![Trợ lý Q&A Thông minh trả lời tổng chi phí bảo trì](file:///C:/Users/Asus/.gemini/antigravity-ide/brain/8b09c290-3ff0-46a5-9085-95f98b4291ce/qa_assistant_result_1788406013976.png)
*Hình 2: Trợ lý Q&A thông minh phân tích câu hỏi và tính tổng chi phí 27.600.000 VNĐ*

![Tra cứu thành công báo cáo phòng A207](file:///C:/Users/Asus/.gemini/antigravity-ide/brain/8b09c290-3ff0-46a5-9085-95f98b4291ce/tra_cuu_a207_search_1788406430434.png)
*Hình 3: Mục Tra cứu hiển thị đầy đủ thông tin báo cáo phòng A207 (sửa ngay & phải sửa)*

---

## 6. TECHNICAL CHALLENGES & RESOLUTIONS

### Bottleneck 1: Dynamic Form Auto-save without Lag
- **Issue:** Auto-saving form state on every single keystroke was causing slight main thread freezes when serializing photo Base64 data.
- **Resolution:** Implemented image compression via HTML Canvas before storing photo data, and decoupled draft auto-saving with debounced inputs and asynchronous IndexedDB transactions.

### Bottleneck 2: Cross-Origin Fetching with Google Apps Script
- **Issue:** Google Apps Script WebApp endpoints redirect POST requests, which can trigger CORS issues in browser `fetch()` API.
- **Resolution:** Formatted HTTP POST requests with `Content-Type: text/plain;charset=utf-8` to allow clean transparent execution and graceful fallback to local IndexedDB queue when offline.
