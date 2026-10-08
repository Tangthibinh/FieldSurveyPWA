/**
 * IndexedDB Storage Helper for VKU Field Survey PWA
 * Handles offline survey storage, CSV data loading, pending sync queue,
 * dynamic facility reports lookup, and QA knowledge support.
 */

const DB_NAME = 'VKU_Field_Survey_DB';
const DB_VERSION = 3;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('pending_sync')) {
        const syncStore = db.createObjectStore('pending_sync', { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('survey_history')) {
        const historyStore = db.createObjectStore('survey_history', { keyPath: 'id' });
        historyStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('facility_cache')) {
        const facilityStore = db.createObjectStore('facility_cache', { keyPath: 'code' });
        facilityStore.createIndex('building', 'building', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });

  return dbPromise;
}

// Draft Operations
export async function saveDraft(draftData) {
  const data = { id: 'current_draft', ...draftData, updatedAt: new Date().toISOString() };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite');
    const store = tx.objectStore('drafts');
    store.put(data);
    tx.oncomplete = () => resolve(data);
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getDraft() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('drafts', 'readonly');
    const store = tx.objectStore('drafts');
    const req = store.get('current_draft');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export async function clearDraft() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('drafts', 'readwrite');
    const store = tx.objectStore('drafts');
    store.delete('current_draft');
    tx.oncomplete = () => resolve(true);
  });
}

// Pending Sync Queue Operations
export async function addPendingSync(surveyPayload) {
  const item = {
    ...surveyPayload,
    timestamp: surveyPayload.timestamp || new Date().toLocaleString('vi-VN'),
    status: 'pending',
    attempts: 0
  };
  const db = await openDB();
  
  // Update facility cache immediately so Tra Cứu updates even offline!
  await updateFacilityCacheFromSurvey(item);

  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_sync', 'readwrite');
    const store = tx.objectStore('pending_sync');
    const req = store.add(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getPendingSyncList() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('pending_sync', 'readonly');
    const store = tx.objectStore('pending_sync');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []).reverse());
    req.onerror = () => resolve([]);
  });
}

export async function removePendingSync(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('pending_sync', 'readwrite');
    const store = tx.objectStore('pending_sync');
    store.delete(id);
    tx.oncomplete = () => resolve(true);
  });
}

// Survey History Operations
export async function saveToHistory(surveyRecord) {
  const record = {
    id: surveyRecord.id || 'VKU-SRV-' + Date.now(),
    ...surveyRecord,
    syncedAt: new Date().toLocaleString('vi-VN')
  };
  const db = await openDB();
  
  await updateFacilityCacheFromSurvey(record);

  return new Promise((resolve) => {
    const tx = db.transaction('survey_history', 'readwrite');
    const store = tx.objectStore('survey_history');
    store.put(record);
    tx.oncomplete = () => resolve(record);
  });
}

export async function getSurveyHistory() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('survey_history', 'readonly');
    const store = tx.objectStore('survey_history');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []).reverse());
    req.onerror = () => resolve([]);
  });
}

// Load and Parse CSV dataset vku_facility_inspection_data.csv automatically
export async function loadAndSeedCSVDataset() {
  try {
    const res = await fetch('./vku_facility_inspection_data.csv?t=' + Date.now());
    if (!res.ok) return;

    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) return;

    const headers = lines[0].split(',').map(h => h.trim());
    const csvFacilities = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 5) continue;

      const id = cols[0];
      const timestamp = cols[1];
      const surveyor = cols[2];
      const building = cols[3];
      const name = cols[4];
      const type = cols[5];
      const projector = cols[6];
      const ac = cols[7];
      const pcGood = cols[8];
      const pcBad = cols[9];
      const furniture = cols[10];
      const priority = cols[11];
      const hasPhoto = cols[12];
      const estCost = cols[13];
      const rating = cols[14];
      const notes = cols[15];

      let status = 'Đã kiểm tra';
      if (priority === 'Khẩn cấp' || priority === 'Cao' || (pcBad && parseInt(pcBad) > 0)) {
        status = 'Cần xử lý gấp';
      } else if (ac.includes('Không') || projector.includes('Hình ảnh mờ')) {
        status = 'Cần bảo trì';
      } else {
        status = 'Hoạt động tốt';
      }

      const code = name.replace(/^Phòng\s+/i, '').replace(/\s+/g, '-');

      csvFacilities.push({
        code: code,
        id: id,
        name: name,
        building: building,
        type: type,
        capacity: pcGood && parseInt(pcGood) > 0 ? `${pcGood} PC tốt (${pcBad} hỏng)` : 'Theo tiêu chuẩn VKU',
        manager: surveyor,
        phone: 'Ban QL CSVC VKU',
        lastInspected: timestamp,
        status: status,
        priority: priority,
        projector: projector,
        ac: ac,
        pcGood: pcGood,
        pcBad: pcBad,
        estCost: estCost,
        rating: rating,
        notes: notes,
        equipment: [`Máy chiếu (${projector})`, `Điều hòa (${ac})`, `Hệ thống điện & bàn ghế (${furniture})`],
        latestReport: {
          q1: `${code} - ${name}`,
          q2: type,
          q3: projector,
          q4: ac,
          q5: pcGood,
          q6: furniture,
          q7: priority,
          q9: notes
        }
      });
    }

    if (csvFacilities.length > 0) {
      await seedFacilityCache(csvFacilities);
    }
  } catch (err) {
    console.warn('Failed to load CSV dataset:', err);
  }
}

export async function seedFacilityCache(facilityList) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('facility_cache', 'readwrite');
    const store = tx.objectStore('facility_cache');
    facilityList.forEach(fac => store.put(fac));
    tx.oncomplete = () => resolve(true);
  });
}

export async function updateFacilityCacheFromSurvey(surveyRecord) {
  const data = surveyRecord.data || {};
  const locationRaw = data.q1 || 'Khu vực khảo sát mới';
  
  let code = locationRaw.split('-')[0].trim();
  if (code.length > 20) code = code.substring(0, 20);

  const building = locationRaw.includes('Tòa') ? locationRaw.split('-')[0].trim() : 'Khu vực VKU';
  const priority = data.q7 || 'Bình thường';
  const status = (priority.includes('Khẩn cấp') || priority.includes('Cao')) ? 'Cần xử lý gấp' : 'Đã báo cáo mới';

  const facilityObj = {
    code: code,
    id: surveyRecord.id,
    name: locationRaw,
    building: building,
    type: data.q2 || 'Cơ sở vật chất',
    capacity: data.q5 ? `${data.q5} máy tính tốt` : 'Tiêu chuẩn VKU',
    manager: surveyRecord.surveyor || 'Người điều tra VKU',
    phone: 'BQL CSVC VKU',
    lastInspected: surveyRecord.timestamp || new Date().toLocaleString('vi-VN'),
    status: status,
    priority: priority,
    notes: data.q9 || 'Phiếu điều tra vừa được cập nhật từ Form.',
    photo: data.q8_photo || null,
    latestReport: data
  };

  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('facility_cache', 'readwrite');
    const store = tx.objectStore('facility_cache');
    store.put(facilityObj);
    tx.oncomplete = () => resolve(facilityObj);
  });
}

export async function getAllFacilitiesAndReports(query = '', filterCategory = 'all') {
  const db = await openDB();
  
  const facilities = await new Promise((resolve) => {
    const tx = db.transaction('facility_cache', 'readonly');
    const store = tx.objectStore('facility_cache');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });

  const history = await getSurveyHistory();
  const pending = await getPendingSyncList();

  // Combine and sort by last inspected
  const combined = [...facilities];

  // Also append pending sync & history items if not already in combined
  [...pending, ...history].forEach(hist => {
    const data = hist.data || {};
    const loc = data.q1 || hist.id;
    const exists = combined.some(f => f.name.toLowerCase().includes(loc.toLowerCase()) || f.code.toLowerCase().includes(loc.toLowerCase()));
    if (!exists) {
      combined.unshift({
        code: hist.id,
        id: hist.id,
        name: loc,
        building: data.q2 || 'Khu vực vừa khảo sát',
        type: data.q2 || 'Báo cáo khảo sát mới',
        capacity: data.q5 ? `${data.q5} máy tính` : 'N/A',
        manager: hist.surveyor || 'Người điều tra',
        phone: 'BQL VKU',
        lastInspected: hist.syncedAt || hist.timestamp || 'Mới cập nhật',
        status: (data.q7 && (data.q7.includes('Khẩn cấp') || data.q7.includes('Cao'))) ? 'Cần xử lý gấp' : 'Đã báo cáo',
        priority: data.q7 || 'Bình thường',
        notes: data.q9 || 'Phiếu khảo sát vừa gửi từ ứng dụng.',
        photo: data.q8_photo || null,
        latestReport: data
      });
    }
  });

  // Filter
  let filtered = combined;

  if (filterCategory === 'urgent') {
    filtered = filtered.filter(f => 
      (f.status && (f.status.includes('gấp') || f.status.includes('trì'))) || 
      (f.priority && (f.priority.includes('Khẩn cấp') || f.priority.includes('Cao'))) ||
      (f.notes && (f.notes.includes('hỏng') || f.notes.includes('lỗi') || f.notes.includes('cháy')))
    );
  } else if (filterCategory === 'lab') {
    filtered = filtered.filter(f => f.type && (f.type.toLowerCase().includes('lab') || f.type.toLowerCase().includes('máy')));
  } else if (filterCategory === 'recent') {
    filtered = filtered.filter(f => f.lastInspected && (f.lastInspected.includes('2026') || f.lastInspected.includes('Mới')));
  }

  if (query && query.trim() !== '') {
    const q = query.toLowerCase().trim();
    filtered = filtered.filter(f =>
      f.code.toLowerCase().includes(q) ||
      f.name.toLowerCase().includes(q) ||
      f.building.toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q) ||
      (f.notes && f.notes.toLowerCase().includes(q)) ||
      (f.priority && f.priority.toLowerCase().includes(q))
    );
  }

  return filtered;
}
