import { auth, db } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    query, 
    where, 
    orderBy,
    getDoc,
    limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loading = document.getElementById('loading');
    const userInfo = document.getElementById('userInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    
    // Status elements
    const currentTime = document.getElementById('currentTime');
    const todayCheckedIn = document.getElementById('todayCheckedIn');
    const openSessions = document.getElementById('openSessions');
    const enrolledCourses = document.getElementById('enrolledCourses');
    
    // Main content
    const sessionsGrid = document.getElementById('sessionsGrid');
    const emptyState = document.getElementById('emptyState');
    const recentCheckIns = document.getElementById('recentCheckIns');
    const noRecentCheckIns = document.getElementById('noRecentCheckIns');
    
    // Modal elements
    const checkInModal = document.getElementById('checkInModal');
    const checkInModalTitle = document.getElementById('checkInModalTitle');
    const checkInModalSubtitle = document.getElementById('checkInModalSubtitle');
    const gpsStatus = document.getElementById('gpsStatus');
    const distanceInfo = document.getElementById('distanceInfo');
    const distanceValue = document.getElementById('distanceValue');
    const countdownSection = document.getElementById('countdownSection');
    const countdownTime = document.getElementById('countdownTime');
    const countdownCircle = document.getElementById('countdownCircle');
    const cancelCheckInBtn = document.getElementById('cancelCheckInBtn');
    const confirmCheckInBtn = document.getElementById('confirmCheckInBtn');

    // Data
    let currentUser = null;
    let studentData = null;
    let openSessionsData = [];
    let enrolledCoursesData = [];
    let appSettings = null;
    let currentSession = null;
    let userPosition = null;
    let countdownInterval = null;

    // Auth state listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            userInfo.textContent = user.displayName || user.email;
            await loadStudentData();
            if (studentData) {
                await loadData();
                startClock();
                loading.style.display = 'none';
            }
        }
    });

    // Event listeners
    logoutBtn.addEventListener('click', handleLogout);
    refreshBtn.addEventListener('click', () => loadData());
    cancelCheckInBtn.addEventListener('click', closeCheckInModal);
    confirmCheckInBtn.addEventListener('click', handleCheckIn);

    // Load student data
    async function loadStudentData() {
        try {
            const studentsQuery = query(
                collection(db, 'students'),
                where('email', '==', currentUser.email)
            );
            const snapshot = await getDocs(studentsQuery);
            
            if (!snapshot.empty) {
                studentData = {
                    id: snapshot.docs[0].id,
                    ...snapshot.docs[0].data()
                };
            } else {
                Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลนักศึกษา กรุณาติดต่อผู้ดูแลระบบ', 'error');
            }
        } catch (error) {
            console.error('Error loading student data:', error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลนักศึกษาได้', 'error');
        }
    }

    // Load all data
    async function loadData() {
        try {
            await Promise.all([
                loadEnrolledCourses(),
                loadOpenSessions(),
                loadAppSettings(),
                loadRecentCheckIns()
            ]);
            updateStatusCards();
            displaySessions();
        } catch (error) {
            console.error('Error loading data:', error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้', 'error');
        }
    }

    // Load enrolled courses
    async function loadEnrolledCourses() {
        const enrollmentsQuery = query(
            collection(db, 'course_enrollments'),
            where('student_id', '==', studentData.id)
        );
        const snapshot = await getDocs(enrollmentsQuery);
        
        const courseIds = snapshot.docs.map(doc => doc.data().course_id);
        enrolledCoursesData = [];
        
        for (const courseId of courseIds) {
            const courseDoc = await getDoc(doc(db, 'courses', courseId));
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
        const sessionsQuery = query(
            collection(db, 'attendance_sessions'),
            where('status', '==', 'open'),
            orderBy('created_at', 'desc')
        );
        
        const snapshot = await getDocs(sessionsQuery);
        openSessionsData = snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .filter(session => courseIds.includes(session.course_id));
    }

    // Load app settings
    async function loadAppSettings() {
        const settingsDoc = await getDoc(doc(db, 'app_settings', 'settingsDocId'));
        if (settingsDoc.exists()) {
            appSettings = settingsDoc.data();
        }
    }

    // Load recent check-ins
    async function loadRecentCheckIns() {
        const attendancesQuery = query(
            collection(db, 'attendances'),
            where('student_auth_uid', '==', currentUser.uid),
            orderBy('check_in_time', 'desc'),
            limit(5)
        );
        
        const snapshot = await getDocs(attendancesQuery);
        const recentData = [];
        
        for (const docSnapshot of snapshot.docs) {
            const attendance = { id: docSnapshot.id, ...docSnapshot.data() };
            
            // Get session details
            const sessionDoc = await getDoc(doc(db, 'attendance_sessions', attendance.session_id));
            if (sessionDoc.exists()) {
                attendance.session = sessionDoc.data();
            }
            
            recentData.push(attendance);
        }
        
        displayRecentCheckIns(recentData);
    }

    // Update status cards
    function updateStatusCards() {
        enrolledCourses.textContent = enrolledCoursesData.length;
        openSessions.textContent = openSessionsData.length;
        
        // Count today's check-ins
        const today = new Date().toISOString().split('T')[0];
        const todayCount = openSessionsData.filter(session => 
            session.date === today
        ).length;
        todayCheckedIn.textContent = todayCount;
    }

    // Display sessions
    function displaySessions() {
        sessionsGrid.innerHTML = '';
        
        if (openSessionsData.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        openSessionsData.forEach(session => {
            const sessionCard = createSessionCard(session);
            sessionsGrid.appendChild(sessionCard);
        });
    }

    // Create session card
    function createSessionCard(session) {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500 hover:shadow-lg transition duration-200';
        
        const now = new Date();
        const sessionDate = new Date(`${session.date} ${session.open_check_in_time}`);
        const closeDate = new Date(`${session.date} ${session.close_check_in_time}`);
        const lateDate = new Date(`${session.date} ${session.late_time}`);
        
        const isCheckInTime = now >= sessionDate && now <= closeDate;
        const isLate = now >= lateDate;
        const timeRemaining = Math.max(0, closeDate - now);
        
        const statusColor = isLate ? 'text-yellow-600' : 'text-green-600';
        const statusText = isLate ? 'สาย' : 'ปกติ';

        div.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-gray-900 mb-1">${session.course_code}</h3>
                    <p class="text-gray-600 mb-2">${session.course_name}</p>
                    <div class="flex items-center text-sm text-gray-500">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        ${session.open_check_in_time} - ${session.close_check_in_time}
                    </div>
                </div>
                <div class="text-right">
                    <span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        เปิดอยู่
                    </span>
                    ${isCheckInTime ? `
                        <div class="mt-2">
                            <span class="text-sm ${statusColor} font-medium">${statusText}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${isCheckInTime ? `
                <div class="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-blue-800">เวลาที่เหลือในการเช็คชื่อ:</span>
                        <span class="font-bold text-blue-900" data-countdown="${closeDate.getTime()}">${formatTimeRemaining(timeRemaining)}</span>
                    </div>
                    <div class="mt-1 bg-blue-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full transition-all duration-1000" 
                             style="width: ${Math.max(5, (timeRemaining / (closeDate - sessionDate)) * 100)}%"></div>
                    </div>
                </div>
            ` : ''}

            <div class="space-y-2 text-sm text-gray-600 mb-4">
                <div class="flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    วันที่: ${new Date(session.date).toLocaleDateString('th-TH')}
                </div>
                <div class="flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    เวลาเรียน: ${session.start_time} - ${session.end_time}
                </div>
                <div class="flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    เวลาสาย: ${session.late_time}
                </div>
            </div>

            <button onclick="startCheckIn('${session.id}')" 
                    ${!isCheckInTime ? 'disabled' : ''}
                    class="w-full ${isCheckInTime ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'} text-white px-4 py-3 rounded-lg font-medium transition duration-200 flex items-center justify-center space-x-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <span>${isCheckInTime ? 'เช็คชื่อ (GPS)' : 'ยังไม่ถึงเวลาเช็คชื่อ'}</span>
            </button>
        `;

        return div;
    }

    // Display recent check-ins
    function displayRecentCheckIns(data) {
        if (data.length === 0) {
            recentCheckIns.classList.add('hidden');
            noRecentCheckIns.classList.remove('hidden');
            return;
        }
        
        recentCheckIns.classList.remove('hidden');
        noRecentCheckIns.classList.add('hidden');
        recentCheckIns.innerHTML = '';
        
        data.forEach(attendance => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
            
            const statusColors = {
                present: 'bg-green-100 text-green-800',
                late: 'bg-yellow-100 text-yellow-800',
                absent: 'bg-red-100 text-red-800',
                leave: 'bg-blue-100 text-blue-800'
            };
            
            const statusTexts = {
                present: 'มาเรียน',
                late: 'สาย',
                absent: 'ขาด',
                leave: 'ลา'
            };
            
            const checkInDate = new Date(attendance.check_in_time);
            
            div.innerHTML = `
                <div class="flex-1">
                    <p class="font-medium text-gray-900">${attendance.session?.course_code || 'N/A'}</p>
                    <p class="text-sm text-gray-600">${attendance.session?.course_name || 'N/A'}</p>
                    <p class="text-xs text-gray-500">${checkInDate.toLocaleDateString('th-TH')} ${checkInDate.toLocaleTimeString('th-TH')}</p>
                </div>
                <span class="px-2 py-1 text-xs font-medium rounded-full ${statusColors[attendance.status]}">
                    ${statusTexts[attendance.status]}
                </span>
            `;
            
            recentCheckIns.appendChild(div);
        });
    }

    // Start check-in process
    async function startCheckIn(sessionId) {
        currentSession = openSessionsData.find(s => s.id === sessionId);
        if (!currentSession) return;
        
        checkInModalTitle.textContent = `เช็คชื่อ ${currentSession.course_code}`;
        checkInModalSubtitle.textContent = currentSession.course_name;
        
        // Reset modal state
        gpsStatus.innerHTML = `
            <div class="flex items-center text-blue-800">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span class="text-sm">กำลังค้นหาตำแหน่ง GPS...</span>
            </div>
        `;
        distanceInfo.classList.add('hidden');
        countdownSection.classList.add('hidden');
        confirmCheckInBtn.disabled = true;
        
        checkInModal.classList.remove('hidden');
        
        // Get GPS position
        await getCurrentPosition();
    }

    // Get current GPS position
    async function getCurrentPosition() {
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
                    maximumAge: 300000
                });
            });
            
            userPosition = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            
            // Calculate distance
            const distance = calculateDistance(
                userPosition.latitude, 
                userPosition.longitude,
                appSettings.gps_center_lat,
                appSettings.gps_center_lon
            );
            
            const isWithinRadius = distance <= appSettings.allowed_radius_meters;
            
            // Update UI
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
            // Check if already checked in
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
});