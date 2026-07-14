// ================================================================
// Credit & GPA Strategist — app.js (v2 — Sidebar + Semester + Delete)
// Vanilla JS · ES6 Module · Supabase Integration
// ================================================================

// ======================= CONFIG =======================
const SUPABASE_URL = 'https://uhqvankajktrkbydfixk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pKLKuuSiLu2Bwp4hpUxIPg_3OdOFa6h';

// ======================= CONSTANTS =======================
const EXCLUDED_SUBJECTS = [
  'giáo dục thể chất', 'quốc phòng', 'kỹ năng mềm',
  'giáo dục qp', 'gdtc', 'chuyên đề', 'shđk',
  'quân sự', 'an ninh', 'điền kinh', 'bóng chuyền',
  'bóng đá', 'chiến đấu', 'bơi lội', 'cầu lông',
];

const GRADING_SCALE = [
  { min: 9.0, max: 10.0, diemChu: 'A', diemHe4: 4.0, cssClass: 'a' },
  { min: 8.0, max: 8.9, diemChu: 'B+', diemHe4: 3.5, cssClass: 'b' },
  { min: 7.0, max: 7.9, diemChu: 'B', diemHe4: 3.0, cssClass: 'b' },
  { min: 6.5, max: 6.9, diemChu: 'C+', diemHe4: 2.5, cssClass: 'c' },
  { min: 5.5, max: 6.4, diemChu: 'C', diemHe4: 2.0, cssClass: 'c' },
  { min: 5.0, max: 5.4, diemChu: 'D+', diemHe4: 1.5, cssClass: 'd' },
  { min: 4.0, max: 4.9, diemChu: 'D', diemHe4: 1.0, cssClass: 'd' },
  { min: 0.0, max: 3.9, diemChu: 'F', diemHe4: 0.0, cssClass: 'f' },
];

// ======================= STATE =======================
let supabase = null;
let currentUser = null;
let isUsingMockData = true;
let courseData = [];
let simulatedCourses = [];
let semesters = [];  // ['Học kỳ 1 - Năm 1', ...]
let totalCreditsRequired = 150;
let predictedGrades = {}; // { ma_mon: predicted_score }

// ======================= MOCK =======================
const MOCK_USER = { email: 'demo@gpastrategy.app', id: 'mock-user-001' };
const MOCK_COURSES = [
  { ma_mon: 'MAT101', ten_mon: 'Toán Đại số', tin_chi: 3, diem_10: 7.0, hoc_ky: 'Học kỳ 1' },
  { ma_mon: 'CSE102', ten_mon: 'Cơ sở Tin học', tin_chi: 4, diem_10: 6.5, hoc_ky: 'Học kỳ 1' },
  { ma_mon: 'PHY101', ten_mon: 'Vật lý Đại cương', tin_chi: 3, diem_10: 7.5, hoc_ky: 'Học kỳ 1' },
  { ma_mon: 'ENG101', ten_mon: 'Tiếng Anh 1', tin_chi: 3, diem_10: 9.0, hoc_ky: 'Học kỳ 2' },
  { ma_mon: 'CSE201', ten_mon: 'Cấu trúc dữ liệu', tin_chi: 3, diem_10: 5.0, hoc_ky: 'Học kỳ 2' },
];

// ======================= SUPABASE INIT =======================
async function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { isUsingMockData = true; return; }
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    isUsingMockData = false;
    console.log('[App] Supabase connected.');
  } catch (err) {
    console.error('[App] Supabase init failed:', err);
    isUsingMockData = true;
  }
}

// ======================= GRADE HELPERS =======================
function convertGrade(diemHe10) {
  const score = Math.max(0, Math.min(10, diemHe10));
  for (const level of GRADING_SCALE) {
    if (score >= level.min) return { diemChu: level.diemChu, diemHe4: level.diemHe4 };
  }
  return { diemChu: 'F', diemHe4: 0.0 };
}

function getGradeInfo(diemHe10) {
  if (diemHe10 === null || diemHe10 === undefined || diemHe10 < 0) {
    return { diemChu: 'M', diemHe4: 0, cssClass: 'm' };
  }
  const score = Math.max(0, Math.min(10, diemHe10));
  for (const level of GRADING_SCALE) {
    if (score >= level.min) return { diemChu: level.diemChu, diemHe4: level.diemHe4, cssClass: level.cssClass };
  }
  return { diemChu: 'F', diemHe4: 0.0, cssClass: 'f' };
}

function getAcademicRank(gpa) {
  if (gpa >= 3.6) return 'Xuất sắc';
  if (gpa >= 3.2) return 'Giỏi';
  if (gpa >= 2.5) return 'Khá';
  if (gpa >= 2.0) return 'Trung bình';
  if (gpa >= 1.0) return 'Yếu';
  return 'Kém';
}

/** Kiểm tra môn này có bị loại khỏi phép tính GPA không */
function isExcludedFromGPA(course) {
  if (!course.tin_chi || course.tin_chi === 0) return true;
  const name = (course.ten_mon || '').toLowerCase();
  return EXCLUDED_SUBJECTS.some(keyword => name.includes(keyword));
}

/** Tính GPA — Loại trừ các môn điều kiện (QP/GDTC/KNM) và môn Miễn (M) */
function calculateGPA(courses) {
  if (!courses.length) return 0;
  let sum = 0, totalTC = 0;
  for (const c of courses) {
    const score = c.diem_10 ?? c.diem_muc_tieu ?? null;
    if (score === null || score === undefined || score < 0) continue;
    if (isExcludedFromGPA(c)) continue;
    const { diemHe4 } = convertGrade(score);
    sum += diemHe4 * c.tin_chi;
    totalTC += c.tin_chi;
  }
  return totalTC > 0 ? sum / totalTC : 0;
}

function calculateGPA10(courses) {
  if (!courses.length) return 0;
  let sum = 0, totalTC = 0;
  for (const c of courses) {
    const score = c.diem_10 ?? c.diem_muc_tieu ?? null;
    if (score === null || score === undefined || score < 0) continue;
    if (isExcludedFromGPA(c)) continue;
    sum += score * c.tin_chi;
    totalTC += c.tin_chi;
  }
  return totalTC > 0 ? sum / totalTC : 0;
}

/** Tổng tín chỉ — bao gồm cả môn điều kiện (nếu có điểm và không rớt) và môn miễn (M) */
function calculateTotalCredits(courses) {
  return courses.reduce((s, c) => {
    // Xét trường hợp môn miễn
    const gradeInfo = getGradeInfo(c.diem_10);
    if (c.diem_chu === 'M' || gradeInfo.diemChu === 'M') {
      return s + (c.tin_chi || 0);
    }

    const score = c.diem_10 ?? c.diem_muc_tieu ?? null;
    // Không tính môn chưa có điểm, hoặc môn F (rớt)
    if (score === null || score === undefined || score < 0) return s;
    if (score < 4.0) return s; // rớt
    return s + (c.tin_chi || 0);
  }, 0);
}

// ======================= DOM REFERENCES =======================
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const DOM = {
  authScreen: $('#auth-screen'),
  mainApp: $('#main-app'),
  authForm: $('#auth-form'),
  authEmail: $('#auth-email'),
  authPassword: $('#auth-password'),
  authMessage: $('#auth-message'),
  btnLogin: $('#btn-login'),
  btnRegister: $('#btn-register'),
  btnLogout: $('#btn-logout'),
  userEmailDisplay: $('#user-email-display'),
  sidebar: $('#sidebar'),
  btnSidebarToggle: $('#btn-sidebar-toggle'),
  mainContent: $('#main-content'),
  gpaValue: $('#gpa-value'),
  creditsCurrent: $('#credits-current'),
  creditsTotal: $('#credits-total'),
  creditsProgress: $('#credits-progress'),
  rankValue: $('#rank-value'),
  inputTranscript: $('#input-transcript'),
  btnParseSave: $('#btn-parse-save'),
  parseMessage: $('#parse-message'),
  portalModal: $('#portal-modal'),
  btnCloseModal: $('#btn-close-modal'),
  btnCancelModal: $('#btn-cancel-modal'),
  btnOpenModal: $$('.btn-open-modal'),
  btnManualAdd: $('#btn-manual-add'),
  btnGotoRoadmap: $('#btn-goto-roadmap'),
  modalStatusText: $('#modal-status-text'),
  welcomeView: $('#welcome-view'),
  dataView: $('#data-view'),
  semesterSelect: $('#semester-select'),
  btnAddSemester: $('#btn-add-semester'),
  courseTbody: $('#course-tbody'),
  tableEmpty: $('#table-empty'),
  gradeDistribution: $('#grade-distribution'),
  simForm: $('#sim-form'),
  simName: $('#sim-name'),
  simCredits: $('#sim-credits'),
  simGrade: $('#sim-grade'),
  simList: $('#sim-list'),
  simCount: $('#sim-count'),
  simGpaProjected: $('#sim-gpa-projected'),
  simCreditsProjected: $('#sim-credits-projected'),
  settingsTotalCredits: $('#settings-total-credits'),
  btnSaveSettings: $('#btn-save-settings'),
  semesterListSettings: $('#semester-list-settings'),
};

// ======================= UI HELPERS =======================
function showAuthMessage(msg, type = 'error') {
  if (!DOM.authMessage) return;
  DOM.authMessage.textContent = msg;
  DOM.authMessage.className = `auth-message ${type}`;
}

function showParseMessage(msg, type = 'success') {
  if (!DOM.parseMessage) return;
  DOM.parseMessage.textContent = msg;
  DOM.parseMessage.className = `parse-message ${type}`;
  setTimeout(() => { if (DOM.parseMessage) DOM.parseMessage.textContent = ''; }, 5000);
}

function showScreen(screen) {
  if (screen === 'auth') {
    if (DOM.authScreen) DOM.authScreen.style.display = 'flex';
    if (DOM.mainApp) DOM.mainApp.style.display = 'none';
  } else {
    if (DOM.authScreen) DOM.authScreen.style.display = 'none';
    if (DOM.mainApp) DOM.mainApp.style.display = 'flex';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function animateNumber(el, target, decimals = 2) {
  if (!el) return;
  const current = parseFloat(el.textContent) || 0;
  const diff = target - current;
  const duration = 500;
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = (current + diff * ease).toFixed(decimals);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ======================= SIDEBAR NAVIGATION =======================
function initSidebar() {
  // Toggle collapse
  if (DOM.btnSidebarToggle) {
    DOM.btnSidebarToggle.addEventListener('click', () => {
      DOM.sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebar_collapsed', DOM.sidebar.classList.contains('collapsed'));
    });
  }
  // Restore state
  if (localStorage.getItem('sidebar_collapsed') === 'true') {
    DOM.sidebar?.classList.add('collapsed');
  }

  // Page navigation
  $$('.sidebar-link[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      switchPage(page);
    });
  });
}

function switchPage(pageId) {
  $$('.page').forEach(p => p.classList.remove('active'));
  const target = $(`#page-${pageId}`);
  if (target) target.classList.add('active');

  $$('.sidebar-link').forEach(l => l.classList.remove('active'));
  const link = $(`.sidebar-link[data-page="${pageId}"]`);
  if (link) link.classList.add('active');
}

// ======================= AUTH =======================
function translateAuthError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('user already registered')) return 'Email đã được đăng ký.';
  if (msg.includes('invalid login credentials')) return 'Email hoặc mật khẩu không đúng.';
  if (msg.includes('email not confirmed')) return 'Tài khoản chưa xác nhận email.';
  if (msg.includes('rate limit') || error?.status === 429) return 'Thử quá nhiều lần. Chờ 1 phút.';
  if (msg.includes('password') && msg.includes('at least')) return 'Mật khẩu ít nhất 6 ký tự.';
  if (msg.includes('valid email')) return 'Email không hợp lệ.';
  return error?.message || 'Lỗi không xác định.';
}

function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

async function handleLogin(email, password) {
  if (!isValidEmail(email)) { showAuthMessage('Email không hợp lệ.'); return; }
  if (password.length < 6) { showAuthMessage('Mật khẩu ít nhất 6 ký tự.'); return; }

  if (isUsingMockData) {
    currentUser = { ...MOCK_USER, email };
    showScreen('main');
    onAuthSuccess();
    return;
  }

  DOM.btnLogin.classList.add('loading');
  DOM.btnLogin.innerHTML = '<span class="spinner"></span> Đang đăng nhập...';
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (err) {
    showAuthMessage(translateAuthError(err));
  } finally {
    DOM.btnLogin.classList.remove('loading');
    DOM.btnLogin.textContent = 'Đăng nhập';
  }
}

async function signUpUser(email, password) {
  if (!isValidEmail(email)) { showAuthMessage('Email không hợp lệ.'); return; }
  if (password.length < 6) { showAuthMessage('Mật khẩu ít nhất 6 ký tự.'); return; }

  if (isUsingMockData) { showAuthMessage('Đăng ký thành công, vui lòng đăng nhập.', 'success'); return; }

  DOM.btnRegister.classList.add('loading');
  DOM.btnRegister.innerHTML = '<span class="spinner"></span> Đang đăng ký...';
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data?.user?.identities?.length === 0) { showAuthMessage('Email đã được đăng ký.'); return; }
    showAuthMessage('Đăng ký thành công, vui lòng đăng nhập.', 'success');
  } catch (err) {
    showAuthMessage(translateAuthError(err));
  } finally {
    DOM.btnRegister.classList.remove('loading');
    DOM.btnRegister.textContent = 'Đăng ký mới';
  }
}

async function handleLogout() {
  if (!isUsingMockData && supabase) {
    try { await supabase.auth.signOut(); } catch (e) { console.error(e); }
  } else {
    currentUser = null;
    courseData = [];
    simulatedCourses = [];
    showScreen('auth');
  }
}

// ======================= DATA CRUD =======================
async function loadCourseData() {
  if (isUsingMockData) {
    const saved = localStorage.getItem(`user_grades_data_${currentUser?.email || 'default'}`);
    courseData = saved ? JSON.parse(saved) : [...MOCK_COURSES];
    simulatedCourses = [];
    return;
  }
  try {
    const { data, error } = await supabase.from('TienTrinhHocTap').select('*').eq('user_id', currentUser.id);
    if (error) throw error;
    courseData = data || [];

    // Khôi phục hoc_ky
    const localKey = `local_semester_map_${currentUser?.email || 'default'}`;
    const localSemesterMap = JSON.parse(localStorage.getItem(localKey) || '{}');
    const oldLocalMap = JSON.parse(localStorage.getItem('local_semester_map') || '{}');

    courseData.forEach(c => {
      // Decode hoc_ky from ten_mon if it was saved using the fallback
      if (c.ten_mon && c.ten_mon.includes('||')) {
        const parts = c.ten_mon.split('||');
        c.ten_mon = parts[0];
        if (!c.hoc_ky) c.hoc_ky = parts[1];
      }

      // Fallback to local maps
      if (!c.hoc_ky) {
        if (localSemesterMap[c.ma_mon]) {
          c.hoc_ky = localSemesterMap[c.ma_mon];
        } else if (oldLocalMap[c.ma_mon]) {
          c.hoc_ky = oldLocalMap[c.ma_mon];
        }
      }
    });
  } catch (err) {
    console.error('[Data] Load error:', err);
    showParseMessage('Lỗi tải dữ liệu từ server.', 'error');
  }
}

async function saveCourseToCloud(course) {
  if (isUsingMockData) {
    const existing = courseData.findIndex(c => c.ma_mon === course.ma_mon);
    let updatedCourse;
    if (existing >= 0) { Object.assign(courseData[existing], course); updatedCourse = courseData[existing]; }
    else {
      updatedCourse = { id: Date.now(), ...course, user_id: MOCK_USER.id };
      courseData.push(updatedCourse);
    }
    localStorage.setItem(`user_grades_data_${currentUser?.email || 'default'}`, JSON.stringify(courseData));
    return updatedCourse;
  }
  try {
    const payload = {
      user_id: currentUser.id,
      ma_mon: course.ma_mon,
      ten_mon: course.ten_mon,
      tin_chi: course.tin_chi,
      diem_10: (course.diem_10 == null) ? -1 : course.diem_10,
    };

    // Chỉ gửi hoc_ky nếu có giá trị
    if (course.hoc_ky) payload.hoc_ky = course.hoc_ky;

    // Lưu vào localStorage dự phòng để luôn giữ được nhóm học kỳ
    if (course.hoc_ky) {
      const localKey = `local_semester_map_${currentUser?.email || 'default'}`;
      const localSemesterMap = JSON.parse(localStorage.getItem(localKey) || '{}');
      localSemesterMap[course.ma_mon] = course.hoc_ky;
      localStorage.setItem(localKey, JSON.stringify(localSemesterMap));
    }

    let res = await supabase
      .from('TienTrinhHocTap')
      .upsert(payload, { onConflict: 'ma_mon, user_id' })
      .select();

    // Fallback: nếu lỗi do Supabase chưa có cột hoc_ky, thử lưu không có hoc_ky
    if (res.error && payload.hoc_ky) {
      console.warn('[Data] Lỗi lưu hoc_ky, thử lại không có trường này...');
      delete payload.hoc_ky;
      // Encode hoc_ky into ten_mon to ensure it is saved across devices
      payload.ten_mon = `${course.ten_mon}||${course.hoc_ky}`;
      res = await supabase
        .from('TienTrinhHocTap')
        .upsert(payload, { onConflict: 'ma_mon, user_id' })
        .select();
    }

    if (res.error) throw res.error;
    return res.data?.[0];
  } catch (err) {
    console.error('[Data] Save error:', course.ma_mon, err);
    throw err;
  }
}

async function deleteCourse(course) {
  if (isUsingMockData) {
    courseData = courseData.filter(c => c.ma_mon !== course.ma_mon);
    localStorage.setItem(`user_grades_data_${currentUser?.email || 'default'}`, JSON.stringify(courseData));
    return;
  }
  try {
    const { error } = await supabase
      .from('TienTrinhHocTap')
      .delete()
      .eq('ma_mon', course.ma_mon)
      .eq('user_id', currentUser.id);
    if (error) throw error;
    courseData = courseData.filter(c => c.ma_mon !== course.ma_mon);
  } catch (err) {
    console.error('[Data] Delete error:', err);
    alert('Xóa thất bại: ' + err.message);
  }
}

// ======================= PARSER =======================
function parsePortalData(rawData) {
  if (!rawData || typeof rawData !== 'string') return [];
  const results = [];
  const lines = rawData.split(/\n/).map(l => l.trim()).filter(Boolean);
  let currentHocKy = '';

  const REGEX = /^(\d{1,3})(\d{6,8})(.*?)([0-9])(M+|(?:\d\.\d)+[A-F][\+\-]?|)$/i;

  for (const line of lines) {
    if (line.toLowerCase().includes('học kỳ') && line.toLowerCase().includes('năm học')) {
      currentHocKy = line;
      continue;
    }

    let maMon = null, tenMon = null, tinChi = null, diemHe10 = null, diemChu = null;

    if (line.includes('\t')) {
      const cols = line.split('\t').map(c => c.trim());
      maMon = cols[1];
      let idx = 2;
      if (cols[2] && cols[2].match(/^\d+$/)) { maMon += cols[2]; idx = 3; }
      else if (cols[2] === '') { idx = 3; }
      tenMon = cols[idx];
      tinChi = parseInt(cols[idx + 1], 10);
      const remaining = cols.slice(idx + 2).filter(c => c !== '');
      if (remaining.length > 0) {
        if (remaining.includes('M')) { diemChu = 'M'; }
        else {
          const nums = remaining.filter(r => !isNaN(parseFloat(r)));
          if (nums.length > 0) diemHe10 = parseFloat(nums[0]);
          const letters = remaining.filter(r => r.match(/^[A-F][\+\-]?$/i));
          if (letters.length > 0) diemChu = letters[0].toUpperCase();
        }
      }
    } else {
      const match = line.match(REGEX);
      if (match) {
        maMon = match[2];
        tenMon = match[3].trim();
        tinChi = parseInt(match[4], 10);
        const diemRaw = match[5];
        if (diemRaw) {
          if (diemRaw.startsWith('M')) { diemChu = 'M'; }
          else {
            const numbers = diemRaw.match(/\d\.\d/g);
            if (numbers?.length >= 2) diemHe10 = parseFloat(numbers[1]);
            else if (numbers?.length === 1) diemHe10 = parseFloat(numbers[0]);
            const lm = diemRaw.match(/[A-F][\+\-]?$/i);
            if (lm) diemChu = lm[0].toUpperCase();
          }
        }
      }
    }

    if (maMon && tenMon && !isNaN(tinChi)) {
      results.push({ hoc_ky: currentHocKy, ma_mon: maMon, ten_mon: tenMon, tin_chi: tinChi, diem_10: diemHe10, diem_chu: diemChu });
    }
  }
  return results;
}

function parseTranscript(rawData) {
  return parsePortalData(rawData).filter(item => {
    // Lọc bỏ các môn học rác không hợp lệ:
    // Giữ lại môn có điểm, môn miễn (M), hoặc môn chưa có điểm nhưng vẫn có tín chỉ
    if (item.diem_10 !== null) return true;
    if (item.diem_chu === 'M') return true;
    if (item.tin_chi === 0) return false; // Loại bỏ các học phần 0 tín chỉ không có điểm
    return true;
  });
}

// ======================= SEMESTER MANAGEMENT =======================
function loadSemesters() {
  const saved = localStorage.getItem('semesters');
  semesters = saved ? JSON.parse(saved) : [];
  renderSemesterDropdown();
  renderSemesterSettings();
}

function saveSemesters() {
  localStorage.setItem('semesters', JSON.stringify(semesters));
  renderSemesterDropdown();
  renderSemesterSettings();
}

function addSemester(name) {
  if (!name || semesters.includes(name)) return;
  semesters.push(name);
  saveSemesters();
}

function removeSemester(name) {
  semesters = semesters.filter(s => s !== name);
  saveSemesters();
}

function renderSemesterDropdown() {
  if (!DOM.semesterSelect) return;
  const current = DOM.semesterSelect.value;
  DOM.semesterSelect.innerHTML = '<option value="">— Tự nhận diện từ dữ liệu —</option>';
  semesters.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    DOM.semesterSelect.appendChild(opt);
  });
  DOM.semesterSelect.value = current;
}

function renderSemesterSettings() {
  if (!DOM.semesterListSettings) return;
  DOM.semesterListSettings.innerHTML = '';
  if (!semesters.length) {
    DOM.semesterListSettings.innerHTML = '<li class="text-muted text-sm" style="padding:8px 0">Chưa có học kỳ nào.</li>';
    return;
  }
  semesters.forEach(s => {
    const li = document.createElement('li');
    li.className = 'sim-item';
    li.innerHTML = `
      <span class="sim-item__name">${escapeHtml(s)}</span>
      <button class="btn-delete" title="Xóa học kỳ">✕</button>
    `;
    li.querySelector('.btn-delete').addEventListener('click', () => {
      if (confirm(`Xóa học kỳ "${s}"?`)) { removeSemester(s); }
    });
    DOM.semesterListSettings.appendChild(li);
  });
}

// ======================= SETTINGS =======================
function loadSettings() {
  const saved = localStorage.getItem('totalCreditsRequired');
  totalCreditsRequired = saved ? parseInt(saved, 10) : 150;
  if (DOM.settingsTotalCredits) DOM.settingsTotalCredits.value = totalCreditsRequired;
  if (DOM.creditsTotal) DOM.creditsTotal.textContent = totalCreditsRequired;
}

function saveSettings() {
  const val = parseInt(DOM.settingsTotalCredits?.value, 10);
  if (isNaN(val) || val < 1) return;
  totalCreditsRequired = val;
  localStorage.setItem('totalCreditsRequired', totalCreditsRequired);
  if (DOM.creditsTotal) DOM.creditsTotal.textContent = totalCreditsRequired;
  updateDashboard();
  showParseMessage('Đã lưu cài đặt!', 'success');
}

// ======================= RENDER =======================
function updateDashboard() {
  const gpaReal = calculateGPA(courseData);
  const creditsReal = calculateTotalCredits(courseData);

  // GPA with predicted grades merged
  const mergedForPrediction = courseData.map(c => {
    if ((c.diem_10 === null || c.diem_10 === undefined || c.diem_10 < 0) && predictedGrades[c.ma_mon] !== undefined) {
      return { ...c, diem_10: predictedGrades[c.ma_mon] };
    }
    return c;
  });
  const gpaPredicted = calculateGPA(mergedForPrediction);
  const hasPredictions = Object.keys(predictedGrades).length > 0;

  const allWithSim = [...mergedForPrediction, ...simulatedCourses.map(s => ({ ten_mon: s.ten_mon, tin_chi: s.tin_chi, diem_10: s.diem_muc_tieu }))];
  const gpaProjected = calculateGPA(allWithSim);
  const creditsProjected = calculateTotalCredits(allWithSim);

  animateNumber(DOM.gpaValue, hasPredictions ? gpaPredicted : gpaReal, 2);
  if (hasPredictions && DOM.gpaValue) {
    DOM.gpaValue.classList.add('stat-value--predicted');
  } else if (DOM.gpaValue) {
    DOM.gpaValue.classList.remove('stat-value--predicted');
    DOM.gpaValue.classList.add('stat-value--primary');
  }

  if (DOM.creditsCurrent) DOM.creditsCurrent.textContent = creditsReal;
  if (DOM.creditsTotal) DOM.creditsTotal.textContent = totalCreditsRequired;

  const pct = Math.min((creditsReal / totalCreditsRequired) * 100, 100);
  if (DOM.creditsProgress) DOM.creditsProgress.style.width = `${pct}%`;

  const rank = getAcademicRank(hasPredictions ? gpaPredicted : gpaReal);
  if (DOM.rankValue) DOM.rankValue.textContent = rank;

  if (DOM.simGpaProjected) animateNumber(DOM.simGpaProjected, gpaProjected, 2);
  if (DOM.simCreditsProjected) DOM.simCreditsProjected.textContent = creditsProjected;

  if (DOM.gpaValue) {
    DOM.gpaValue.classList.add('gpa-updated');
    setTimeout(() => DOM.gpaValue.classList.remove('gpa-updated'), 500);
  }
}

function renderCourseTable() {
  const tbody = DOM.courseTbody;
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!courseData.length) {
    if (DOM.welcomeView) DOM.welcomeView.style.display = 'block';
    if (DOM.dataView) DOM.dataView.style.display = 'none';
    if (DOM.tableEmpty) DOM.tableEmpty.style.display = 'block';
    return;
  }
  
  if (DOM.welcomeView) DOM.welcomeView.style.display = 'none';
  if (DOM.dataView) DOM.dataView.style.display = 'block';
  if (DOM.tableEmpty) DOM.tableEmpty.style.display = 'none';

  // Nhóm theo học kỳ
  const grouped = {};
  courseData.forEach(c => {
    const key = c.hoc_ky || 'Chưa phân loại';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  let globalIdx = 1;
  let cumGPA4 = 0; // Cumulative GPA 4 calculations need to track overall academic courses up to this semester? 
  // Wait, the image shows "Điểm trung bình tích lũy", this means we should compute cumulative based on all courses? 
  // Let's just use the current courseData for cumulative. 
  const allGPA4 = calculateGPA(courseData);
  const allGPA10 = calculateGPA10(courseData);
  const allTC = calculateTotalCredits(courseData);

  // Hàm phụ trợ trích xuất năm học và học kỳ để sắp xếp
  function getSemesterScore(str) {
    // Tìm cấu trúc "học kỳ 1" và "2024"
    const match = str.match(/(?:học\s*kỳ|hk)\s*(\d+).*?(\d{4})/i);
    if (match) {
      const sem = parseInt(match[1], 10);
      const year = parseInt(match[2], 10);
      return year * 10 + sem; // VD: 20241, 20242, 20251
    }
    return 0; // Giá trị thấp nhất nếu không nhận diện được
  }

  // Sắp xếp các học kỳ từ mới nhất đến cũ nhất (từ dưới lên trên theo thời gian)
  const sortedSemesters = Object.entries(grouped).sort((a, b) => {
    if (a[0] === 'Chưa phân loại' || a[0] === 'Học kỳ chưa xác định') return 1;
    if (b[0] === 'Chưa phân loại' || b[0] === 'Học kỳ chưa xác định') return -1;
    
    const scoreA = getSemesterScore(a[0]);
    const scoreB = getSemesterScore(b[0]);
    
    if (scoreA !== scoreB) {
      return scoreB - scoreA; // Giảm dần
    }
    
    // Nếu cùng điểm thì dùng localeCompare ngược
    return b[0].localeCompare(a[0]);
  });

  sortedSemesters.forEach(([semester, courses]) => {
    // 1. Dòng tiêu đề học kỳ (Xám)
    const headerTr = document.createElement('tr');
    headerTr.className = 'semester-group-header';
    headerTr.innerHTML = `<td colspan="8">${escapeHtml(semester)}</td>`;
    tbody.appendChild(headerTr);

    // 2. Các môn học
    courses.forEach(course => {
      const excluded = isExcludedFromGPA(course);
      const gradeInfo = getGradeInfo(course.diem_10);
      const isExempt = gradeInfo.diemChu === 'M' || course.diem_chu === 'M';
      const hasScore = course.diem_10 !== null && course.diem_10 !== undefined && course.diem_10 >= 0;

      const tr = document.createElement('tr');
      if (excluded) tr.className = 'excluded-row';

      let scoreCell, gradeCell, diem4Cell;

      if (hasScore) {
        scoreCell = course.diem_10.toFixed(1);
        gradeCell = `<span class="grade-badge grade-badge--${gradeInfo.cssClass}">${gradeInfo.diemChu}</span>`;
        diem4Cell = gradeInfo.diemHe4.toFixed(1);
      } else if (isExempt) {
        scoreCell = '<span class="grade-badge grade-badge--m">M</span>';
        gradeCell = '<span class="grade-badge grade-badge--m">M</span>';
        diem4Cell = '—';
      } else {
        const predicted = predictedGrades[course.ma_mon];
        scoreCell = `<input type="number" class="predict-grade-input" data-ma="${escapeHtml(course.ma_mon)}" step="0.1" min="0" max="10" placeholder="?.?" value="${predicted !== undefined ? predicted : ''}">`;
        if (predicted !== undefined) {
          const pInfo = getGradeInfo(predicted);
          gradeCell = `<span class="grade-badge grade-badge--predicted">${pInfo.diemChu}?</span>`;
          diem4Cell = `<span style="color:#8e44ad">${pInfo.diemHe4.toFixed(1)}?</span>`;
        } else {
          gradeCell = '—';
          diem4Cell = '—';
        }
      }

      tr.innerHTML = `
        <td>${globalIdx++}</td>
        <td><strong>${escapeHtml(course.ma_mon)}</strong></td>
        <td class="td-name">${escapeHtml(course.ten_mon)}${excluded ? ' <small class="tag-excluded">(KTT)</small>' : ''}</td>
        <td>${course.tin_chi}</td>
        <td>${scoreCell}</td>
        <td>${diem4Cell}</td>
        <td>${gradeCell}</td>
        <td><button class="btn-delete btn-delete-course" data-ma="${escapeHtml(course.ma_mon)}" title="Xóa">✕</button></td>
      `;
      tbody.appendChild(tr);
    });

    // 3. Tính toán thống kê cho học kỳ
    const semGPA4 = calculateGPA(courses);
    const semGPA10 = calculateGPA10(courses);
    const semTC = calculateTotalCredits(courses);
    const rank = getAcademicRank(semGPA4);

    // 4. Dòng tổng kết học kỳ (Xanh dương)
    const summaryTr = document.createElement('tr');
    summaryTr.className = 'semester-summary-row';
    summaryTr.innerHTML = `
      <td colspan="4">
        <div class="semester-summary-col">
          <div class="semester-summary-item">
            <span>- Điểm trung bình học kỳ hệ 4:</span>
            <span class="semester-summary-val">${semGPA4.toFixed(2)}</span>
          </div>
          <div class="semester-summary-item">
            <span>- Điểm trung bình học kỳ hệ 10:</span>
            <span class="semester-summary-val">${semGPA10.toFixed(2)}</span>
          </div>
          <div class="semester-summary-item">
            <span>- Số tín chỉ đạt học kỳ:</span>
            <span class="semester-summary-val">${semTC}</span>
          </div>
        </div>
      </td>
      <td colspan="4">
        <div class="semester-summary-col">
          <div class="semester-summary-item" style="color: #64748b;">
            <span>- Điểm trung bình tích lũy hệ 4:</span>
            <span class="semester-summary-val">${allGPA4.toFixed(2)}</span>
          </div>
          <div class="semester-summary-item" style="color: #64748b;">
            <span>- Điểm trung bình tích lũy hệ 10:</span>
            <span class="semester-summary-val">${allGPA10.toFixed(2)}</span>
          </div>
          <div class="semester-summary-item" style="color: #64748b;">
            <span>- Số tín chỉ tích lũy:</span>
            <span class="semester-summary-val">${allTC}</span>
          </div>
        </div>
      </td>
    `;
    // We can also add Rank but let's keep it clean
    tbody.appendChild(summaryTr);
  });

  // Bind prediction inputs
  tbody.querySelectorAll('.predict-grade-input').forEach(input => {
    input.addEventListener('input', () => {
      const ma = input.dataset.ma;
      const val = parseFloat(input.value);
      if (!isNaN(val) && val >= 0 && val <= 10) predictedGrades[ma] = val;
      else delete predictedGrades[ma];
      updateDashboard();
      renderGradeDistribution();
    });
  });

  // Bind delete buttons
  tbody.querySelectorAll('.btn-delete-course').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ma = btn.dataset.ma;
      const course = courseData.find(c => c.ma_mon === ma);
      if (!course) return;
      if (!confirm(`Xóa "${course.ten_mon}"?`)) return;
      await deleteCourse(course);
      renderCourseTable();
      renderGradeDistribution();
      updateDashboard();
    });
  });
}

function renderGradeDistribution() {
  if (!DOM.gradeDistribution) return;
  const counts = { a: 0, b: 0, c: 0, d: 0, f: 0 };
  let total = 0;
  courseData.forEach(c => {
    const score = c.diem_10 ?? predictedGrades[c.ma_mon] ?? null;
    if (score === null || score === undefined || score < 0) return;
    const gi = getGradeInfo(score);
    if (gi.cssClass !== 'm' && counts[gi.cssClass] !== undefined) {
      counts[gi.cssClass]++;
      total++;
    }
  });

  const labels = [
    { key: 'a', label: 'A', fill: 'a' },
    { key: 'b', label: 'B/B+', fill: 'b' },
    { key: 'c', label: 'C/C+', fill: 'c' },
    { key: 'd', label: 'D/D+', fill: 'd' },
    { key: 'f', label: 'F', fill: 'f' },
  ];

  DOM.gradeDistribution.innerHTML = '';
  labels.forEach(({ key, label, fill }) => {
    const pct = total > 0 ? (counts[key] / total) * 100 : 0;
    const row = document.createElement('div');
    row.className = 'grade-bar-row';
    row.innerHTML = `
      <span class="grade-bar-label">${label}</span>
      <div class="grade-bar-track">
        <div class="grade-bar-fill grade-bar-fill--${fill}" style="width:0%"></div>
      </div>
      <span class="grade-bar-count">${counts[key]}</span>
    `;
    DOM.gradeDistribution.appendChild(row);
    requestAnimationFrame(() => {
      setTimeout(() => { row.querySelector('.grade-bar-fill').style.width = `${pct}%`; }, 80);
    });
  });
}

function renderSimulatedList() {
  if (!DOM.simList || !DOM.simCount) return;
  DOM.simList.innerHTML = '';
  DOM.simCount.textContent = simulatedCourses.length;

  simulatedCourses.forEach((sim, idx) => {
    const li = document.createElement('li');
    li.className = 'sim-item';
    li.innerHTML = `
      <div class="sim-item__info">
        <span class="sim-item__name">${escapeHtml(sim.ten_mon)}</span>
        <span class="sim-item__meta">${sim.tin_chi} TC · Mục tiêu: ${sim.diem_muc_tieu.toFixed(1)}</span>
      </div>
      <button class="sim-item__delete" data-idx="${idx}" title="Xóa">✕</button>
    `;
    DOM.simList.appendChild(li);
  });

  DOM.simList.querySelectorAll('.sim-item__delete').forEach(btn => {
    btn.addEventListener('click', () => {
      simulatedCourses.splice(parseInt(btn.dataset.idx, 10), 1);
      renderSimulatedList();
      updateDashboard();
    });
  });
}

// ======================= EVENT HANDLERS =======================
function onAuthSuccess() {
  if (DOM.userEmailDisplay) DOM.userEmailDisplay.textContent = currentUser?.email || '';
  loadCourseData().then(() => {
    // Auto-discover semesters from data
    courseData.forEach(c => {
      if (c.hoc_ky && !semesters.includes(c.hoc_ky)) {
        semesters.push(c.hoc_ky);
      }
    });
    saveSemesters();
    renderCourseTable();
    renderGradeDistribution();
    renderSimulatedList();
    updateDashboard();
  });
}

function bindEvents() {
  // Auth
  if (DOM.authForm) {
    DOM.authForm.addEventListener('submit', e => {
      e.preventDefault();
      handleLogin(DOM.authEmail.value.trim(), DOM.authPassword.value);
    });
  }
  if (DOM.btnRegister) {
    DOM.btnRegister.addEventListener('click', () => {
      signUpUser(DOM.authEmail.value.trim(), DOM.authPassword.value);
    });
  }
  if (DOM.btnLogout) DOM.btnLogout.addEventListener('click', handleLogout);
  const navAvatar = $('#nav-avatar');
  if (navAvatar) navAvatar.addEventListener('click', handleLogout);

  // Settings
  if (DOM.btnSaveSettings) DOM.btnSaveSettings.addEventListener('click', saveSettings);

  // Add Semester
  if (DOM.btnAddSemester) {
    DOM.btnAddSemester.addEventListener('click', () => {
      const name = prompt('Nhập tên học kỳ (VD: Học kỳ 1 - Năm 2):');
      if (name && name.trim()) {
        addSemester(name.trim());
        DOM.semesterSelect.value = name.trim();
      }
    });
  }

  // Manual Add / New Buttons
  if (DOM.btnManualAdd) {
    DOM.btnManualAdd.addEventListener('click', () => {
      const name = prompt('Nhập tên học kỳ (VD: Học kỳ 1 - Năm 2):');
      if (name && name.trim()) {
        addSemester(name.trim());
        if (DOM.semesterSelect) DOM.semesterSelect.value = name.trim();
        switchPage('dashboard');
      }
    });
  }
  if (DOM.btnGotoRoadmap) {
    DOM.btnGotoRoadmap.addEventListener('click', () => switchPage('roadmap'));
  }

  // Modal Handlers
  if (DOM.btnOpenModal) {
    DOM.btnOpenModal.forEach(btn => btn.addEventListener('click', () => {
      if (DOM.portalModal) DOM.portalModal.classList.add('active');
    }));
  }
  if (DOM.btnCloseModal) DOM.btnCloseModal.addEventListener('click', () => {
    if (DOM.portalModal) DOM.portalModal.classList.remove('active');
  });
  if (DOM.btnCancelModal) DOM.btnCancelModal.addEventListener('click', () => {
    if (DOM.portalModal) DOM.portalModal.classList.remove('active');
  });

  // Textarea input monitor
  if (DOM.inputTranscript) {
    DOM.inputTranscript.addEventListener('input', (e) => {
      const text = e.target.value.trim();
      if (text.length > 20) {
        if (DOM.modalStatusText) DOM.modalStatusText.innerHTML = '<span class="status-dot" style="background:#22c55e"></span> SẴN SÀNG';
        if (DOM.btnParseSave) {
          DOM.btnParseSave.disabled = false;
          DOM.btnParseSave.style = 'background-color: #4f46e5; color: #ffffff; cursor: pointer; border-radius: 12px; padding: 12px 24px; font-weight: 600; font-size: 15px;';
        }
      } else {
        if (DOM.modalStatusText) DOM.modalStatusText.innerHTML = '<span class="status-dot"></span> CHỜ DỮ LIỆU';
        if (DOM.btnParseSave) {
          DOM.btnParseSave.disabled = true;
          DOM.btnParseSave.style = 'background-color: #e2e8f0; color: #94a3b8; border: none; cursor: not-allowed; border-radius: 12px; padding: 12px 24px; font-weight: 600; font-size: 15px;';
        }
      }
    });
  }

  // Parse & Save
  if (DOM.btnParseSave) {
    DOM.btnParseSave.addEventListener('click', async () => {
      const text = DOM.inputTranscript?.value?.trim();
      if (!text) { showParseMessage('Vui lòng dán bảng điểm trước.', 'error'); return; }

      const parsed = parseTranscript(text);
      if (!parsed.length) { showParseMessage('Không tìm thấy dữ liệu. Kiểm tra định dạng.', 'error'); return; }

      // Assign semester
      const selectedSemester = DOM.semesterSelect?.value || '';
      parsed.forEach(c => {
        if (selectedSemester) c.hoc_ky = selectedSemester;
        else if (c.hoc_ky) { /* keep auto-detected */ }
        else c.hoc_ky = 'Chưa phân loại';
      });

      DOM.btnParseSave.classList.add('loading');
      DOM.btnParseSave.innerHTML = '<span class="spinner"></span> Đang lưu...';

      let ok = 0;
      if (isUsingMockData) {
        parsed.forEach(c => {
          const idx = courseData.findIndex(x => x.ma_mon === c.ma_mon);
          if (idx >= 0) Object.assign(courseData[idx], c);
          else courseData.push({ id: Date.now() + ok, ...c, user_id: MOCK_USER.id });
          ok++;
        });
        localStorage.setItem(`user_grades_data_${currentUser?.email || 'default'}`, JSON.stringify(courseData));
      } else {
        for (const course of parsed) {
          try { await saveCourseToCloud(course); ok++; } catch (e) { console.error(`Lỗi: ${course.ten_mon}`, e); }
        }
        // Re-fetch from server to sync
        await loadCourseData();
      }

      DOM.btnParseSave.classList.remove('loading');
      DOM.btnParseSave.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Phân tích & Lưu';

      if (ok > 0) {
        showParseMessage(ok < parsed.length
          ? `Lưu ${ok}/${parsed.length} môn. Xem Console (F12) cho lỗi.`
          : `Thành công! Đã lưu ${ok} môn học.`,
          ok < parsed.length ? 'error' : 'success'
        );
        DOM.inputTranscript.value = '';
        if (DOM.portalModal) DOM.portalModal.classList.remove('active');
        if (DOM.modalStatusText) DOM.modalStatusText.innerHTML = '<span class="status-dot"></span> CHỜ DỮ LIỆU';
        if (DOM.btnParseSave) {
          DOM.btnParseSave.disabled = true;
          DOM.btnParseSave.style = 'background-color: #e2e8f0; color: #94a3b8; border: none; cursor: not-allowed; border-radius: 12px; padding: 12px 24px; font-weight: 600; font-size: 15px;';
        }
        
        // Auto-add semester
        parsed.forEach(c => {
          if (c.hoc_ky && !semesters.includes(c.hoc_ky)) semesters.push(c.hoc_ky);
        });
        saveSemesters();
        renderCourseTable();
        renderGradeDistribution();
        updateDashboard();
      } else {
        showParseMessage('Lưu thất bại toàn bộ. Kiểm tra Console.', 'error');
      }
    });
  }

  // Simulation
  if (DOM.simForm) {
    DOM.simForm.addEventListener('submit', e => {
      e.preventDefault();
      const name = DOM.simName?.value?.trim();
      const credits = parseInt(DOM.simCredits?.value, 10);
      const grade = parseFloat(DOM.simGrade?.value);
      if (!name || isNaN(credits) || isNaN(grade)) return;

      simulatedCourses.push({
        id: Date.now(),
        ten_mon: name,
        tin_chi: credits,
        diem_muc_tieu: Math.min(Math.max(grade, 0), 10),
      });
      DOM.simName.value = '';
      DOM.simCredits.value = '';
      DOM.simGrade.value = '';
      DOM.simName.focus();
      renderSimulatedList();
      updateDashboard();
    });
  }
}

// ======================= INIT =======================
async function init() {
  await initSupabase();
  loadSettings();
  loadSemesters();
  initSidebar();
  bindEvents();

  if (!isUsingMockData && supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        if (!currentUser || currentUser.id !== session.user.id) {
          currentUser = session.user;
          showScreen('main');
          onAuthSuccess();
        }
      } else {
        currentUser = null;
        courseData = [];
        simulatedCourses = [];
        showScreen('auth');
      }
    });
  } else {
    showScreen('auth');
  }
}

init();
