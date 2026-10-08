/**
 * Google Apps Script WebApp Backend for VKU Field Survey PWA
 * 
 * HƯỚNG DẪN CÀI ĐẶT BẰNG GOOGLE SHEETS:
 * 1. Mở file Google Sheet của bạn -> Chọn menu 'Mở rộng' (Extensions) -> 'Apps Script'.
 * 2. Xóa hết mã mặc định và dán toàn bộ đoạn code bên dưới vào.
 * 3. Nhấn 'Lưu' (Ctrl+S).
 * 4. Nhấn nút 'Triển khai' (Deploy) -> 'Triển khai dưới dạng ứng dụng web' (New deployment).
 * 5. Mục 'Người có quyền truy cập' (Who has access) -> Chọn 'Bất kỳ ai' (Anyone).
 * 6. Copy URL WebApp tạo ra và dán vào tab 'Cấu hình' trên ứng dụng VKU Field Survey PWA.
 */

function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000);

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Parse JSON Payload
    var postData = JSON.parse(e.postData.contents);
    var data = postData.data || {};

    // Ensure Headers exist
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Mã Phiếu (ID)",
        "Thời Gian Gửi",
        "Người Điều Tra",
        "Tòa Nhà & Phòng (Q1)",
        "Loại Khu Vực (Q2)",
        "Tình Trạng Máy Chiếu (Q3)",
        "Hệ Thống Điều Hòa (Q4)",
        "Số Máy Lab (Q5)",
        "Sự Cố Bàn Ghế/Đèn (Q6)",
        "Mức Ưu Tiên (Q7)",
        "Có Ảnh Minh Chứng (Q8)",
        "Ghi Chú Chi Tiết (Q9)"
      ]);

      // Format Header Row
      var headerRange = sheet.getRange(1, 1, 1, 12);
      headerRange.setBackground("#1e3a8a");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
    }

    var hasPhoto = (data.q8_photo || data.photo) ? "Có (Base64)" : "Không";

    // Prepare Data Row
    var newRow = [
      postData.id || ("SRV-" + new Date().getTime()),
      postData.timestamp || new Date().toLocaleString(),
      postData.surveyor || "Người điều tra VKU",
      data.q1 || "",
      data.q2 || "",
      data.q3 || "",
      data.q4 || "",
      data.q5 || "",
      data.q6 || "",
      data.q7 || "",
      hasPhoto,
      data.q9 || ""
    ];

    // Append Row
    sheet.appendRow(newRow);

    lock.releaseLock();

    return ContentService.createTextOutput(JSON.stringify({
      result: "success",
      message: "Đã ghi nhận dữ liệu điều tra thành công vào Google Sheet!",
      row: sheet.getLastRow()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }

    var headers = data[0];
    var rows = [];

    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      rows.push(row);
    }

    return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
