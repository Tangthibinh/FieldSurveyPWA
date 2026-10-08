/**
 * Main Application Logic for VKU Field Survey PWA
 * Handles Tab navigation, Form rendering, Draft auto-save, CSV Dataset Loading,
 * Facility Reports Lookup, QA Assistant Engine, PWA installation, and Offline Sync notifications.
 */

import { parseMarkdownSurvey, renderSurveyFormHTML } from './mdParser.js';
import { 
  saveDraft, getDraft, clearDraft, 
  getPendingSyncList, getSurveyHistory, 
  loadAndSeedCSVDataset, getAllFacilitiesAndReports 
} from './db.js';
import { submitSurveyData, syncPendingQueue, getGSheetEndpoint, setGSheetEndpoint } from './sync.js';
import { answerUserQuestion } from './qaEngine.js';
import { captureNativePhoto, enablePushNotifications, getCurrentLocation, saveNativePhoto } from './nativeBridge.js';

let parsedSurveyData = null;
let deferredInstallPrompt = null;
let currentDraftData = {};
let activeFacilityFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  setupNavigation();
  setupOnlineOfflineListeners();
  setupPWAInstall();
  setupSettingsTab();

  // Load and seed full CSV inspection dataset (vku_facility_inspection_data.csv)
  await loadAndSeedCSVDataset();

  // Register Service Worker
  registerServiceWorker();

  // Load Survey Questions from questions.md
  await loadSurveyQuestions();

  // Load Saved Draft
  await loadDraftState();

  // Load Offline Queue & History View
  await updateSyncBadgesAndQueueView();

  // Render Facility & Full Reports Lookup View
  await renderFacilityLookup('', activeFacilityFilter);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW Registered successfully:', reg.scope))
        .catch(err => console.warn('SW Registration failed:', err));
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'TRIGGER_SYNC') {
        handleManualSync();
      }
    });
  }
}

async function loadSurveyQuestions() {
  const container = document.getElementById('survey_form_container');
  if (!container) return;

  try {
    container.innerHTML = `<div class="loading-spinner">⏳ Đang tải file cấu hình câu hỏi questions.md...</div>`;
    
    const res = await fetch('./questions.md?t=' + Date.now());
    if (!res.ok) throw new Error('Cannot load questions.md');
    
    const mdText = await res.text();
    parsedSurveyData = parseMarkdownSurvey(mdText);

    container.innerHTML = renderSurveyFormHTML(parsedSurveyData, currentDraftData);
    attachFormAutoSaveListeners();

  } catch (err) {
    console.error('Failed loading survey questions:', err);
    container.innerHTML = `
      <div class="alert alert-error">
        ❌ <b>Lỗi tải câu hỏi:</b> Không thể đọc file <code>questions.md</code>. Vui lòng kiểm tra lại file.
      </div>
    `;
  }
}

window.reloadQuestionsFromFile = async function() {
  showToast('🔄 Đang làm mới bảng câu hỏi từ file questions.md...');
  await loadSurveyQuestions();
  showToast('✅ Đã cập nhật xong form khảo sát mới!');
};

function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabViews = document.querySelectorAll('.tab-view');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      navBtns.forEach(b => b.classList.remove('active'));
      tabViews.forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      const targetView = document.getElementById(`tab_${targetTab}`);
      if (targetView) targetView.classList.add('active');

      if (targetTab === 'queue') {
        updateSyncBadgesAndQueueView();
      } else if (targetTab === 'lookup') {
        renderFacilityLookup('', activeFacilityFilter);
      }
    });
  });
}

function setupOnlineOfflineListeners() {
  const statusBadge = document.getElementById('network_status_badge');
  
  function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    if (statusBadge) {
      if (isOnline) {
        statusBadge.className = 'status-badge online';
        statusBadge.innerHTML = '🟢 Online';
      } else {
        statusBadge.className = 'status-badge offline';
        statusBadge.innerHTML = '🔴 Offline';
      }
    }

    if (isOnline) {
      handleAutoSyncOnConnect();
    }
  }

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();
}

async function handleAutoSyncOnConnect() {
  const pending = await getPendingSyncList();
  if (pending.length > 0) {
    const result = await syncPendingQueue((msg) => showToast(msg));
    if (result.synced > 0) {
      showToast(`🎉 Tự động đồng bộ thành công ${result.synced} phiếu khảo sát offline!`);
    }
    await updateSyncBadgesAndQueueView();
  }
}

window.handleManualSync = async function() {
  const syncBtn = document.getElementById('btn_manual_sync');
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.innerText = '🔄 Đang đồng bộ...';
  }

  const result = await syncPendingQueue((msg) => showToast(msg));

  if (result.total === 0) {
    showToast('ℹ️ Không có bài khảo sát nào đang chờ đồng bộ.');
  } else if (result.synced > 0) {
    showToast(`✅ Đã đồng bộ thành công ${result.synced}/${result.total} phiếu điều tra lên Google Sheets!`);
  } else {
    showToast('⚠️ Đồng bộ thất bại. Vui lòng kiểm tra lại URL Google Sheets WebApp.');
  }

  if (syncBtn) {
    syncBtn.disabled = false;
    syncBtn.innerText = '⚡ Đồng bộ ngay lên Google Sheets';
  }

  await updateSyncBadgesAndQueueView();
  await renderFacilityLookup('', activeFacilityFilter);
};

function setupPWAInstall() {
  const installBanner = document.getElementById('pwa_install_banner');
  const installBtn = document.getElementById('btn_install_pwa');
  const closeBtn = document.getElementById('btn_close_install_banner');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBanner) installBanner.classList.remove('hidden');
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (installBanner) installBanner.classList.add('hidden');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (installBanner) installBanner.classList.add('hidden');
    });
  }
}

function setupSettingsTab() {
  const gsheetInput = document.getElementById('gsheet_endpoint_input');
  const saveBtn = document.getElementById('btn_save_gsheet_url');
  const currentUrl = getGSheetEndpoint();

  if (gsheetInput) gsheetInput.value = currentUrl;

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const url = gsheetInput ? gsheetInput.value : '';
      setGSheetEndpoint(url);
      showToast('✅ Đã lưu cấu hình Google Sheet WebApp!');
    });
  }

  const pushBtn = document.getElementById('btn_enable_push');
  if (pushBtn) {
    pushBtn.addEventListener('click', async () => {
      pushBtn.disabled = true;
      const result = await enablePushNotifications();
      showToast(result.message);
      pushBtn.disabled = false;
    });
  }
}

function attachFormAutoSaveListeners() {
  const form = document.getElementById('main_survey_form');
  if (!form) return;

  form.addEventListener('input', () => saveCurrentFormToDraft());
  form.addEventListener('change', () => saveCurrentFormToDraft());
  form.addEventListener('submit', handleFormSubmit);
}

function collectFormData() {
  const form = document.getElementById('main_survey_form');
  if (!form) return {};

  const formData = new FormData(form);
  const data = {};

  for (let [key, val] of formData.entries()) {
    if (key.endsWith('_dataurl')) continue;

    if (data[key]) {
      if (Array.isArray(data[key])) {
        data[key].push(val);
      } else {
        data[key] = [data[key], val];
      }
    } else {
      data[key] = val;
    }
  }

  Object.keys(data).forEach(k => {
    if (Array.isArray(data[k])) {
      data[k] = data[k].join(', ');
    }
  });

  const photoInputs = form.querySelectorAll('input[type="hidden"][name$="_dataurl"]');
  photoInputs.forEach(input => {
    const rawKey = input.name.replace('_dataurl', '');
    if (input.value) {
      data[rawKey + '_photo'] = input.value;
    }
  });

  return data;
}

async function saveCurrentFormToDraft() {
  const data = collectFormData();
  currentDraftData = data;
  await saveDraft(data);
  const draftBadge = document.getElementById('draft_status_indicator');
  if (draftBadge) {
    draftBadge.innerText = '💾 Đã tự động lưu nháp: ' + new Date().toLocaleTimeString();
  }
}

async function loadDraftState() {
  const draft = await getDraft();
  if (draft) {
    currentDraftData = draft;
  }
}

window.handleClearFormDraft = async function() {
  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ thông tin bản nháp hiện tại?')) {
    await clearDraft();
    currentDraftData = {};
    const form = document.getElementById('main_survey_form');
    if (form) form.reset();
    
    const previews = document.querySelectorAll('.photo-preview-container');
    previews.forEach(p => p.classList.add('hidden'));

    showToast('🗑️ Đã xóa bản nháp!');
    await loadSurveyQuestions();
  }
};

window.handlePhotoUpload = function(questionId, event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);

      const previewImg = document.getElementById(`preview_${questionId}`);
      const previewContainer = document.getElementById(`preview_container_${questionId}`);
      const hiddenInput = document.getElementById(`${questionId}_dataurl`);

      if (previewImg) previewImg.src = compressedDataUrl;
      if (previewContainer) previewContainer.classList.remove('hidden');
      if (hiddenInput) hiddenInput.value = compressedDataUrl;

      saveCurrentFormToDraft();
      showToast('📸 Đã chụp/tải ảnh thành công!');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.capturePhotoNative = async function(questionId) {
  try {
    const dataUrl = await captureNativePhoto();
    if (!dataUrl) {
      document.getElementById(questionId)?.click();
      return;
    }

    const previewImg = document.getElementById(`preview_${questionId}`);
    const previewContainer = document.getElementById(`preview_container_${questionId}`);
    const hiddenInput = document.getElementById(`${questionId}_dataurl`);
    if (previewImg) previewImg.src = dataUrl;
    if (previewContainer) previewContainer.classList.remove('hidden');
    if (hiddenInput) hiddenInput.value = dataUrl;

    await saveNativePhoto(dataUrl, `survey-${Date.now()}`);
    await saveCurrentFormToDraft();
    showToast('📸 Đã chụp và lưu ảnh trên thiết bị!');
  } catch (error) {
    console.warn('Native camera unavailable:', error);
    showToast('Không thể mở camera native, hãy thử tải ảnh từ thiết bị.');
  }
};

window.removePhoto = function(questionId) {
  const previewContainer = document.getElementById(`preview_container_${questionId}`);
  const hiddenInput = document.getElementById(`${questionId}_dataurl`);
  const fileInput = document.getElementById(questionId);

  if (previewContainer) previewContainer.classList.add('hidden');
  if (hiddenInput) hiddenInput.value = '';
  if (fileInput) fileInput.value = '';

  saveCurrentFormToDraft();
  showToast('🗑️ Đã xóa ảnh.');
};

window.toggleQuestionInfo = function(qid) {
  const infoBox = document.getElementById(`info_${qid}`);
  if (infoBox) {
    infoBox.classList.toggle('hidden');
  }
};

async function handleFormSubmit(e) {
  e.preventDefault();

  const data = collectFormData();

  const submitBtn = document.getElementById('btn_submit_survey');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = '⌛ Đang xử lý...';
  }

  const location = await getCurrentLocation();
  const payload = {
    id: 'VKU-SRV-' + Date.now(),
    timestamp: new Date().toLocaleString('vi-VN'),
    surveyor: 'Người điều tra VKU',
    location,
    data: data
  };

  const res = await submitSurveyData(payload, (msg) => showToast(msg));

  if (res.success) {
    showToast(res.message);
    await clearDraft();
    currentDraftData = {};

    const form = document.getElementById('main_survey_form');
    if (form) form.reset();
    const previews = document.querySelectorAll('.photo-preview-container');
    previews.forEach(p => p.classList.add('hidden'));

    await updateSyncBadgesAndQueueView();
    // Instantly refresh Tra cứu tab so new form report is visible!
    await renderFacilityLookup('', activeFacilityFilter);
  } else {
    showToast('❌ Gửi bài thất bại: ' + res.message);
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerText = '🚀 Gửi bài điều tra ngay';
  }
}

async function updateSyncBadgesAndQueueView() {
  const pendingList = await getPendingSyncList();
  const historyList = await getSurveyHistory();

  const queueBadge = document.getElementById('queue_count_badge');
  if (queueBadge) {
    queueBadge.innerText = pendingList.length;
    queueBadge.className = pendingList.length > 0 ? 'badge badge-warning' : 'badge badge-gray';
  }

  const queueListContainer = document.getElementById('pending_queue_container');
  if (queueListContainer) {
    if (pendingList.length === 0) {
      queueListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✅</div>
          <div class="empty-title">Không có phiếu điều tra nào đang chờ</div>
          <div class="empty-desc">Tất cả dữ liệu khảo sát đã được đồng bộ an toàn lên hệ thống.</div>
        </div>
      `;
    } else {
      let queueHTML = `<div class="card-list">`;
      pendingList.forEach((item, idx) => {
        queueHTML += `
          <div class="history-item pending-card">
            <div class="history-header">
              <span class="history-title">📌 Phiếu khảo sát #${idx + 1} (${item.id})</span>
              <span class="badge badge-warning">⏳ Chờ gửi</span>
            </div>
            <div class="history-time">📅 Thời gian: ${item.timestamp}</div>
            <div class="history-data-preview">
              <b>Vị trí:</b> ${escapeHTML(item.data ? item.data.q1 : 'N/A')}<br>
              <b>Khu vực:</b> ${escapeHTML(item.data ? item.data.q2 : 'N/A')}<br>
              <b>Ưu tiên:</b> ${escapeHTML(item.data ? item.data.q7 : 'N/A')}
            </div>
          </div>
        `;
      });
      queueHTML += `</div>`;
      queueListContainer.innerHTML = queueHTML;
    }
  }

  const historyContainer = document.getElementById('survey_history_container');
  if (historyContainer) {
    if (historyList.length === 0) {
      historyContainer.innerHTML = `<div class="empty-state-sm">Chưa có lịch sử khảo sát nào.</div>`;
    } else {
      let histHTML = `<div class="card-list">`;
      historyList.forEach((item) => {
        histHTML += `
          <div class="history-item success-card">
            <div class="history-header">
              <span class="history-title">✅ ${item.id}</span>
              <span class="badge badge-success">${item.mock ? 'Thử nghiệm' : 'Đã đồng bộ'}</span>
            </div>
            <div class="history-time">📅 Đã gửi lúc: ${item.syncedAt || item.timestamp}</div>
            <div class="history-data-preview">
              <b>Vị trí:</b> ${escapeHTML(item.data ? item.data.q1 : 'N/A')}<br>
              <b>Nội dung:</b> ${escapeHTML(item.data ? item.data.q3 || item.data.q9 : 'Hoàn tất')}
            </div>
          </div>
        `;
      });
      histHTML += `</div>`;
      historyContainer.innerHTML = histHTML;
    }
  }
}

/**
 * Render All Facility & Inspection Dataset Reports
 */
async function renderFacilityLookup(query = '', filter = 'all') {
  const container = document.getElementById('facility_lookup_container');
  if (!container) return;

  const facilities = await getAllFacilitiesAndReports(query, filter);

  if (facilities.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Không tìm thấy báo cáo/cơ sở nào phù hợp</div>
        <div class="empty-desc">Thử tìm với từ khóa khác như "C204", "Lab", "KTX", "Khẩn cấp"...</div>
      </div>
    `;
    return;
  }

  let html = `<div style="font-size:0.82rem; color:#64748b; margin-bottom:12px; font-weight:600;">Hiển thị tổng cộng ${facilities.length} báo cáo khảo sát & cơ sở vật chất:</div>`;
  html += `<div class="facility-grid">`;
  
  facilities.forEach(fac => {
    const isUrgent = (fac.status && (fac.status.includes('gấp') || fac.status.includes('trì'))) || 
                     (fac.priority && (fac.priority.includes('Khẩn cấp') || fac.priority.includes('Cao')));

    html += `
      <div class="facility-card ${isUrgent ? 'card-urgent' : ''}">
        <div class="facility-header">
          <div class="facility-code-badge">${escapeHTML(fac.code || fac.id)}</div>
          <span class="facility-status-pill ${isUrgent ? 'status-warn' : 'status-ok'}">
            ${escapeHTML(fac.status || 'Đã kiểm tra')}
          </span>
        </div>

        <h3 class="facility-name">${escapeHTML(fac.name)}</h3>
        <div class="facility-building">🏢 ${escapeHTML(fac.building)} • Sức chứa: ${escapeHTML(fac.capacity)}</div>

        <div class="facility-details">
          <div class="facility-field"><b>👤 Người kiểm tra / Quản lý:</b> ${escapeHTML(fac.manager)} ${fac.phone ? `(${escapeHTML(fac.phone)})` : ''}</div>
          <div class="facility-field"><b>📅 Thời gian báo cáo:</b> ${escapeHTML(fac.lastInspected)}</div>
          
          ${fac.priority ? `<div class="facility-field"><b>🚨 Mức ưu tiên:</b> <span class="badge ${isUrgent ? 'badge-warning' : 'badge-success'}">${escapeHTML(fac.priority)}</span></div>` : ''}

          ${fac.projector ? `<div class="facility-field"><b>📽️ Máy chiếu:</b> ${escapeHTML(fac.projector)}</div>` : ''}
          ${fac.ac ? `<div class="facility-field"><b>❄️ Điều hòa:</b> ${escapeHTML(fac.ac)}</div>` : ''}
          ${fac.estCost && parseInt(fac.estCost) > 0 ? `<div class="facility-field"><b>💵 Dự toán sửa chữa:</b> <span style="color:#d97706; font-weight:bold;">${parseInt(fac.estCost).toLocaleString('vi-VN')} VNĐ</span></div>` : ''}

          ${fac.equipment && fac.equipment.length > 0 ? `
            <div class="equipment-box">
              <div class="equipment-title">📦 Chi tiết trang thiết bị:</div>
              <ul class="equipment-list">
                ${fac.equipment.map(eq => `<li>✓ ${escapeHTML(eq)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="facility-notes">
            <b>💡 Ghi chú khảo sát:</b> ${escapeHTML(fac.notes)}
          </div>

          ${fac.photo ? `
            <div style="margin-top: 8px;">
              <b>📷 Ảnh minh chứng thực địa:</b><br>
              <img src="${fac.photo}" style="max-width:100%; max-height:160px; border-radius:8px; margin-top:4px;" alt="Ảnh minh chứng">
            </div>
          ` : ''}
        </div>

        <button type="button" class="btn-use-facility" onclick="prefillFacilityToForm('${escapeHTML(fac.code)}', '${escapeHTML(fac.name)}')">
          📝 Khảo sát phòng này
        </button>
      </div>
    `;
  });
  html += `</div>`;

  container.innerHTML = html;
}

window.setFacilityFilter = function(filterType, element) {
  activeFacilityFilter = filterType;

  const chips = document.querySelectorAll('.filter-chip');
  chips.forEach(c => c.classList.remove('active'));
  if (element) element.classList.add('active');

  const searchInput = document.getElementById('facility_search_input');
  const query = searchInput ? searchInput.value : '';
  renderFacilityLookup(query, activeFacilityFilter);
};

window.handleFacilitySearchInput = function(e) {
  const query = e.target.value;
  renderFacilityLookup(query, activeFacilityFilter);
};

window.prefillFacilityToForm = function(code, name) {
  const formTabBtn = document.querySelector('.nav-btn[data-tab="form"]');
  if (formTabBtn) formTabBtn.click();

  setTimeout(() => {
    const q1Input = document.getElementById('q1');
    if (q1Input) {
      q1Input.value = `${code} - ${name}`;
      saveCurrentFormToDraft();
      showToast(`📝 Đã tự động điền vị trí ${code} vào form khảo sát!`);
    }
  }, 100);
};

/**
 * QA Assistant Engine Support Handlers
 */
window.submitUserQAQuery = async function() {
  const input = document.getElementById('qa_user_input');
  if (!input || !input.value.trim()) return;

  const query = input.value.trim();
  await executeQA(query);
  input.value = '';
};

window.askAssistantQuestion = async function(query) {
  const input = document.getElementById('qa_user_input');
  if (input) input.value = query;
  await executeQA(query);
};

async function executeQA(query) {
  const responseCard = document.getElementById('assistant_response_card');
  const responseContent = document.getElementById('assistant_response_content');

  if (responseCard) responseCard.classList.remove('hidden');
  if (responseContent) responseContent.innerHTML = `<div class="loading-spinner">⏳ Trợ lý đang tra cứu dữ liệu...</div>`;

  const answer = await answerUserQuestion(query);

  if (responseContent) {
    responseContent.innerHTML = answer;
  }
}

function showToast(message) {
  const toast = document.getElementById('toast_notification');
  if (!toast) return;

  toast.innerText = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function escapeHTML(str) {
  if (typeof str !== 'string') return str || '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
