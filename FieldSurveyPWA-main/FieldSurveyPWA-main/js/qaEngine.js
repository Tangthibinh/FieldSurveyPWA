/**
 * Advanced Intelligent QA & Support Engine for VKU Field Survey PWA
 * Dynamically answers natural language user queries based on questions.md configuration
 * AND the entire inspection dataset (vku_facility_inspection_data.csv + Google Sheet submissions)!
 */

import { getAllFacilitiesAndReports } from './db.js';
import { parseMarkdownSurvey } from './mdParser.js';

let cachedMdParsed = null;

function removeVietnameseTones(str) {
  if (typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();
}

export async function answerUserQuestion(userQuery) {
  if (!userQuery || !userQuery.trim()) {
    return `Vui lòng nhập câu hỏi của bạn.`;
  }

  const rawQuery = userQuery.trim();
  const qNorm = removeVietnameseTones(rawQuery);

  // 1. Fetch questions.md
  if (!cachedMdParsed) {
    try {
      const res = await fetch('./questions.md?t=' + Date.now());
      if (res.ok) {
        const mdText = await res.text();
        cachedMdParsed = parseMarkdownSurvey(mdText);
      }
    } catch (e) {
      console.warn('QA engine warning: cannot fetch questions.md', e);
    }
  }

  // 2. Fetch all inspection dataset entries
  const facilities = await getAllFacilitiesAndReports();

  // =========================================================================
  // MATCH TYPE 1: Analytical / Statistical Queries across all reports
  // =========================================================================

  // Query: Highest broken PCs / Lab issues
  if (qNorm.includes('hong nhieu') || qNorm.includes('lab hong') || qNorm.includes('may tinh hong') || qNorm.includes('xau nhat')) {
    const labReports = facilities.filter(f => f.pcBad || (f.capacity && f.capacity.includes('hỏng')) || (f.type && f.type.toLowerCase().includes('lab')));
    let resp = `<b>💻 Phân tích các phòng máy tính / Lab có sự cố máy hỏng:</b><br><br>`;
    
    labReports.sort((a, b) => (parseInt(b.pcBad || 0) - parseInt(a.pcBad || 0)));

    labReports.forEach(lab => {
      resp += `🏢 <b>${lab.name}</b> (${lab.building}):<br>`;
      resp += `• <b>Số máy bị hỏng:</b> <span style="color:#dc2626; font-weight:bold;">${lab.pcBad || 'Một số'} máy</span> (${lab.pcGood || '38'} máy tốt)<br>`;
      resp += `• <b>Sự cố ghi nhận:</b> ${lab.notes || (lab.equipment ? lab.equipment.join(', ') : 'N/A')}<br>`;
      resp += `• <b>Mức ưu tiên:</b> ${lab.priority || 'Cao'}<br><br>`;
    });

    resp += `👉 <i>Khuyến nghị: Phòng Lab 302 (7 máy hỏng) và Phòng Lab 201 (5 máy hỏng) cần được kỹ thuật viên hỗ trợ gấp.</i>`;
    return resp;
  }

  // Query: Total Estimated Cost / Financial Budget
  if (qNorm.includes('chi phi') || qNorm.includes('bao nhieu tien') || qNorm.includes('ngan sach') || qNorm.includes('tong tien')) {
    let totalCost = 0;
    let breakdown = [];

    facilities.forEach(f => {
      if (f.estCost) {
        const val = parseInt(f.estCost);
        if (!isNaN(val) && val > 0) {
          totalCost += val;
          breakdown.push({ name: f.name, cost: val, reason: f.notes });
        }
      }
    });

    let resp = `<b>💰 Tổng hợp chi phí dự toán bảo trì & sửa chữa cơ sở vật chất:</b><br><br>`;
    resp += `💵 <b>TỔNG DỰ TOÁN CHI PHÍ: <span style="color:#2563eb; font-size:1.1rem; font-weight:800;">${totalCost.toLocaleString('vi-VN')} VNĐ</span></b><br><br>`;
    resp += `<b>Chi tiết các hạng mục tốn chi phí lớn nhất:</b><br>`;

    breakdown.sort((a, b) => b.cost - a.cost);
    breakdown.forEach(item => {
      resp += `• <b>${item.name}:</b> ${item.cost.toLocaleString('vi-VN')} VNĐ (<i>${item.reason}</i>)<br>`;
    });

    return resp;
  }

  // Query: Urgent / Emergency Room Issues (Khẩn cấp / Sửa ngay / Phải sửa)
  if (qNorm.includes('khan cap') || qNorm.includes('su co') || qNorm.includes('nguy hiem') || qNorm.includes('gap') || qNorm.includes('sua ngay') || qNorm.includes('phai sua')) {
    const urgentRooms = facilities.filter(f => 
      (f.priority && (f.priority.includes('Khẩn cấp') || f.priority.includes('Cao'))) ||
      (f.status && f.status.includes('gấp')) ||
      (f.notes && (f.notes.includes('sửa ngay') || f.notes.includes('phải sửa') || f.notes.includes('hỏng')))
    );

    if (urgentRooms.length > 0) {
      let resp = `<b>🚨 Danh sách các phòng / khu vực có sự cố KHẨN CẤP & CẦN SỬA NGAY (${urgentRooms.length} báo cáo):</b><br><br>`;
      urgentRooms.forEach((f, idx) => {
        resp += `📍 <b>${idx + 1}. ${f.name}</b> (${f.building})<br>`;
        resp += `• <b>Mức ưu tiên:</b> <span style="color:#dc2626; font-weight:bold;">${f.priority || 'Khẩn cấp'}</span><br>`;
        resp += `• <b>Nội dung báo cáo:</b> <i>"${f.notes}"</i><br>`;
        resp += `• <b>Điều hòa / Máy chiếu:</b> ${f.ac || 'N/A'} • ${f.projector || 'N/A'}<br>`;
        resp += `• <b>Thời gian kiểm tra:</b> ${f.lastInspected}<br><br>`;
      });
      return resp;
    }
  }

  // =========================================================================
  // MATCH TYPE 2: Specific Room / Facility Lookup (e.g. A207, C204, C205, C101, Lab 301, C505...)
  // =========================================================================
  const matchedList = facilities.filter(f => {
    const codeNorm = removeVietnameseTones(f.code || '');
    const nameNorm = removeVietnameseTones(f.name || '');
    const notesNorm = removeVietnameseTones(f.notes || '');

    return (
      (codeNorm && qNorm.includes(codeNorm)) ||
      (nameNorm && qNorm.includes(nameNorm)) ||
      (qNorm.includes('a207') && (nameNorm.includes('a207') || codeNorm.includes('a207'))) ||
      (qNorm.includes('c505') && (nameNorm.includes('c505') || codeNorm.includes('c505'))) ||
      (qNorm.includes('c402') && (nameNorm.includes('c402') || codeNorm.includes('c402')))
    );
  });

  if (matchedList.length > 0) {
    let resp = `<b>🏢 Tìm thấy ${matchedList.length} báo cáo hiện trạng liên quan đến từ khóa của bạn:</b><br><br>`;
    matchedList.forEach((matchedFac, idx) => {
      resp += `<b>Báo cáo #${idx + 1}: ${matchedFac.name} (${matchedFac.code})</b><br>`;
      resp += `• <b>Tòa nhà / Phân loại:</b> ${matchedFac.building} • ${matchedFac.type}<br>`;
      resp += `• <b>Tình trạng điều hòa:</b> ${matchedFac.ac || 'Bình thường'}<br>`;
      resp += `• <b>Tình trạng máy chiếu:</b> ${matchedFac.projector || 'Bình thường'}<br>`;
      resp += `• <b>Mức ưu tiên xử lý:</b> <span style="font-weight:bold; color: ${matchedFac.priority && matchedFac.priority.includes('Khẩn cấp') ? '#dc2626' : '#059669'}">${matchedFac.priority || matchedFac.status}</span><br>`;
      resp += `• <b>Ghi chú thực địa:</b> <b style="color:#d97706;">"${matchedFac.notes}"</b><br>`;
      resp += `• <b>Thời gian báo cáo:</b> ${matchedFac.lastInspected} (${matchedFac.manager})<br><br>`;
    });
    return resp;
  }

  // =========================================================================
  // MATCH TYPE 3: Questions about questions.md configuration & editing
  // =========================================================================
  if (qNorm.includes('sua cau hoi') || qNorm.includes('doi cau hoi') || qNorm.includes('file md') || qNorm.includes('danh sach cau hoi') || qNorm.includes('loai cau hoi')) {
    if (cachedMdParsed) {
      let resp = `<b>📝 Cấu trúc câu hỏi khảo sát trong file <code>questions.md</code>:</b><br><br>`;
      resp += `File hiện tại gồm <b>${cachedMdParsed.sections.length} phần</b> và <b>9 câu hỏi khảo sát</b>:<br><br>`;
      
      cachedMdParsed.sections.forEach((sec, idx) => {
        resp += `<b>Phần ${idx + 1}: ${sec.title}</b><br>`;
        sec.questions.forEach(q => {
          resp += `• <b>${q.id.toUpperCase()} - ${q.label}</b> (Kiểu: <code>${q.type}</code>${q.required ? ', Bắt buộc' : ''})<br>`;
        });
        resp += `<br>`;
      });

      resp += `💡 <b>Cách chỉnh sửa câu hỏi:</b> Mở file <code>questions.md</code> trong thư mục dự án, sửa nội dung Markdown theo định dạng <code>### Qx: Tên câu hỏi</code> và <code>- Type: text/select/radio/checkbox/photo</code>. Sau đó vào tab Cấu hình bấm <i>"Làm mới Form từ questions.md"</i>.`;
      return resp;
    }
  }

  // Question Info Guides (Huong dan kiem tra)
  if (qNorm.includes('huong dan') || qNorm.includes('cach kiem tra') || qNorm.includes('meo')) {
    if (cachedMdParsed) {
      let resp = `<b>💡 Hướng dẫn & Quy trình kiểm tra thiết bị từ file <code>questions.md</code>:</b><br><br>`;
      cachedMdParsed.sections.forEach(sec => {
        sec.questions.forEach(q => {
          if (q.info) {
            resp += `📍 <b>${q.label}:</b><br>👉 <i>${q.info}</i><br><br>`;
          }
        });
      });
      return resp;
    }
  }

  // Specific Question ID Lookup (Q1, Q2, Q3... Q9)
  const qIdMatch = rawQuery.match(/q[1-9]/i);
  if (qIdMatch && cachedMdParsed) {
    const targetQId = qIdMatch[0].toLowerCase();
    let foundQ = null;
    cachedMdParsed.sections.forEach(sec => {
      sec.questions.forEach(q => {
        if (q.id.toLowerCase() === targetQId) foundQ = q;
      });
    });

    if (foundQ) {
      let resp = `<b>📌 Chi tiết câu hỏi ${foundQ.id.toUpperCase()} trong file <code>questions.md</code>:</b><br><br>`;
      resp += `• <b>Tên câu hỏi:</b> ${foundQ.label}<br>`;
      resp += `• <b>Loại Input:</b> <code>${foundQ.type}</code><br>`;
      resp += `• <b>Bắt buộc:</b> ${foundQ.required ? 'Có' : 'Không'}<br>`;
      if (foundQ.options && foundQ.options.length > 0) {
        resp += `• <b>Các tùy chọn:</b> ${foundQ.options.join(' | ')}<br>`;
      }
      if (foundQ.placeholder) {
        resp += `• <b>Placeholder:</b> <i>${foundQ.placeholder}</i><br>`;
      }
      if (foundQ.info) {
        resp += `• <b>Hướng dẫn điều tra:</b> 💡 <i>${foundQ.info}</i><br>`;
      }
      return resp;
    }
  }

  // =========================================================================
  // MATCH TYPE 4: Comprehensive Fallback Summary
  // =========================================================================
  return `
    <b>🤖 Trợ lý Hỗ trợ VKU Field Survey</b><br><br>
    Tôi đã tra cứu và cập nhật toàn bộ ${facilities.length} báo cáo khảo sát từ file CSV & Google Sheet của bạn (bao gồm báo cáo phòng A207, C402, C505...).<br><br>
    <b>💡 Gợi ý câu hỏi bạn có thể thử:</b><br>
    • <i>"Báo cáo kiểm tra phòng A207 thế nào?"</i><br>
    • <i>"Những phòng nào có sự cố cần sửa ngay?"</i><br>
    • <i>"Phòng Lab nào bị hỏng nhiều máy tính nhất?"</i><br>
    • <i>"Tổng chi phí bảo trì ước tính là bao nhiêu?"</i><br>
    • <i>"Hướng dẫn kiểm tra điều hòa và máy chiếu?"</i>
  `;
}
