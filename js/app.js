// ================================================================
// Credit & GPA Strategist — app.js
// Main Application Logic (ES6 Module)
// Supabase Integration + Mock Data Fallback
// ================================================================

// ======================= SUPABASE CONFIG =======================
// Điền key thật vào đây. Nếu để trống, hệ thống dùng Mock Data.
const SUPABASE_URL = 'https://uhqvankajktrkbydfixk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pKLKuuSiLu2Bwp4hpUxIPg_3OdOFa6h';

// ======================= CONSTANTS =======================
const TOTAL_CREDITS_REQUIRED = 150;

// ======================= STATE =======================
let supabase = null;
let currentUser = null;
let isUsingMockData = true;
let courseData = [];       // Dữ liệu môn từ DB / Mock
let simulatedCourses = []; // Dữ liệu giả lập (local state)

// ======================= MOCK DATA =======================
const MOCK_USER = {
  email: 'demo@gpastrategy.app',
  id: 'mock-user-001'
};

const MOCK_COURSES = [
  // --- 3 môn mẫu gốc từ đề bài ---
  { id: 1, ma_mon: 'MAT101', ten_mon: 'Toán Đại số', tin_chi: 3, diem_10: 7.0 },
  { id: 2, ma_mon: 'CSE102', ten_mon: 'Cơ sở Tin học', tin_chi: 4, diem_10: 6.5 },
  { id: 3, ma_mon: 'CSE201', ten_mon: 'Cấu trúc dữ liệu', tin_chi: 3, diem_10: 5.0 },
  // --- Các môn bổ sung để đạt ~50 TC, GPA ≈ 2.67 ---
  { id: 4, ma_mon: 'PHY101', ten_mon: 'Vật lý Đại cương', tin_chi: 3, diem_10: 7.5 },
  { id: 5, ma_mon: 'ENG101', ten_mon: 'Tiếng Anh 1', tin_chi: 3, diem_10: 9.0 },
  { id: 6, ma_mon: 'MAT102', ten_mon: 'Giải tích 1', tin_chi: 4, diem_10: 6.0 },
  { id: 7, ma_mon: 'CSE103', ten_mon: 'Lập trình C/C++', tin_chi: 3, diem_10: 7.0 },
  { id: 8, ma_mon: 'POL101', ten_mon: 'Triết học Mác - Lênin', tin_chi: 3, diem_10: 7.0 },
  { id: 9, ma_mon: 'MAT201', ten_mon: 'Xác suất Thống kê', tin_chi: 3, diem_10: 6.0 },
  { id: 10, ma_mon: 'CSE202', ten_mon: 'Lập trình Hướng đối tượng', tin_chi: 3, diem_10: 7.5 },
  { id: 11, ma_mon: 'CSE203', ten_mon: 'Cơ sở Dữ liệu', tin_chi: 4, diem_10: 6.0 },
  { id: 12, ma_mon: 'ENG102', ten_mon: 'Tiếng Anh 2', tin_chi: 3, diem_10: 7.0 },
  { id: 13, ma_mon: 'CSE301', ten_mon: 'Thuật toán Nâng cao', tin_chi: 3, diem_10: 5.0 },
  { id: 14, ma_mon: 'PHY102', ten_mon: 'Vật lý Đại cương 2', tin_chi: 2, diem_10: 6.5 },
  { id: 15, ma_mon: 'POL102', ten_mon: 'Kinh tế Chính trị', tin_chi: 3, diem_10: 6.5 },
  { id: 16, ma_mon: 'CSE302', ten_mon: 'Kỹ thuật Lập trình', tin_chi: 3, diem_10: 8.0 },
];

const MOCK_SIMULATED = [
  { id: Date.now(), ten_mon: 'Mạng máy tính nhóm 1', tin_chi: 3, diem_muc_tieu: 8.0 },
  { id: Date.now() + 1, ten_mon: 'Hệ điều hành nhóm 1', tin_chi: 3, diem_muc_tieu: 8.5 },
];


// ======================= SUPABASE INITIALIZATION =======================
async function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[GPA Strategist] Supabase chưa cấu hình → Sử dụng Mock Data.');
    isUsingMockData = true;
    return;
  }

  try {
    // Dynamic import Supabase SDK from CDN
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    isUsingMockData = false;
    console.log('[GPA Strategist] Supabase đã kết nối thành công.');
  } catch (err) {
    console.error('[GPA Strategist] Không thể khởi tạo Supabase:', err);
    isUsingMockData = true;
  }
}


// ======================= YÊU CẦU 1: THANG ĐIỂM & THUẬT TOÁN GPA =======================

/**
 * Mảng cấu hình GRADING_SCALE — Barem quy đổi chính xác.
 * Mỗi phần tử: { min, max, diemChu, diemHe4, cssClass }
 * Sắp xếp giảm dần theo min để hàm convertGrade duyệt từ cao xuống.
 */
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

/**
 * Quy đổi điểm hệ 10 sang object { diemChu, diemHe4 }.
 * Duyệt qua GRADING_SCALE từ mức cao nhất xuống.
 * @param {number} diemHe10 - Điểm trên thang 10 (0.0 → 10.0)
 * @returns {{ diemChu: string, diemHe4: number }}
 */
function convertGrade(diemHe10) {
  // Clamp giá trị vào [0, 10]
  const score = Math.max(0, Math.min(10, diemHe10));

  for (const level of GRADING_SCALE) {
    if (score >= level.min) {
      return { diemChu: level.diemChu, diemHe4: level.diemHe4 };
    }
  }
  // Fallback (không bao giờ xảy ra nếu GRADING_SCALE có min=0)
  return { diemChu: 'F', diemHe4: 0.0 };
}

/**
 * Trả về thông tin đầy đủ từ GRADING_SCALE (bao gồm cssClass cho UI).
 * Thay thế hàm getLetterGrade cũ.
 * @param {number} diemHe10
 * @returns {{ diemChu: string, diemHe4: number, cssClass: string }}
 */
function getGradeInfo(diemHe10) {
  if (diemHe10 === null || diemHe10 < 0) {
    return { diemChu: 'M', diemHe4: 4.0, cssClass: 'm' };
  }
  const score = Math.max(0, Math.min(10, diemHe10));
  for (const level of GRADING_SCALE) {
    if (score >= level.min) {
      return {
        diemChu: level.diemChu,
        diemHe4: level.diemHe4,
        cssClass: level.cssClass,
      };
    }
  }
  return { diemChu: 'F', diemHe4: 0.0, cssClass: 'f' };
}

/**
 * Xếp loại học lực dựa trên GPA hệ 4.
 * @param {number} gpa - GPA tích lũy hệ 4
 * @returns {string} Xếp loại tiếng Việt
 */
function getAcademicRank(gpa) {
  if (gpa >= 3.6) return 'Xuất sắc';
  if (gpa >= 3.2) return 'Giỏi';
  if (gpa >= 2.5) return 'Khá';
  if (gpa >= 2.0) return 'Trung bình';
  if (gpa >= 1.0) return 'Yếu';
  return 'Kém';
}

/**
 * Tính GPA tích lũy theo ĐÚNG thuật toán:
 *   1. Quy đổi điểm hệ 10 của TỪNG MÔN → điểm hệ 4 (qua convertGrade)
 *   2. Nhân điểm hệ 4 × số tín chỉ của môn đó
 *   3. Cộng tổng tất cả → chia cho tổng tín chỉ
 * KHÔNG tính trung bình hệ 10 rồi mới quy đổi.
 *
 * @param {Array} courses - [{ tin_chi, diem_10 }] hoặc [{ tin_chi, diem_muc_tieu }]
 * @returns {number} GPA hệ 4 (0.00 → 4.00)
 */
function calculateGPA(courses) {
  if (!courses.length) return 0;

  let tongDiemHe4_x_TinChi = 0; // Σ (điểm_hệ_4_i × tín_chỉ_i)
  let tongTinChi = 0;            // Σ tín_chỉ_i

  for (const c of courses) {
    const diemHe10 = c.diem_10 ?? c.diem_muc_tieu ?? null;
    // Bỏ qua môn chưa có điểm
    if (diemHe10 === null || diemHe10 === undefined) continue;

    // BƯỚC 1: Quy đổi điểm từng môn sang hệ 4
    const { diemHe4 } = convertGrade(diemHe10);

    // BƯỚC 2: Nhân với tín chỉ
    tongDiemHe4_x_TinChi += diemHe4 * c.tin_chi;
    tongTinChi += c.tin_chi;
  }

  // BƯỚC 3: Chia tổng
  return tongTinChi > 0 ? tongDiemHe4_x_TinChi / tongTinChi : 0;
}

/**
 * Tính tổng tín chỉ từ danh sách môn.
 * @param {Array} courses
 * @returns {number}
 */
function calculateTotalCredits(courses) {
  return courses.reduce((sum, c) => sum + (c.tin_chi || 0), 0);
}


// ======================= DOM REFERENCES =======================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  // Auth
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

  // Theme
  themeToggle: $('#theme-toggle'),
  iconSun: $('#icon-sun'),
  iconMoon: $('#icon-moon'),

  // Dashboard
  gpaValue: $('#gpa-value'),
  creditsCurrent: $('#credits-current'),
  creditsTotal: $('#credits-total'),
  creditsProgress: $('#credits-progress'),
  creditsPercent: $('#credits-percent'),
  rankValue: $('#rank-value'),

  // Input
  inputTranscript: $('#input-transcript'),
  btnParseSave: $('#btn-parse-save'),
  parseMessage: $('#parse-message'),

  // Table
  courseTbody: $('#course-tbody'),
  tableEmpty: $('#table-empty'),

  // Chart
  gradeDistribution: $('#grade-distribution'),

  // Simulation
  simForm: $('#sim-form'),
  simName: $('#sim-name'),
  simCredits: $('#sim-credits'),
  simGrade: $('#sim-grade'),
  simList: $('#sim-list'),
  simCount: $('#sim-count'),
  simSummary: $('#sim-summary'),
  simGpaProjected: $('#sim-gpa-projected'),
  simCreditsProjected: $('#sim-credits-projected'),
};


// ======================= THEME MANAGEMENT =======================
function initTheme() {
  // Bỏ qua theme (Soft UI mặc định là sáng)
}

function setTheme(theme) {
}

function toggleTheme() {
}


// ======================= AUTH HELPERS =======================
function showAuthMessage(msg, type = 'error') {
  DOM.authMessage.textContent = msg;
  DOM.authMessage.className = `auth-message show ${type}`;
  setTimeout(() => {
    DOM.authMessage.classList.remove('show');
  }, 5000);
}

function showParseMessage(msg, type = 'success') {
  DOM.parseMessage.textContent = msg;
  DOM.parseMessage.className = `auth-message show ${type}`;
  setTimeout(() => {
    DOM.parseMessage.classList.remove('show');
  }, 4000);
}

function showScreen(screen) {
  if (screen === 'auth') {
    DOM.authScreen.style.display = 'flex';
    DOM.mainApp.style.display = 'none';
  } else {
    DOM.authScreen.style.display = 'none';
    DOM.mainApp.style.display = 'block';
  }
}


// ======================= YÊU CẦU 2: AUTH — SUPABASE (HOÀN THIỆN) =======================

/**
 * Dịch mã lỗi Supabase Auth sang tiếng Việt thân thiện.
 * @param {Object} error - Object lỗi từ Supabase { message, status }
 * @returns {string} Thông báo lỗi tiếng Việt
 */
function translateAuthError(error) {
  const msg = (error?.message || '').toLowerCase();
  const status = error?.status;

  // ── Lỗi đăng ký ──
  if (msg.includes('user already registered') || msg.includes('already been registered'))
    return 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.';
  if (msg.includes('password') && msg.includes('at least'))
    return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (msg.includes('valid email') || msg.includes('invalid email'))
    return 'Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.';
  if (msg.includes('signup is disabled'))
    return 'Chức năng đăng ký đã bị tắt trên server.';

  // ── Lỗi đăng nhập ──
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials'))
    return 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.';
  if (msg.includes('email not confirmed'))
    return 'Tài khoản chưa xác nhận email. Kiểm tra hộp thư để xác nhận.';
  if (status === 429 || msg.includes('rate limit'))
    return 'Bạn đã thử quá nhiều lần. Vui lòng chờ 1 phút rồi thử lại.';

  // ── Lỗi mạng / chung ──
  if (msg.includes('fetch') || msg.includes('network'))
    return 'Lỗi kết nối mạng. Kiểm tra internet và thử lại.';

  return error?.message || 'Đã xảy ra lỗi không xác định.';
}

/**
 * Validate email phía client trước khi gửi lên Supabase.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Đăng nhập bằng Supabase Auth API.
 * Hiển thị lỗi màu đỏ nếu thất bại, chuyển màn hình nếu thành công.
 * @param {string} email
 * @param {string} password
 */
async function handleLogin(email, password) {
  // ── Validate phía client ──
  if (!isValidEmail(email)) {
    showAuthMessage('Địa chỉ email không hợp lệ.', 'error');
    return;
  }
  if (password.length < 6) {
    showAuthMessage('Mật khẩu phải có ít nhất 6 ký tự.', 'error');
    return;
  }

  // ── Mock mode ──
  if (isUsingMockData) {
    currentUser = { ...MOCK_USER, email };
    showScreen('main');
    onAuthSuccess();
    return;
  }

  // ── Gọi Supabase Auth ──
  DOM.btnLogin.classList.add('loading');
  DOM.btnLogin.innerHTML = '<span class="spinner"></span> Đang đăng nhập...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // UI và trạng thái sẽ được onAuthStateChange tự động xử lý
  } catch (err) {
    showAuthMessage(translateAuthError(err), 'error');
  } finally {
    DOM.btnLogin.classList.remove('loading');
    DOM.btnLogin.innerHTML = '<span class="btn-icon">→</span> Đăng nhập';
  }
}

/**
 * Đăng ký tài khoản mới bằng Supabase Auth API.
 * Hiển thị lỗi màu đỏ nếu thất bại, thông báo xanh nếu thành công.
 * @param {string} email
 * @param {string} password
 */
async function signUpUser(email, password) {
  // ── Validate phía client ──
  if (!isValidEmail(email)) {
    showAuthMessage('Địa chỉ email không hợp lệ.', 'error');
    return;
  }
  if (password.length < 6) {
    showAuthMessage('Mật khẩu phải có ít nhất 6 ký tự.', 'error');
    return;
  }

  // ── Mock mode ──
  if (isUsingMockData) {
    showAuthMessage(
      'Đăng ký thành công, vui lòng đăng nhập',
      'success'
    );
    return;
  }

  // ── Gọi Supabase Auth ──
  DOM.btnRegister.classList.add('loading');
  DOM.btnRegister.innerHTML = '<span class="spinner"></span> Đang đăng ký...';

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // Supabase trả về user nhưng identities rỗng → email đã tồn tại
    if (data?.user && data.user.identities?.length === 0) {
      showAuthMessage(
        'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.',
        'error'
      );
      return;
    }

    showAuthMessage(
      'Đăng ký thành công, vui lòng đăng nhập',
      'success'
    );
  } catch (err) {
    showAuthMessage(translateAuthError(err), 'error');
  } finally {
    DOM.btnRegister.classList.remove('loading');
    DOM.btnRegister.innerHTML = '<span class="btn-icon">+</span> Đăng ký tài khoản mới';
  }
}

/**
 * Đăng xuất — clear session và state, quay về Auth Screen.
 */
async function handleLogout() {
  if (!isUsingMockData && supabase) {
    try {
      await supabase.auth.signOut();
      // onAuthStateChange sẽ tự động clear state và quay về form Auth
    } catch (err) {
      console.error('[Auth] Lỗi đăng xuất:', err);
    }
  } else {
    // Chỉ xử lý manual khi ở chế độ Mock Data
    currentUser = null;
    courseData = [];
    simulatedCourses = [];
    showScreen('auth');
  }
}


// ======================= DATA — SUPABASE CRUD =======================

/**
 * Tải dữ liệu môn học từ Supabase (hoặc Mock Data)
 */
async function loadCourseData() {
  if (isUsingMockData) {
    const localData = localStorage.getItem('user_grades_data');
    if (localData) {
      try {
        courseData = JSON.parse(localData);
      } catch (e) {
        courseData = [...MOCK_COURSES];
      }
    } else {
      courseData = [...MOCK_COURSES];
    }
    simulatedCourses = [...MOCK_SIMULATED];
    return;
  }

  try {
    const { data, error } = await supabase
      .from('TienTrinhHocTap')
      .select('*')
      .eq('user_id', currentUser.id);

    if (error) throw error;
    courseData = data || [];
  } catch (err) {
    console.error('[Data] Lỗi tải dữ liệu:', err);
    showParseMessage('Lỗi tải dữ liệu từ server.', 'error');
  }
}

/**
 * Lưu một bản ghi mới lên Supabase
 * @param {Object} course - { ma_mon, ten_mon, tin_chi, diem_10 }
 */
async function saveCourseToCloud(course) {
  if (isUsingMockData) {
    const newCourse = { id: Date.now(), ...course, user_id: MOCK_USER.id };
    courseData.push(newCourse);
    return newCourse;
  }

  try {
    const payload = {
      user_id: currentUser.id,
      ma_mon: course.ma_mon,
      ten_mon: course.ten_mon,
      tin_chi: course.tin_chi,
      diem_10: (course.diem_10 == null) ? -1 : course.diem_10,
    };

    // upsert sẽ ghi đè nếu trùng mã môn của cùng 1 user
    const { data, error } = await supabase
      .from('TienTrinhHocTap')
      .upsert(payload, { onConflict: 'ma_mon, user_id' })
      .select();

    if (error) throw error;
    return data?.[0];
  } catch (err) {
    console.error('[Data] Lỗi lưu môn:', course.ma_mon, err);
    throw err;
  }
}


/**
 * Phân tích dữ liệu bảng điểm paste từ cổng thông tin đào tạo (Dính liền).
 * @param {string} rawData
 * @returns {Array<{ hocKy: string, maMon: string, tenMon: string, tinChi: number, diemHe10: number|null, diemChu: string|null }>}
 */
function parsePortalData(rawData) {
  if (!rawData || typeof rawData !== 'string') return [];
  const results = [];
  const lines = rawData.split(/\n/).map(l => l.trim()).filter(Boolean);
  let currentHocKy = "Chưa phân loại";

  // Regex dự phòng cho dữ liệu bị dính liền
  const REGEX = /^(\d{1,3})(\d{6,8})(.*?)([0-9])(M+|(?:\d\.\d)+[A-F][\+\-]?|)$/i;

  for (const line of lines) {
    if (line.toLowerCase().includes('học kỳ') && line.toLowerCase().includes('năm học')) {
      currentHocKy = line;
      continue;
    }

    let maMon = null;
    let tenMon = null;
    let tinChi = null;
    let diemHe10 = null;
    let diemChu = null;

    // Ưu tiên tách bằng tab nếu có (dữ liệu copy từ bảng excel/word/portal có định dạng)
    if (line.includes('\t')) {
      const cols = line.split('\t').map(c => c.trim());
      // Nối cột 1 và 2 (do đôi khi mã môn bị tách làm 2 cột)
      maMon = cols[1];
      let tenMonIndex = 2;

      if (cols[2] && cols[2].match(/^\d+$/)) {
        maMon += cols[2];
        tenMonIndex = 3;
      } else if (cols[2] === '') {
        tenMonIndex = 3;
      }

      tenMon = cols[tenMonIndex];
      tinChi = parseInt(cols[tenMonIndex + 1], 10);

      // Tìm điểm
      const remaining = cols.slice(tenMonIndex + 2).filter(c => c !== '');
      if (remaining.length > 0) {
        if (remaining.includes('M')) {
          diemChu = 'M';
        } else {
          const numScores = remaining.filter(r => !isNaN(parseFloat(r)));
          if (numScores.length > 0) {
            diemHe10 = parseFloat(numScores[0]);
          }
          const letters = remaining.filter(r => r.match(/^[A-F][\+\-]?$/i));
          if (letters.length > 0) {
            diemChu = letters[0].toUpperCase();
          }
        }
      }
    }
    // Nếu không có Tab, thử dùng Regex cho dữ liệu dính liền
    else {
      const match = line.match(REGEX);
      if (match) {
        maMon = match[2];
        tenMon = match[3].trim();
        tinChi = parseInt(match[4], 10);
        const diemRaw = match[5];
        if (diemRaw) {
          if (diemRaw.startsWith('M')) {
            diemChu = 'M';
          } else {
            const numbers = diemRaw.match(/\d\.\d/g);
            if (numbers && numbers.length >= 2) diemHe10 = parseFloat(numbers[1]);
            else if (numbers && numbers.length === 1) diemHe10 = parseFloat(numbers[0]);

            const letterMatch = diemRaw.match(/[A-F][\+\-]?$/i);
            if (letterMatch) diemChu = letterMatch[0].toUpperCase();
          }
        }
      }
    }

    if (maMon && tenMon && !isNaN(tinChi)) {
      results.push({
        hocKy: currentHocKy,
        ma_mon: maMon,
        ten_mon: tenMon,
        tin_chi: tinChi,
        diem_10: diemHe10,
        diem_chu: diemChu
      });
    }
  }

  return results;
}

/**
 * Wrapper tương thích
 */
function parseTranscript(rawData) {
  return parsePortalData(rawData).filter(item => item.diem_10 !== null || item.diem_chu === 'M');
}


// ======================= RENDER FUNCTIONS =======================

/**
 * Cập nhật toàn bộ Dashboard (GPA, Credits, Rank)
 */
function updateDashboard() {
  const allCourses = [...courseData];
  const allWithSim = [...courseData, ...simulatedCourses.map(s => ({
    tin_chi: s.tin_chi,
    diem_10: s.diem_muc_tieu,
  }))];

  // --- GPA hiện tại (chỉ từ courseData) ---
  const gpaReal = calculateGPA(courseData);
  const creditsReal = calculateTotalCredits(courseData);

  // --- GPA dự kiến (courseData + simulated) ---
  const gpaProjected = calculateGPA(allWithSim);
  const creditsProjected = calculateTotalCredits(allWithSim.map(c => ({ tin_chi: c.tin_chi })));

  // Animate GPA value
  animateNumber(DOM.gpaValue, gpaReal, 2);

  // Credits
  if (DOM.creditsCurrent) DOM.creditsCurrent.textContent = creditsReal;
  if (DOM.creditsTotal) DOM.creditsTotal.textContent = TOTAL_CREDITS_REQUIRED;
  const pct = Math.min((creditsReal / TOTAL_CREDITS_REQUIRED) * 100, 100);
  // Delay for smooth animation
  requestAnimationFrame(() => {
    if (DOM.creditsProgress) DOM.creditsProgress.style.width = `${pct}%`;
    if (DOM.creditsPercent) DOM.creditsPercent.textContent = `${pct.toFixed(1)}%`;
  });

  // Rank
  const rank = getAcademicRank(gpaReal);
  if (DOM.rankValue) DOM.rankValue.textContent = rank;

  // Sim summary
  if (simulatedCourses.length > 0) {
    if (DOM.simSummary) DOM.simSummary.style.display = 'flex';
    if (DOM.simGpaProjected) animateNumber(DOM.simGpaProjected, gpaProjected, 2);
    if (DOM.simCreditsProjected) DOM.simCreditsProjected.textContent = creditsProjected;
  } else {
    if (DOM.simSummary) DOM.simSummary.style.display = 'none';
  }

  // Pulse animation
  if (DOM.gpaValue) {
    DOM.gpaValue.classList.add('gpa-updated');
    setTimeout(() => DOM.gpaValue.classList.remove('gpa-updated'), 500);
  }
}

/**
 * Animate a number from current to target
 */
function animateNumber(el, target, decimals = 2) {
  const current = parseFloat(el.textContent) || 0;
  const diff = target - current;
  const duration = 600;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const val = current + diff * ease;
    el.textContent = val.toFixed(decimals);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/**
 * Render bảng môn học
 */
function renderCourseTable() {
  if (!DOM.courseTbody) return;
  DOM.courseTbody.innerHTML = '';

  if (!courseData.length) {
    if (DOM.tableEmpty) {
      DOM.tableEmpty.classList.remove('hidden');
      DOM.tableEmpty.style.display = 'block';
    }
    return;
  }

  if (DOM.tableEmpty) DOM.tableEmpty.style.display = 'none';

  courseData.forEach((course, idx) => {
    // Dùng hàm mới getGradeInfo (thay thế convertTo4Scale + getLetterGrade cũ)
    const gradeInfo = getGradeInfo(course.diem_10);
    const isExempt = gradeInfo.diemChu === 'M';

    const tr = document.createElement('tr');
    tr.style.animationDelay = `${idx * 0.05}s`;
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${escapeHtml(course.ma_mon)}</strong></td>
      <td>${escapeHtml(course.ten_mon)}</td>
      <td>${course.tin_chi}</td>
      <td>${isExempt ? 'M' : course.diem_10.toFixed(1)}</td>
      <td>${gradeInfo.diemHe4.toFixed(1)}</td>
      <td><span class="grade-badge grade-badge--${gradeInfo.cssClass}">${gradeInfo.diemChu}</span></td>
    `;
    DOM.courseTbody.appendChild(tr);
  });
}

/**
 * Render biểu đồ phân bố điểm
 */
function renderGradeDistribution() {
  const counts = { a: 0, b: 0, c: 0, d: 0, f: 0 };
  const total = courseData.length;

  courseData.forEach(c => {
    const gradeInfo = getGradeInfo(c.diem_10);
    counts[gradeInfo.cssClass]++;
  });

  const labels = [
    { key: 'a', label: 'A', fill: 'a' },
    { key: 'b', label: 'B', fill: 'b' },
    { key: 'c', label: 'C', fill: 'c' },
    { key: 'd', label: 'D', fill: 'd' },
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
        <div class="grade-bar-fill grade-bar-fill--${fill}" style="width: 0%;"></div>
      </div>
      <span class="grade-bar-count">${counts[key]}</span>
    `;
    DOM.gradeDistribution.appendChild(row);

    // Animate bar width
    requestAnimationFrame(() => {
      setTimeout(() => {
        row.querySelector('.grade-bar-fill').style.width = `${pct}%`;
      }, 100);
    });
  });
}

/**
 * Render danh sách môn giả lập
 */
function renderSimulatedList() {
  DOM.simList.innerHTML = '';
  DOM.simCount.textContent = simulatedCourses.length;

  simulatedCourses.forEach((sim, idx) => {
    const li = document.createElement('li');
    li.className = 'sim-item';
    li.innerHTML = `
      <div class="sim-item__info">
        <span class="sim-item__name">${escapeHtml(sim.ten_mon)}</span>
        <span class="sim-item__meta">${sim.tin_chi} TC · Điểm mục tiêu: ${sim.diem_muc_tieu.toFixed(1)}</span>
      </div>
      <button class="sim-item__delete" data-idx="${idx}" title="Xóa" aria-label="Xóa môn ${escapeHtml(sim.ten_mon)}">✕</button>
    `;
    DOM.simList.appendChild(li);
  });

  // Attach delete listeners
  DOM.simList.querySelectorAll('.sim-item__delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      simulatedCourses.splice(idx, 1);
      renderSimulatedList();
      updateDashboard();
    });
  });
}


// ======================= HELPER =======================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


// ======================= EVENT HANDLERS =======================

function onAuthSuccess() {
  if (DOM.userEmailDisplay) DOM.userEmailDisplay.textContent = currentUser?.email || '';
  loadCourseData().then(() => {
    renderCourseTable();
    renderGradeDistribution();
    renderSimulatedList();
    updateDashboard();
  });
}

function bindEvents() {
  // --- Auth Form ---
  if (DOM.authForm) {
    DOM.authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = DOM.authEmail.value.trim();
      const password = DOM.authPassword.value;
      if (!email || !password) {
        showAuthMessage('Vui lòng nhập đầy đủ email và mật khẩu.');
        return;
      }
      handleLogin(email, password);
    });
  }

  if (DOM.btnRegister) {
    DOM.btnRegister.addEventListener('click', () => {
      const email = DOM.authEmail.value.trim();
      const password = DOM.authPassword.value;
      if (!email || !password) {
        showAuthMessage('Vui lòng nhập email và mật khẩu để đăng ký.', 'error');
        return;
      }
      // Gọi hàm signUpUser mới (YÊU CẦU 2) — validate bên trong
      signUpUser(email, password);
    });
  }

  if (DOM.btnLogout) DOM.btnLogout.addEventListener('click', handleLogout);

  // --- Theme Toggle ---
  if (DOM.themeToggle) DOM.themeToggle.addEventListener('click', toggleTheme);

  if (DOM.btnParseSave) {
    DOM.btnParseSave.addEventListener('click', async () => {
      const text = DOM.inputTranscript.value.trim();
      if (!text) {
        showParseMessage('Vui lòng nhập bảng điểm trước.', 'error');
        return;
      }

      const parsed = parseTranscript(text);
      if (!parsed.length) {
        showParseMessage('Không phân tích được dữ liệu. Kiểm tra định dạng.', 'error');
        return;
      }

      DOM.btnParseSave.classList.add('loading');
      DOM.btnParseSave.innerHTML = '<span class="spinner"></span> Đang lưu...';

      let successCount = 0;

      if (isUsingMockData) {
        // Lưu toàn bộ dữ liệu bóc tách vào localStorage (Ghi đè hoặc nối thêm)
        // Theo yêu cầu: lập tức lưu cục JSON đó vào localStorage
        courseData = [...parsed];
        localStorage.setItem('user_grades_data', JSON.stringify(courseData));
        successCount = parsed.length;
      } else {
        for (const course of parsed) {
          try {
            await saveCourseToCloud(course);
            successCount++;
          } catch (err) {
            console.error(`Lỗi lưu môn "${course.ten_mon}":`, err.message);
            // Không đè thông báo liên tục, chỉ hiển thị lỗi cuối cùng ở log
          }
        }
      }

      DOM.btnParseSave.classList.remove('loading');
      DOM.btnParseSave.innerHTML = 'Nhập dữ liệu từ Portal';

      if (successCount > 0) {
        if (successCount < parsed.length) {
          showParseMessage(`Lưu thành công ${successCount}/${parsed.length} môn. Xem Console (F12) để biết lỗi môn bị thiếu.`, 'error');
        } else {
          showParseMessage(`Đã lưu thành công ${successCount}/${parsed.length} môn học!`, 'success');
        }
        DOM.inputTranscript.value = '';
        if (DOM.courseTbody) renderCourseTable();
        if (DOM.gradeDistribution) renderGradeDistribution();
        updateDashboard();
      } else if (parsed.length > 0) {
        showParseMessage('Lưu thất bại toàn bộ môn học. Vui lòng kiểm tra Console (F12).', 'error');
      }
    });
  }

  // --- Simulation Form ---
  if (DOM.simForm) {
    DOM.simForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = DOM.simName.value.trim();
      const credits = parseInt(DOM.simCredits.value, 10);
      const grade = parseFloat(DOM.simGrade.value);

      if (!name || isNaN(credits) || isNaN(grade)) {
        return;
      }

      simulatedCourses.push({
        id: Date.now(),
        ten_mon: name,
        tin_chi: credits,
        diem_muc_tieu: Math.min(Math.max(grade, 0), 10),
      });

      // Reset form
      DOM.simName.value = '';
      DOM.simCredits.value = '';
      DOM.simGrade.value = '';
      DOM.simName.focus();

      if (DOM.simList) renderSimulatedList();
      updateDashboard();
    });
  }
}


// ======================= APP INITIALIZATION =======================
async function init() {
  // 1. Set theme
  initTheme();

  // 2. Initialize Supabase
  await initSupabase();

  // 3. Bind events
  bindEvents();

  // 4. Quản lý Auth State Global (Chống lặp vô tận & tự động điều hướng)
  if (!isUsingMockData && supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Chỉ cập nhật nếu user thực sự thay đổi (tránh gọi onAuthSuccess nhiều lần)
        if (!currentUser || currentUser.id !== session.user.id) {
          currentUser = session.user;
          showScreen('main');
          onAuthSuccess();
        }
      } else {
        // Session là null (chưa đăng nhập / đăng xuất) -> Ẩn toàn bộ, hiện Form Login
        currentUser = null;
        courseData = [];
        simulatedCourses = [];
        showScreen('auth');
      }
    });
  } else {
    // Mock Data mode: Mặc định hiện Form Login
    showScreen('auth');
  }
}

// Run app
init();
