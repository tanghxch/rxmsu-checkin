import { auth, db } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    collection, 
    getDocs, 
    query, 
    where,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loading = document.getElementById('loading');
    const userInfo = document.getElementById('userInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    // Stats elements
    const mySessions = document.getElementById('mySessions');
    const activeSessions = document.getElementById('activeSessions');
    const todaySessions = document.getElementById('todaySessions');
    
    // Recent sessions
    const recentSessions = document.getElementById('recentSessions');
    const noRecentSessions = document.getElementById('noRecentSessions');

    let currentUser = null;

    // Auth state listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            userInfo.textContent = user.displayName || user.email;
            welcomeMessage.textContent = `จัดการเซสชันการเช็คชื่อและดูรายงานการเข้าเรียนของนักศึกษา สวัสดี ${user.displayName || 'อาจารย์'}`;
            
            await loadLecturerStats();
            await loadRecentSessions();
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

    // Load lecturer statistics
    async function loadLecturerStats() {
        try {
            if (!currentUser) return;

            // Get my sessions count
            const mySessionsQuery = query(
                collection(db, 'attendance_sessions'),
                where('created_by_uid', '==', currentUser.uid)
            );
            const mySessionsSnapshot = await getDocs(mySessionsQuery);
            mySessions.textContent = mySessionsSnapshot.size;

            // Get active sessions count
            const activeSessionsQuery = query(
                collection(db, 'attendance_sessions'),
                where('created_by_uid', '==', currentUser.uid),
                where('status', '==', 'open')
            );
            const activeSessionsSnapshot = await getDocs(activeSessionsQuery);
            activeSessions.textContent = activeSessionsSnapshot.size;

            // Get today's sessions count
            const today = new Date().toISOString().split('T')[0];
            const todaySessionsQuery = query(
                collection(db, 'attendance_sessions'),
                where('created_by_uid', '==', currentUser.uid),
                where('date', '==', today)
            );
            const todaySessionsSnapshot = await getDocs(todaySessionsQuery);
            todaySessions.textContent = todaySessionsSnapshot.size;

        } catch (error) {
            console.error('Error loading lecturer stats:', error);
            mySessions.textContent = '0';
            activeSessions.textContent = '0';
            todaySessions.textContent = '0';
        }
    }

    // Load recent sessions
    async function loadRecentSessions() {
        try {
            if (!currentUser) return;

            const recentSessionsQuery = query(
                collection(db, 'attendance_sessions'),
                where('created_by_uid', '==', currentUser.uid),
                orderBy('created_at', 'desc'),
                limit(5)
            );
            
            const snapshot = await getDocs(recentSessionsQuery);
            
            if (snapshot.empty) {
                noRecentSessions.classList.remove('hidden');
                return;
            }

            recentSessions.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const session = doc.data();
                const sessionElement = createSessionElement(doc.id, session);
                recentSessions.appendChild(sessionElement);
            });

        } catch (error) {
            console.error('Error loading recent sessions:', error);
            noRecentSessions.classList.remove('hidden');
        }
    }

    // Create session element
    function createSessionElement(sessionId, session) {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-4 border border-gray-200 rounded-lg';
        
        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800',
            open: 'bg-green-100 text-green-800',
            closed: 'bg-gray-100 text-gray-800'
        };

        const statusTexts = {
            pending: 'รอเปิด',
            open: 'เปิดอยู่',
            closed: 'ปิดแล้ว'
        };

        div.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center space-x-3">
                    <h4 class="font-medium text-gray-900">${session.course_code} - ${session.course_name}</h4>
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${statusColors[session.status]}">
                        ${statusTexts[session.status]}
                    </span>
                </div>
                <p class="text-sm text-gray-600 mt-1">
                    ${formatThaiDate(session.date)} | ${session.start_time} - ${session.end_time}
                </p>
            </div>
            <div class="flex space-x-2">
                <button onclick="viewSession('${sessionId}')" 
                        class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                    ดูรายละเอียด
                </button>
            </div>
        `;

        return div;
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

    // Make viewSession available globally
    window.viewSession = function(sessionId) {
        window.location.href = `/lecturer/attendance-sessions.html?session=${sessionId}`;
    };
});