import { auth, db } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    collection, 
    getDocs, 
    query, 
    where,
    doc,
    getDoc,
    setDoc,
    orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loading = document.getElementById('loading');
    const userInfo = document.getElementById('userInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    const activeSessions = document.getElementById('activeSessions');
    const noSessions = document.getElementById('noSessions');

    let currentUser = null;
    let studentData = null;

    // Auth state listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            userInfo.textContent = user.displayName || user.email;
            
            await loadStudentData();
            await loadActiveSessions();
            loading.style.display = 'none';
        }
    });

    // Logout handler
    logoutBtn.addEventListener('click', async () => {
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
    });

    // Load student data
    async function loadStudentData() {
        try {
            if (!currentUser) return;

            const studentQuery = query(
                collection(db, 'students'),
                where('email', '==', currentUser.email)
            );
            
            const snapshot = await getDocs(studentQuery);
            
            if (!snapshot.empty) {
                studentData = {
                    id: snapshot.docs[0].id,
                    ...snapshot.docs[0].data()
                };
            }
        } catch (error) {
            console.error('Error loading student data:', error);
        }
    }

    // Load active sessions for enrolled courses
    async function loadActiveSessions() {
        try {
            if (!studentData) return;

            // Get enrolled courses
            const enrollmentsQuery = query(
                collection(db, 'course_enrollments'),
                where('student_id', '==', studentData.id)
            );
            
            const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
            
            if (enrollmentsSnapshot.empty) {
                noSessions.classList.remove('hidden');
                return;
            }

            const courseIds = enrollmentsSnapshot.docs.map(doc => doc.data().course_id);
            
            // Get active sessions for enrolled courses
            const sessionsQuery = query(
                collection(db, 'attendance_sessions'),
                where('status', '==', 'open'),
                where('course_id', 'in', courseIds.slice(0, 10)) // Firestore limit
            );
            
            const sessionsSnapshot = await getDocs(sessionsQuery);
            
            if (sessionsSnapshot.empty) {
                noSessions.classList.remove('hidden');
                return;
            }

            activeSessions.innerHTML = '';
            
            const sessions = [];
            sessionsSnapshot.forEach((doc) => {
                sessions.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Sort by end time
            sessions.sort((a, b) => {
                const timeA = new Date(`${a.date} ${a.close_check_in_time}`);
                const timeB = new Date(`${b.date} ${b.close_check_in_time}`);
                return timeA - timeB;
            });

            sessions.forEach((session) => {
                const sessionElement = createSessionCard(session);
                activeSessions.appendChild(sessionElement);
            });

            // Start countdown timers
            startCountdownTimers();

        } catch (error) {
            console.error('Error loading active sessions:', error);
            noSessions.classList.remove('hidden');
        }
    }

    // Create session card
    function createSessionCard(session) {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-lg shadow-md p-6';
        div.id = `session-${session.id}`;

        const now = new Date();
        const sessionDate = new Date(session.date);
        const openTime = new Date(`${session.date} ${session.open_check_in_time}`);
        const closeTime = new Date(`${session.date} ${session.close_check_in_time}`);
        const lateTime = new Date(`${session.date} ${session.late_time}`);

        const canCheckIn = now >= openTime && now <= closeTime;
        const isLate = now >= lateTime && now <= closeTime;

        div.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <div>
                    <h3 class="text-xl font-bold text-gray-900 mb-1">${session.course_code}</h3>
                    <p class="text-gray-600 mb-2">${session.course_name}</p>
                    <div class="flex items-center text-sm text-gray-500 space-x-4">
                        <span>📅 ${formatThaiDate(session.date)}</span>
                        <span>⏰ ${session.start_time} - ${session.end_time}</span>
                    </div>
                </div>
                <div class="text-right">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isLate ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                        ${isLate ? '⚠️ สาย' : '✅ ปกติ'}
                    </span>
                </div>
            </div>

            <!-- Countdown Timers -->
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="bg-gray-50 rounded-lg p-3">
                    <p class="text-sm text-gray-600 mb-1">เวลาปิดเช็คชื่อ</p>
                    <p class="font-mono text-lg font-bold text-red-600" 
                       data-countdown="${closeTime.toISOString()}" 
                       data-type="close">
                        --:--:--
                    </p>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                    <p class="text-sm text-gray-600 mb-1">เวลาที่จะสาย</p>
                    <p class="font-mono text-lg font-bold text-yellow-600" 
                       data-countdown="${lateTime.toISOString()}" 
                       data-type="late">
                        --:--:--
                    </p>
                </div>
            </div>

            <!-- Check-in Button -->
            <button onclick="checkIn('${session.id}')" 
                    ${!canCheckIn ? 'disabled' : ''}
                    class="w-full py-3 px-4 rounded-lg font-medium transition duration-200 ${
                        canCheckIn 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }">
                ${canCheckIn ? '📍 เช็คชื่อ (GPS)' : '🔒 ยังไม่เปิดเช็คชื่อ'}
            </button>

            <!-- Check-in Instructions -->
            <div class="mt-3 text-sm text-gray-600">
                <p>📍 เปิดเช็คชื่อ: ${session.open_check_in_time}</p>
                <p>⏰ ปิดเช็คชื่อ: ${session.close_check_in_time}</p>
                <p>⚠️ เวลาสาย: ${session.late_time}</p>
            </div>
        `;

        return div;
    }

    // Start countdown timers
    function startCountdownTimers() {
        const countdownElements = document.querySelectorAll('[data-countdown]');
        
        function updateCountdowns() {
            const now = new Date();
            
            countdownElements.forEach(element => {
                const targetTime = new Date(element.getAttribute('data-countdown'));
                const timeDiff = targetTime - now;
                
                if (timeDiff <= 0) {
                    element.textContent = '00:00:00';
                    element.className = element.className.replace(/text-\w+-600/, 'text-red-600');
                    return;
                }
                
                const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
                
                element.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            });
        }
        
        updateCountdowns();
        setInterval(updateCountdowns, 1000);
    }

    // Format Thai date
    function formatThaiDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Check-in function
    window.checkIn = async function(sessionId) {
        try {
            // Request GPS location
            const position = await getCurrentPosition();
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            // Get app settings for GPS validation
            const settingsDoc = await getDoc(doc(db, 'app_settings', 'settingsDocId'));
            let isWithinRadius = true;
            
            if (settingsDoc.exists()) {
                const settings = settingsDoc.data();
                const distance = calculateDistance(
                    latitude, longitude,
                    settings.gps_center_lat, settings.gps_center_lon
                );
                isWithinRadius = distance <= settings.allowed_radius_meters;
            }

            // Determine status
            const now = new Date();
            const sessionDoc = await getDoc(doc(db, 'attendance_sessions', sessionId));
            const sessionData = sessionDoc.data();
            
            const lateTime = new Date(`${sessionData.date} ${sessionData.late_time}`);
            const status = now >= lateTime ? 'late' : 'present';

            // Save attendance
            const attendanceId = `${Date.now()}_${studentData.id}`;
            await setDoc(doc(db, 'attendances', attendanceId), {
                session_id: sessionId,
                student_id: studentData.id,
                student_auth_uid: currentUser.uid,
                check_in_time: new Date().toISOString(),
                latitude: latitude,
                longitude: longitude,
                is_within_radius: isWithinRadius,
                status: status,
                marked_by_uid: null,
                marked_at: null
            });

            // Show success message
            const statusText = status === 'late' ? 'สาย' : 'ปกติ';
            const radiusText = isWithinRadius ? '' : ' (นอกพื้นที่กำหนด)';
            
            Swal.fire({
                icon: 'success',
                title: 'เช็คชื่อสำเร็จ!',
                text: `สถานะ: ${statusText}${radiusText}`,
                confirmButtonText: 'ตกลง'
            });

            // Remove session from display
            const sessionElement = document.getElementById(`session-${sessionId}`);
            if (sessionElement) {
                sessionElement.remove();
                
                // Check if no more sessions
                if (activeSessions.children.length === 0) {
                    noSessions.classList.remove('hidden');
                }
            }

        } catch (error) {
            console.error('Check-in error:', error);
            
            let errorMessage = 'ไม่สามารถเช็คชื่อได้';
            if (error.code === 1) { // PERMISSION_DENIED
                errorMessage = 'กรุณาอนุญาตการใช้งาน GPS';
            } else if (error.code === 2) { // POSITION_UNAVAILABLE
                errorMessage = 'ไม่สามารถหาตำแหน่ง GPS ได้';
            } else if (error.code === 3) { // TIMEOUT
                errorMessage = 'หมดเวลาการหาตำแหน่ง GPS';
            }
            
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: errorMessage,
                confirmButtonText: 'ตกลง'
            });
        }
    };

    // Get current GPS position
    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('GPS not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000
                }
            );
        });
    }

    // Calculate distance between two GPS points
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
});