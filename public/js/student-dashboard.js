// Firebase imports
import { 
    collection, query, where, getDocs, getDoc, doc, addDoc, orderBy, limit 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth, db } from './auth.js';

// Global variables
let currentUser = null;
let studentData = null;
let enrolledCoursesData = [];
let openSessionsData = [];
let appSettings = null;
let currentSession = null;
let userPosition = null;
let countdownInterval = null;

// DOM elements
const currentTime = document.getElementById('currentTime');
const enrolledCoursesCount = document.getElementById('enrolledCourses');      // <--- แก้ไขตรงนี้
const openSessionsCount = document.getElementById('openSessions');         // <--- แก้ไขตรงนี้
const todayCheckInsCount = document.getElementById('todayCheckedIn');      // <--- แก้ไขตรงนี้
const openSessionsList = document.getElementById('sessionsGrid');        // <--- แก้ไขตรงนี้
const recentCheckInsList = document.getElementById('recentCheckInsList');
const checkInModal = document.getElementById('checkInModal');
const modalSessionInfo = document.getElementById('modalSessionInfo');
const gpsStatus = document.getElementById('gpsStatus');
const distanceInfo = document.getElementById('distanceInfo');
const distanceValue = document.getElementById('distanceValue');
const countdownSection = document.getElementById('countdownSection');
const countdownTime = document.getElementById('countdownTime');
const countdownCircle = document.querySelector('#countdownCircle circle:last-child');
const confirmCheckInBtn = document.getElementById('confirmCheckInBtn');
const loadingSpinner = document.getElementById('loadingSpinner');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await initializeStudentDashboard();
        } else {
            window.location.href = '/login.html';
        }
    });
    
    // Event listeners
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('refreshBtn').addEventListener('click', loadData);
    document.getElementById('closeCheckInModal').addEventListener('click', closeCheckInModal);
    confirmCheckInBtn.addEventListener('click', handleCheckIn);
    
    // Start clock
    startClock();
});

// Initialize student dashboard
async function initializeStudentDashboard() {
    try {
        showLoading(true);
        
        // Verify student access
        const studentsQuery = query(
            collection(db, 'students'), 
            where('email', '==', currentUser.email)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        if (studentsSnapshot.empty) {
            Swal.fire('ไม่มีสิทธิ์เข้าถึง', 'คุณไม่ใช่นักศึกษาในระบบ', 'error');
            const { signOutUser } = await import('./auth.js');
            await signOutUser();
            return;
        }

        studentData = {
            id: studentsSnapshot.docs[0].id,
            ...studentsSnapshot.docs[0].data()
        };
        
        // Load all data in sequence
        await loadData();
        
    } catch (error) {
        console.error('Error initializing:', error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้', 'error');
    } finally {
        showLoading(false);
    }
}

// Load all data
async function loadData() {
    try {
        showLoading(true);
        
        // Load data in correct order
        await loadAppSettings();
        await loadEnrolledCourses();
        await loadOpenSessions();
        await loadTodayCheckIns();
        await loadRecentCheckIns();
        
        // Update UI after all data is loaded
        updateDashboardStats();
        displayOpenSessions();
        
    } catch (error) {
        console.error('Error loading data:', error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้', 'error');
    } finally {
        showLoading(false);
    }
}

// Load app settings
async function loadAppSettings() {
    const settingsDoc = await getDoc(doc(db, 'app_settings', 'settingsDocId'));
    if (settingsDoc.exists()) {
        appSettings = settingsDoc.data();
    } else {
        throw new Error('App settings not found');
    }
}

// Load enrolled courses
async function loadEnrolledCourses() {
    const enrollmentsQuery = query(
        collection(db, 'course_enrollments'),
        where('student_id', '==', studentData.id)
    );
    
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    enrolledCoursesData = [];
    
    for (const enrollmentDoc of enrollmentsSnapshot.docs) {
        const enrollment = enrollmentDoc.data();
        const courseDoc = await getDoc(doc(db, 'courses', enrollment.course_id));
        
        if (courseDoc.exists()) {
            enrolledCoursesData.push({
                id: courseDoc.id,
                ...courseDoc.data()
            });
        }
    }
}

// Load open sessions for enrolled courses
async function loadOpenSessions() {
    if (enrolledCoursesData.length === 0) {
        openSessionsData = [];
        return;
    }

    const courseIds = enrolledCoursesData.map(course => course.id);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const sessionsQuery = query(
        collection(db, 'attendance_sessions'),
        where('status', '==', 'open'),
        where('date', '==', today)
    );
    
    const snapshot = await getDocs(sessionsQuery);
    openSessionsData = snapshot.docs
        .map(doc => ({
            id: doc.id,
            ...doc.data()
        }))
        .filter(session => courseIds.includes(session.course_id))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// Load today's check-ins count
async function loadTodayCheckIns() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const attendancesQuery = query(
        collection(db, 'attendances'),
        where('student_auth_uid', '==', currentUser.uid)
    );
    
    const snapshot = await getDocs(attendancesQuery);
    const todayCheckIns = [];
    
    for (const docSnapshot of snapshot.docs) {
        const attendance = docSnapshot.data();
        const checkInDate = new Date(attendance.check_in_time).toISOString().split('T')[0];
        
        if (checkInDate === today) {
            todayCheckIns.push(attendance);
        }
    }
    
    return todayCheckIns.length;
}

// Load recent check-ins
async function loadRecentCheckIns() {
    const attendancesQuery = query(
        collection(db, 'attendances'),
        where('student_auth_uid', '==', currentUser.uid)
    );
    
    const snapshot = await getDocs(attendancesQuery);
    const recentData = [];
    
    for (const docSnapshot of snapshot.docs) {
        const attendance = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Get session details
        try {
            const sessionDoc = await getDoc(doc(db, 'attendance_sessions', attendance.session_id));
            if (sessionDoc.exists()) {
                attendance.session = sessionDoc.data();
                recentData.push(attendance);
            }
        } catch (error) {
            console.warn('Session not found for attendance:', attendance.id);
        }
    }
    
    // Sort and limit in JavaScript
    const sortedData = recentData
        .sort((a, b) => new Date(b.check_in_time) - new Date(a.check_in_time))
        .slice(0, 5);
    
    displayRecentCheckIns(sortedData);
}

// Update dashboard statistics
async function updateDashboardStats() {
    enrolledCoursesCount.textContent = enrolledCoursesData.length;
    openSessionsCount.textContent = openSessionsData.length;
    
    // Get today's check-ins count
    const todayCount = await loadTodayCheckIns();
    todayCheckInsCount.textContent = todayCount;
}

// Display open sessions
function displayOpenSessions() {
    if (openSessionsData.length === 0) {
        openSessionsList.innerHTML = `
            <div class="text-center py-12">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">ไม่มีเซสชันเช็คชื่อที่เปิดอยู่</h3>
                <p class="mt-1 text-sm text-gray-500">ขณะนี้ไม่มีรายวิชาที่เปิดให้เช็คชื่อ</p>
            </div>
        `;
        return;
    }

    const now = new Date();
    
    openSessionsList.innerHTML = openSessionsData.map(session => {
        const openTime = new Date(`${session.date} ${session.open_check_in_time}`);
        const closeTime = new Date(`${session.date} ${session.close_check_in_time}`);
        const lateTime = new Date(`${session.date} ${session.late_time}`);
        
        const canCheckIn = now >= openTime && now <= closeTime;
        const isLate = now >= lateTime;
        const timeLeft = closeTime - now;
        
        const progress = Math.max(0, Math.min(100, ((closeTime - now) / (closeTime - openTime)) * 100));
        
        return `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900">${session.course_code}</h3>
                        <p class="text-sm text-gray-600">${session.course_name}</p>
                    </div>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isLate ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                    }">
                        ${isLate ? 'สาย' : 'ปกติ'}
                    </span>
                </div>
                
                <div class="space-y-2 mb-4">
                    <div class="flex items-center text-sm text-gray-600">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        เช็คชื่อได้: ${session.open_check_in_time} - ${session.close_check_in_time}
                    </div>
                    <div class="flex items-center text-sm text-gray-600">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        เข้าเรียน: ${session.start_time} - ${session.end_time}
                    </div>
                </div>
                
                ${canCheckIn ? `
                    <div class="mb-4">
                        <div class="flex items-center justify-between text-sm mb-2">
                            <span class="font-medium text-gray-700">เวลาที่เหลือ</span>
                            <span class="font-mono text-red-600" data-countdown="${closeTime.getTime()}">
                                ${formatTimeRemaining(timeLeft)}
                            </span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-gradient-to-r from-green-500 to-red-500 h-2 rounded-full transition-all duration-1000" 
                                 style="width: ${progress}%"></div>
                        </div>
                    </div>
                ` : ''}
                
                <button onclick="startCheckIn('${session.id}')" 
                        ${!canCheckIn ? 'disabled' : ''}
                        class="w-full py-2.5 px-4 rounded-lg font-medium transition-colors ${
                            canCheckIn 
                                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }">
                    ${!canCheckIn 
                        ? (now < openTime ? 'ยังไม่ถึงเวลาเช็คชื่อ' : 'หมดเวลาเช็คชื่อ')
                        : 'เช็คชื่อ (GPS)'
                    }
                </button>
            </div>
        `;
    }).join('');
}

// Show/hide loading spinner
function showLoading(show) {
    if (loadingSpinner) {
        loadingSpinner.classList.toggle('hidden', !show);
    }
}

// Start check-in process
async function startCheckIn(sessionId) {
    currentSession = openSessionsData.find(session => session.id === sessionId);
    if (!currentSession) return;

    // Check if already checked in
    try {
        const existingQuery = query(
            collection(db, 'attendances'),
            where('session_id', '==', sessionId),
            where('student_auth_uid', '==', currentUser.uid)
        );
        
        const existingSnapshot = await getDocs(existingQuery);
        
        if (!existingSnapshot.empty) {
            Swal.fire('แจ้งเตือน', 'คุณได้เช็คชื่อในเซสชันนี้แล้ว', 'info');
            return;
        }
    } catch (error) {
        console.error('Error checking existing attendance:', error);
    }

    // Show modal and get GPS
    modalSessionInfo.innerHTML = `
        <h3 class="text-lg font-semibold">${currentSession.course_code}</h3>
        <p class="text-gray-600">${currentSession.course_name}</p>
    `;
    
    checkInModal.classList.remove('hidden');
    confirmCheckInBtn.disabled = true;
    
    await getGPSLocation();
}

// Get GPS location
async function getGPSLocation() {
    gpsStatus.innerHTML = `
        <div class="flex items-center text-blue-800">
            <svg class="animate-spin w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span class="text-sm">กำลังค้นหาตำแหน่ง GPS...</span>
        </div>
    `;
    
    distanceInfo.classList.add('hidden');

    if (!navigator.geolocation) {
        gpsStatus.innerHTML = `
            <div class="flex items-center text-red-800">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span class="text-sm">เบราว์เซอร์ไม่รองรับ GPS</span>
            </div>
        `;
        return;
    }

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            });
        });

        userPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };

        const distance = calculateDistance(
            userPosition.latitude,
            userPosition.longitude,
            appSettings.gps_center_lat,
            appSettings.gps_center_lon
        );

        const isWithinRadius = distance <= appSettings.allowed_radius_meters;

        gpsStatus.innerHTML = `
            <div class="flex items-center ${isWithinRadius ? 'text-green-800' : 'text-red-800'}">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isWithinRadius ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'}"></path>
                </svg>
                <span class="text-sm">${isWithinRadius ? 'อยู่ในพื้นที่เช็คชื่อ' : 'อยู่นอกพื้นที่เช็คชื่อ'}</span>
            </div>
        `;
        
        distanceInfo.classList.remove('hidden');
        distanceInfo.className = `mb-4 p-3 rounded-lg ${isWithinRadius ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`;
        distanceValue.textContent = `${Math.round(distance)} เมตร`;
        distanceValue.className = `font-medium ${isWithinRadius ? 'text-green-600' : 'text-red-600'}`;
        
        // Start countdown
        startCountdown();
        confirmCheckInBtn.disabled = false;
        
    } catch (error) {
        console.error('GPS Error:', error);
        let errorMessage = 'ไม่สามารถระบุตำแหน่งได้';
        
        if (error.code === 1) {
            errorMessage = 'กรุณาอนุญาตการเข้าถึงตำแหน่ง';
        } else if (error.code === 2) {
            errorMessage = 'ไม่สามารถระบุตำแหน่งได้';
        } else if (error.code === 3) {
            errorMessage = 'หมดเวลาในการค้นหาตำแหน่ง';
        }
        
        gpsStatus.innerHTML = `
            <div class="flex items-center text-red-800">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span class="text-sm">${errorMessage}</span>
            </div>
        `;
    }
}

// Start countdown timer
function startCountdown() {
    const closeTime = new Date(`${currentSession.date} ${currentSession.close_check_in_time}`);
    const now = new Date();
    
    if (now >= closeTime) {
        countdownTime.textContent = '00:00';
        return;
    }
    
    countdownSection.classList.remove('hidden');
    
    const updateCountdown = () => {
        const now = new Date();
        const timeLeft = closeTime - now;
        
        if (timeLeft <= 0) {
            countdownTime.textContent = '00:00';
            countdownCircle.style.strokeDashoffset = '283';
            clearInterval(countdownInterval);
            confirmCheckInBtn.disabled = true;
            confirmCheckInBtn.textContent = 'หมดเวลาเช็คชื่อ';
            return;
        }
        
        const minutes = Math.floor(timeLeft / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        countdownTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update circle progress
        const totalTime = closeTime - new Date(`${currentSession.date} ${currentSession.open_check_in_time}`);
        const progress = timeLeft / totalTime;
        const offset = 283 - (progress * 283);
        countdownCircle.style.strokeDashoffset = offset;
    };
    
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

// Handle check-in
async function handleCheckIn() {
    if (!userPosition || !currentSession) return;
    
    const now = new Date();
    const lateTime = new Date(`${currentSession.date} ${currentSession.late_time}`);
    
    const distance = calculateDistance(
        userPosition.latitude,
        userPosition.longitude,
        appSettings.gps_center_lat,
        appSettings.gps_center_lon
    );
    
    const isWithinRadius = distance <= appSettings.allowed_radius_meters;
    const isLate = now >= lateTime;
    
    const attendanceData = {
        session_id: currentSession.id,
        student_id: studentData.id,
        student_auth_uid: currentUser.uid,
        check_in_time: now.toISOString(),
        latitude: userPosition.latitude,
        longitude: userPosition.longitude,
        is_within_radius: isWithinRadius,
        status: isLate ? 'late' : 'present',
        marked_by_uid: null,
        marked_at: null
    };
    
    try {
        // Double-check if already checked in
        const existingQuery = query(
            collection(db, 'attendances'),
            where('session_id', '==', currentSession.id),
            where('student_auth_uid', '==', currentUser.uid)
        );
        
        const existingSnapshot = await getDocs(existingQuery);
        
        if (!existingSnapshot.empty) {
            Swal.fire('แจ้งเตือน', 'คุณได้เช็คชื่อในเซสชันนี้แล้ว', 'info');
            closeCheckInModal();
            return;
        }
        
        // Add attendance record
        await addDoc(collection(db, 'attendances'), attendanceData);
        
        const statusText = isLate ? 'สาย' : 'มาเรียน';
        const radiusText = isWithinRadius ? 'ในพื้นที่' : 'นอกพื้นที่';
        
        await Swal.fire({
            title: 'เช็คชื่อสำเร็จ!',
            html: `
                <div class="text-center">
                    <div class="mb-3">
                        <strong>${currentSession.course_code}</strong><br>
                        ${currentSession.course_name}
                    </div>
                    <div class="text-sm text-gray-600">
                        <div>สถานะ: <span class="${isLate ? 'text-yellow-600' : 'text-green-600'} font-medium">${statusText}</span></div>
                        <div>ตำแหน่ง: <span class="${isWithinRadius ? 'text-green-600' : 'text-red-600'} font-medium">${radiusText}</span></div>
                        <div>เวลา: ${now.toLocaleTimeString('th-TH')}</div>
                    </div>
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'ตกลง'
        });
        
        closeCheckInModal();
        await loadData(); // Refresh data
        
    } catch (error) {
        console.error('Error checking in:', error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเช็คชื่อได้', 'error');
    }
}

// Display recent check-ins
function displayRecentCheckIns(recentData) {
    if (recentData.length === 0) {
        recentCheckInsList.innerHTML = `
            <div class="text-center py-8">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">ยังไม่มีประวัติการเช็คชื่อ</h3>
                <p class="mt-1 text-sm text-gray-500">ประวัติการเช็คชื่อจะแสดงที่นี่</p>
            </div>
        `;
        return;
    }

    recentCheckInsList.innerHTML = recentData.map(attendance => {
        const checkInDate = new Date(attendance.check_in_time);
        const statusConfig = {
            present: { color: 'text-green-600', bg: 'bg-green-100', text: 'มาเรียน' },
            late: { color: 'text-yellow-600', bg: 'bg-yellow-100', text: 'สาย' },
            absent: { color: 'text-red-600', bg: 'bg-red-100', text: 'ขาดเรียน' },
            leave: { color: 'text-blue-600', bg: 'bg-blue-100', text: 'ลา' }
        };
        
        const config = statusConfig[attendance.status] || statusConfig.absent;
        
        return `
            <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div class="flex-1">
                    <div class="flex items-center space-x-3">
                        <div class="flex-shrink-0">
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}">
                                ${config.text}
                            </span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-900 truncate">
                                ${attendance.session?.course_code || 'N/A'}
                            </p>
                            <p class="text-sm text-gray-500 truncate">
                                ${attendance.session?.course_name || 'ไม่ระบุรายวิชา'}
                            </p>
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-900">
                        ${checkInDate.toLocaleDateString('th-TH', { 
                            day: 'numeric', 
                            month: 'short' 
                        })}
                    </p>
                    <p class="text-xs text-gray-500">
                        ${checkInDate.toLocaleTimeString('th-TH', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        })}
                    </p>
                </div>
            </div>
        `;
    }).join('');
}

// Close check-in modal
function closeCheckInModal() {
    checkInModal.classList.add('hidden');
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    currentSession = null;
    userPosition = null;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// Format time remaining
function formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return '00:00';
    
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Start clock
function startClock() {
    function updateClock() {
        const now = new Date();
        currentTime.textContent = now.toLocaleTimeString('th-TH');
    }
    
    updateClock();
    setInterval(updateClock, 1000);
    
    // Update countdowns every second
    setInterval(() => {
        const countdownElements = document.querySelectorAll('[data-countdown]');
        countdownElements.forEach(element => {
            const targetTime = parseInt(element.getAttribute('data-countdown'));
            const now = new Date().getTime();
            const timeLeft = targetTime - now;
            
            if (timeLeft <= 0) {
                element.textContent = '00:00';
                element.parentElement.parentElement.style.opacity = '0.5';
            } else {
                element.textContent = formatTimeRemaining(timeLeft);
            }
        });
    }, 1000);
}

// Logout handler
async function handleLogout() {
    const result = await Swal.fire({
        title: 'ออกจากระบบ?',
        text: 'คุณต้องการออกจากระบบหรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ออกจากระบบ',
        cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
        try {
            const { signOutUser } = await import('./auth.js');
            await signOutUser();
        } catch (error) {
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถออกจากระบบได้', 'error');
        }
    }
}

// Make functions available globally
window.startCheckIn = startCheckIn;