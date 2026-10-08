/**
 * Dynamic Markdown Parser for VKU Field Survey PWA
 * Parses questions.md into dynamic interactive form elements.
 * When questions.md is modified, the UI automatically updates without touching JS code!
 */

export function parseMarkdownSurvey(mdText) {
  const lines = mdText.split(/\r?\n/);
  
  let title = 'BẢNG ĐIỀU TRA CƠ SỞ VẬT CHẤT VKU';
  let description = '';
  const sections = [];

  let currentSection = null;
  let currentQuestion = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines or hr dividers
    if (!line || line === '---') continue;

    // H1: Main Title
    if (line.startsWith('# ')) {
      title = line.replace('# ', '').trim();
      continue;
    }

    // Blockquote: Main Description / Guidelines
    if (line.startsWith('> ')) {
      const descText = line.replace('> ', '').trim();
      description += (description ? '<br>' : '') + descText;
      continue;
    }

    // H2: Section Header
    if (line.startsWith('## ')) {
      if (currentQuestion && currentSection) {
        currentSection.questions.push(currentQuestion);
        currentQuestion = null;
      }
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: line.replace('## ', '').trim(),
        description: '',
        questions: []
      };
      continue;
    }

    // Section Description (text under H2 before H3)
    if (currentSection && !line.startsWith('### ') && !line.startsWith('- ') && !currentQuestion) {
      currentSection.description += (currentSection.description ? ' ' : '') + line;
      continue;
    }

    // H3: Question Title
    if (line.startsWith('### ')) {
      if (currentQuestion && currentSection) {
        currentSection.questions.push(currentQuestion);
      }
      const rawTitle = line.replace('### ', '').trim();
      const idMatch = rawTitle.match(/^(Q\d+)\s*:\s*(.+)$/i);

      let qId, qText;
      if (idMatch) {
        qId = idMatch[1].toLowerCase();
        qText = idMatch[2];
      } else {
        qId = 'q_' + Math.random().toString(36).substr(2, 6);
        qText = rawTitle;
      }

      currentQuestion = {
        id: qId,
        label: qText,
        type: 'text',
        required: false,
        placeholder: '',
        info: '',
        options: []
      };
      continue;
    }

    // Bullet Metadata under Question (- Property: Value)
    if (line.startsWith('- ') && currentQuestion) {
      const content = line.replace('- ', '').trim();
      const colonIndex = content.indexOf(':');
      if (colonIndex !== -1) {
        const key = content.substring(0, colonIndex).trim().toLowerCase();
        const value = content.substring(colonIndex + 1).trim();

        if (key === 'type') {
          currentQuestion.type = value.toLowerCase();
        } else if (key === 'required') {
          currentQuestion.required = value.toLowerCase() === 'true';
        } else if (key === 'placeholder') {
          currentQuestion.placeholder = value.replace(/^["']|["']$/g, '');
        } else if (key === 'info') {
          currentQuestion.info = value;
        } else if (key === 'options') {
          // Parse options array e.g. [Option 1, Option 2, Option 3]
          let rawOptions = value;
          if (rawOptions.startsWith('[') && rawOptions.endsWith(']')) {
            rawOptions = rawOptions.slice(1, -1);
          }
          currentQuestion.options = rawOptions
            .split(',')
            .map(opt => opt.trim().replace(/^["']|["']$/g, ''))
            .filter(opt => opt.length > 0);
        }
      }
    }
  }

  // Push last question & section
  if (currentQuestion && currentSection) {
    currentSection.questions.push(currentQuestion);
  }
  if (currentSection) {
    sections.push(currentSection);
  }

  return { title, description, sections };
}

/**
 * Renders parsed markdown survey data into HTML Form elements
 */
export function renderSurveyFormHTML(parsedData, savedValues = {}) {
  const { title, description, sections } = parsedData;

  let html = `
    <div class="survey-header-card">
      <div class="header-badge"><i class="badge-icon">📋</i> VKU Field Inspector</div>
      <h1 class="survey-title">${escapeHTML(title)}</h1>
      ${description ? `<div class="survey-desc">${description}</div>` : ''}
    </div>
  `;

  sections.forEach((sec, sIdx) => {
    html += `
      <div class="survey-section-card">
        <h2 class="section-title"><span class="section-num">${sIdx + 1}</span> ${escapeHTML(sec.title)}</h2>
        ${sec.description ? `<p class="section-desc">${escapeHTML(sec.description)}</p>` : ''}
        <div class="questions-list">
    `;

    sec.questions.forEach((q) => {
      const qVal = savedValues[q.id] || '';
      html += renderQuestionFieldHTML(q, qVal);
    });

    html += `
        </div>
      </div>
    `;
  });

  return html;
}

function renderQuestionFieldHTML(q, currentVal) {
  const reqBadge = q.required ? `<span class="req-star" title="Bắt buộc">*</span>` : '';
  const infoBtn = q.info ? `
    <button type="button" class="info-toggle-btn" onclick="toggleQuestionInfo('${q.id}')" aria-label="Xem hướng dẫn">
      💡 <span class="info-btn-text">Hướng dẫn</span>
    </button>
  ` : '';

  const infoBox = q.info ? `
    <div id="info_${q.id}" class="question-info-box hidden">
      <div class="info-box-header">ℹ️ Hướng dẫn điều tra:</div>
      <div class="info-box-content">${escapeHTML(q.info)}</div>
    </div>
  ` : '';

  let inputHTML = '';

  switch (q.type) {
    case 'text':
      inputHTML = `
        <input type="text" 
               id="${q.id}" 
               name="${q.id}" 
               class="form-control" 
               value="${escapeHTML(currentVal)}" 
               placeholder="${escapeHTML(q.placeholder)}" 
               ${q.required ? 'required' : ''}>
      `;
      break;

    case 'number':
      inputHTML = `
        <input type="number" 
               id="${q.id}" 
               name="${q.id}" 
               class="form-control" 
               value="${escapeHTML(currentVal)}" 
               placeholder="${escapeHTML(q.placeholder)}" 
               ${q.required ? 'required' : ''}>
      `;
      break;

    case 'textarea':
      inputHTML = `
        <textarea id="${q.id}" 
                  name="${q.id}" 
                  class="form-control textarea-control" 
                  rows="3" 
                  placeholder="${escapeHTML(q.placeholder)}" 
                  ${q.required ? 'required' : ''}>${escapeHTML(currentVal)}</textarea>
      `;
      break;

    case 'select':
      let optsHTML = `<option value="">-- Chọn lựa chọn --</option>`;
      q.options.forEach(opt => {
        const sel = currentVal === opt ? 'selected' : '';
        optsHTML += `<option value="${escapeHTML(opt)}" ${sel}>${escapeHTML(opt)}</option>`;
      });
      inputHTML = `
        <select id="${q.id}" name="${q.id}" class="form-control form-select" ${q.required ? 'required' : ''}>
          ${optsHTML}
        </select>
      `;
      break;

    case 'radio':
      let radiosHTML = `<div class="radio-group">`;
      q.options.forEach((opt, idx) => {
        const checked = currentVal === opt ? 'checked' : '';
        const radioId = `${q.id}_opt_${idx}`;
        radiosHTML += `
          <label for="${radioId}" class="radio-label">
            <input type="radio" id="${radioId}" name="${q.id}" value="${escapeHTML(opt)}" ${checked} ${q.required ? 'required' : ''}>
            <span class="radio-custom"></span>
            <span class="radio-text">${escapeHTML(opt)}</span>
          </label>
        `;
      });
      radiosHTML += `</div>`;
      inputHTML = radiosHTML;
      break;

    case 'checkbox':
      let checkValArray = Array.isArray(currentVal) ? currentVal : (currentVal ? currentVal.split(', ') : []);
      let checkHTML = `<div class="checkbox-group">`;
      q.options.forEach((opt, idx) => {
        const checked = checkValArray.includes(opt) ? 'checked' : '';
        const checkId = `${q.id}_chk_${idx}`;
        checkHTML += `
          <label for="${checkId}" class="checkbox-label">
            <input type="checkbox" id="${checkId}" name="${q.id}" value="${escapeHTML(opt)}" ${checked}>
            <span class="checkbox-custom"></span>
            <span class="checkbox-text">${escapeHTML(opt)}</span>
          </label>
        `;
      });
      checkHTML += `</div>`;
      inputHTML = checkHTML;
      break;

    case 'photo':
      const photoPreviewSrc = currentVal || '';
      inputHTML = `
        <div class="photo-uploader-container">
          <input type="file" id="${q.id}" name="${q.id}" accept="image/*" capture="environment" class="hidden-file-input" onchange="handlePhotoUpload('${q.id}', event)">
          <div class="photo-drop-zone" onclick="document.getElementById('${q.id}').click()">
            <div class="camera-icon">📷</div>
            <div class="upload-hint">Chạm để chụp ảnh / Tải ảnh từ thiết bị</div>
            <div class="upload-subtext">Hỗ trợ camera trực tiếp trên điện thoại</div>
          </div>
          <button type="button" class="btn btn-secondary native-camera-button" onclick="capturePhotoNative('${q.id}')">📸 Mở camera thiết bị</button>
          <div id="preview_container_${q.id}" class="photo-preview-container ${photoPreviewSrc ? '' : 'hidden'}">
            <img id="preview_${q.id}" src="${photoPreviewSrc}" class="photo-preview-img" alt="Ảnh minh chứng">
            <button type="button" class="btn-remove-photo" onclick="removePhoto('${q.id}')">✕ Xóa ảnh</button>
          </div>
          <input type="hidden" id="${q.id}_dataurl" name="${q.id}_dataurl" value="${escapeHTML(photoPreviewSrc)}">
        </div>
      `;
      break;

    default:
      inputHTML = `<input type="text" id="${q.id}" name="${q.id}" class="form-control" value="${escapeHTML(currentVal)}">`;
  }

  return `
    <div class="question-item" data-qid="${q.id}">
      <div class="question-label-row">
        <label for="${q.id}" class="question-label">${escapeHTML(q.label)} ${reqBadge}</label>
        ${infoBtn}
      </div>
      ${infoBox}
      <div class="question-input-wrapper">
        ${inputHTML}
      </div>
    </div>
  `;
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
