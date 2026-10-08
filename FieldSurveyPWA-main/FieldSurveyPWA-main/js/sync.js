/**
 * Google Sheets Web App Synchronization Manager
 * Handles online/offline network state, posting survey data to GSheets,
 * and auto-synchronizing pending offline records from IndexedDB.
 */

import { addPendingSync, getPendingSyncList, removePendingSync, saveToHistory } from './db.js';

const STORAGE_KEY_GSHEET_URL = 'VKU_SURVEY_GSHEET_WEBAPP_URL';
const MOCK_ENDPOINT_FLAG = 'MOCK_ENDPOINT_ACTIVE';

// Default demo endpoint placeholder or mock fallback
let gsheetUrl = localStorage.getItem(STORAGE_KEY_GSHEET_URL) || '';

export function getGSheetEndpoint() {
  return gsheetUrl;
}

export function setGSheetEndpoint(url) {
  gsheetUrl = url.trim();
  localStorage.setItem(STORAGE_KEY_GSHEET_URL, gsheetUrl);
}

/**
 * Submit survey response payload
 * @param {Object} payload Survey form data
 * @param {Function} onStatusUpdate Optional callback for status messages
 */
export async function submitSurveyData(payload, onStatusUpdate = () => {}) {
  const isOnline = navigator.onLine;

  if (!isOnline) {
    onStatusUpdate('⚠️ Đang offline: Lưu bài khảo sát vào Hàng chờ đồng bộ IndexedDB...');
    const pendingItem = await addPendingSync(payload);
    return {
      success: true,
      offline: true,
      message: 'Đã lưu vào bộ nhớ offline! Bài khảo sát sẽ tự động gửi lên Google Sheets khi có kết nối mạng.',
      item: pendingItem
    };
  }

  // If Online, attempt HTTP POST to Google Sheets Web App
  try {
    onStatusUpdate('🌐 Đang kết nối tới Google Sheets WebApp...');

    let response;
    if (gsheetUrl && gsheetUrl.startsWith('http')) {
      // Real Google Apps Script WebApp Call
      // Use no-cors or standard text mode depending on GAS setup
      response = await fetch(gsheetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok && response.type !== 'opaque') {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      // Record to history
      await saveToHistory(payload);

      return {
        success: true,
        offline: false,
        message: '✅ Đã gửi bài khảo sát thành công lên Google Sheets!'
      };
    } else {
      // Mock Backend Simulation (when Google Sheet URL is not configured yet)
      await new Promise(r => setTimeout(r, 800)); // Simulate network latency

      await saveToHistory({ ...payload, mock: true });

      return {
        success: true,
        offline: false,
        mock: true,
        message: '✅ [Chế độ thử nghiệm] Khảo sát đã được xử lý! (Vui lòng dán URL Google Sheet WebApp trong tab Cấu hình để lưu thực tế)'
      };
    }
  } catch (err) {
    console.warn('Network submit failed, falling back to offline queue:', err);
    onStatusUpdate('⚠️ Gửi trực tuyến thất bại. Đang lưu bài khảo sát vào Hàng chờ Offline...');
    const pendingItem = await addPendingSync(payload);
    return {
      success: true,
      offline: true,
      error: err.message,
      message: 'Đã chuyển vào Hàng chờ Offline do lỗi kết nối. Sẽ tự động thử lại sau!',
      item: pendingItem
    };
  }
}

/**
 * Synchronize all pending items in IndexedDB queue to Google Sheets
 */
export async function syncPendingQueue(onProgress = () => {}) {
  const pendingItems = await getPendingSyncList();
  if (pendingItems.length === 0) {
    return { total: 0, synced: 0, failed: 0 };
  }

  onProgress(`🔄 Đang đồng bộ ${pendingItems.length} phiếu điều tra offline...`);

  let synced = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      if (gsheetUrl && gsheetUrl.startsWith('http')) {
        const resp = await fetch(gsheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(item)
        });
        if (!resp.ok && resp.type !== 'opaque') {
          throw new Error(`Server returned ${resp.status}`);
        }
      } else {
        // Mock sync
        await new Promise(r => setTimeout(r, 400));
      }

      // Save to history & remove from queue
      await saveToHistory({ ...item, syncedOffline: true });
      await removePendingSync(item.id);
      synced++;

    } catch (err) {
      console.error(`Failed to sync item ${item.id}:`, err);
      failed++;
    }
  }

  const resultMsg = `Đã đồng bộ xong ${synced}/${pendingItems.length} phiếu khảo sát!`;
  onProgress(resultMsg);

  return { total: pendingItems.length, synced, failed };
}
