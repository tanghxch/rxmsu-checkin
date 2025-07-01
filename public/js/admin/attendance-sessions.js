import { auth, db } from '../auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loading = document.getElementById('loading');
    const userInfo = document.getElementById('userInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Main elements
    const createSessionBtn = document.getElementById('createSessionBtn');
    const searchInput = document.getElementById('searchInput');
    const dateFilter = document.getElementById('dateFilter');
    const statusFilter = document.getElementById('statusFilter');
    const clearFilters = document.getElementById('clearFilters');
    const sessionsGrid = document.getElementById('sessionsGrid');
    const emptyState = document.getElementById('emptyState');
    
    // Modal elements
    const sessionModal = document.getElementById('sessionModal');
    const sessionModalTitle = document.getElementById('sessionModalTitle');
    const closeSessionModal = document.getElementById('closeSessionModal');
    const sessionForm = document.getElementById('sessionForm');
    const cancelSessionBtn = document.getElementById('cancelSessionBtn');
    
    // Form elements
    const courseSelect = document.getElementById('courseSelect');
    const sessionDate = document.getElementById('sessionDate');
    const startTime = document.getElementById('startTime');
    const endTime = document.getElementById('endTime');
    const lateTime = document.getElementById('lateTime');
    const openCheckInTime = document.getElementById('openCheckInTime');
    const closeCheckInTime = document.getElementById('closeCheckInTime');

    // Data
    let sessions = [];
    let courses = [];
    let currentUser = null;

    // Auth state listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            userInfo.textContent = user.displayName || user.email;
            await loadData();
            loading.style.display = 'none';
        }
    });

    // Event listeners
    logoutBtn.addEventListener('click', handleLogout);
    createSessionBtn.addEventListener('click', () => openSessionModal());
    closeSessionModal.addEventListener('click', closeSessionModalHandler);
    cancelSessionBtn.addEventListener('click', closeSessionModalHandler);
    sessionForm.addEventListener('submit', handleSessionSubmit);
    
    // Filter event listeners
    searchInput.addEventListener('input', filterSessions);
    dateFilter.addEventListener('change', filterSessions);
    statusFilter.addEventListener('change', filterSessions);
    clearFilters.addEventListener('click', clearAllFilters);

    // Load data
    async function loadData() {
        try {
            await Promise.all([
                loadCourses(),
                loadSessions()
            ]);
            populateCourseSelect();
            displaySessions();
        } catch (error) {
            console.error('Error loading data:', error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้', 'error');
        }
    }

    // Load courses
    async function loadCourses() {
        const coursesQuery = query(collection(db, 'courses'), orderBy('code'));
        const snapshot = await getDocs(coursesQuery);
        courses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    // Load sessions
    async function loadSessions() {
        const sessionsQuery = query(
            collection(db, 'attendance_sessions'), 
            orderBy('created_at', 'desc')
        );
        const snapshot = await getDocs(sessionsQuery);
        sessions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    // Populate course select
    function populateCourseSelect() {
        courseSelect.innerHTML = '<option value="">เลือกรายวิชา</option>';
        courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course.id;
            option.textContent = `${course.code} - ${course.name}${course.section ? ` (${course.section})` : ''}`;
            courseSelect.appendChild(option);
        });
    }

    // Display sessions
    function displaySessions(sessionsToShow = sessions) {
        sessionsGrid.innerHTML = '';
        
        if (sessionsToShow.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        sessionsToShow.forEach(session => {
            const sessionCard = createSessionCard(session);
            sessionsGrid.appendChild(sessionCard);
        });
    }

    // Create session card
    function createSessionCard(session) {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition duration-200';
        
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

        const sessionDateTime = new Date(`${session.date} ${session.start_time}`);
        const formattedDate = sessionDateTime.toLocaleDateString('th-TH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        div.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-gray-900 mb-1">${session.course_code}</h3>
                    <p class="text-gray-600 mb-2">${session.course_name}</p>
                </div>
                <span class="px-3 py-1 text-sm font-medium rounded-full ${statusColors[session.status]}">
                    ${statusTexts[session.status]}
                </span>
            </div>

            <div class="space-y-2 mb-4 text-sm text-gray-600">
                <div class="flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    ${formattedDate}
                </div>
                <div class="flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    ${session.start_time} - ${session.end_time}
                </div>
                <div class="flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    เช็คชื่อ: ${session.open_check_in_time} - ${session.close_check_in_time}
                </div>
                <div class="flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    เวลาสาย: ${session.late_time}
                </div>
            </div>

            <div class="flex space-x-2">
                ${session.status === 'pending' ? `
                    <button onclick="forceOpenSession('${session.id}')" 
                            class="flex-1 bg-green-100 text-green-700 hover:bg-green-200 px-3 py-2 rounded text-sm font-medium transition duration-200">
                        เปิดเซสชัน
                    </button>
                ` : ''}
                
                ${session.status === 'open' ? `
                    <button onclick="forceCloseSession('${session.id}')" 
                            class="flex-1 bg-red-100 text-red-700 hover:bg-red-200 px-3 py-2 rounded text-sm font-medium transition duration-200">
                        ปิดเซสชัน
                    </button>
                ` : ''}
                
                <button onclick="viewSessionDetails('${session.id}')" 
                        class="flex-1 bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-2 rounded text-sm font-medium transition duration-200">
                    ดูรายละเอียด
                </button>
                
                <button onclick="deleteSession('${session.id}')" 
                        class="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-2 rounded text-sm font-medium transition duration-200">
                    ลบ
                </button>
            </div>
        `;

        return div;
    }

    // Filter sessions
    function filterSessions() {
        const searchTerm = searchInput.value.toLowerCase();
        const dateValue = dateFilter.value;
        const statusValue = statusFilter.value;
        
        let filtered = sessions;
        
        if (searchTerm) {
            filtered = filtered.filter(session => 
                session.course_code.toLowerCase().includes(searchTerm) ||
                session.course_name.toLowerCase().includes(searchTerm)
            );
        }
        
        if (dateValue) {
            filtered = filtered.filter(session => session.date === dateValue);
        }
        
        if (statusValue) {
            filtered = filtered.filter(session => session.status === statusValue);
        }
        
        displaySessions(filtered);
    }

    // Clear all filters
    function clearAllFilters() {
        searchInput.value = '';
        dateFilter.value = '';
        statusFilter.value = '';
        displaySessions();
    }

    // Open session modal
    function openSessionModal() {
        sessionModalTitle.textContent = 'สร้างเซสชันเช็คชื่อ';
        sessionForm.reset();
        
        // Set default values
        const today = new Date();
        sessionDate.value = today.toISOString().split('T')[0];
        
        sessionModal.classList.remove('hidden');
    }

    // Close session modal
    function closeSessionModalHandler() {
        sessionModal.classList.add('hidden');
        sessionForm.reset();
    }

    // Handle session form submit
    async function handleSessionSubmit(e) {
        e.preventDefault();
        
        const selectedCourse = courses.find(c => c.id === courseSelect.value);
        if (!selectedCourse) {
            Swal.fire('ข้อผิดพลาด', 'กรุณาเลือกรายวิชา', 'error');
            return;
        }

        // Validate times
        if (startTime.value >= endTime.value) {
            Swal.fire('ข้อผิดพลาด', 'เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด', 'error');
            return;
        }

        if (openCheckInTime.value >= closeCheckInTime.value) {
            Swal.fire('ข้อผิดพลาด', 'เวลาเปิดเช็คชื่อต้องน้อยกว่าเวลาปิดเช็คชื่อ', 'error');
            return;
        }

        if (lateTime.value < openCheckInTime.value || lateTime.value > closeCheckInTime.value) {
            Swal.fire('ข้อผิดพลาด', 'เวลาสายต้องอยู่ระหว่างเวลาเปิดและปิดเช็คชื่อ', 'error');
            return;
        }

        const sessionData = {
            course_id: courseSelect.value,
            course_code: selectedCourse.code,
            course_name: selectedCourse.name,
            date: sessionDate.value,
            start_time: startTime.value,
            end_time: endTime.value,
            late_time: lateTime.value,
            open_check_in_time: openCheckInTime.value,
            close_check_in_time: closeCheckInTime.value,
            status: 'pending',
            created_by_uid: currentUser.uid,
            created_at: new Date().toISOString()
        };
        
        try {
            await addDoc(collection(db, 'attendance_sessions'), sessionData);
            
            Swal.fire('สำเร็จ', 'สร้างเซสชันเช็คชื่อเรียบร้อย', 'success');
            
            closeSessionModalHandler();
            await loadSessions();
            displaySessions();
            
        } catch (error) {
            console.error('Error creating session:', error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างเซสชันได้', 'error');
        }
    }

    // Force open session
    async function forceOpenSession(sessionId) {
        const result = await Swal.fire({
            title: 'เปิดเซสชัน?',
            text: 'คุณต้องการเปิดเซสชันเช็คชื่อนี้หรือไม่?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'เปิดเซสชัน',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            try {
                await updateDoc(doc(db, 'attendance_sessions', sessionId), {
                    status: 'open'
                });
                
                Swal.fire('สำเร็จ', 'เปิดเซสชันเรียบร้อย', 'success');
                await loadSessions();
                displaySessions();
                
            } catch (error) {
                console.error('Error opening session:', error);
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเปิดเซสชันได้', 'error');
            }
        }
    }

    // Force close session
    async function forceCloseSession(sessionId) {
        const result = await Swal.fire({
            title: 'ปิดเซสชัน?',
            text: 'คุณต้องการปิดเซสชันเช็คชื่อนี้หรือไม่?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ปิดเซสชัน',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            try {
                await updateDoc(doc(db, 'attendance_sessions', sessionId), {
                    status: 'closed'
                });
                
                Swal.fire('สำเร็จ', 'ปิดเซสชันเรียบร้อย', 'success');
                await loadSessions();
                displaySessions();
                
            } catch (error) {
                console.error('Error closing session:', error);
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถปิดเซสชันได้', 'error');
            }
        }
    }

    // View session details
    function viewSessionDetails(sessionId) {
        window.location.href = `/attendance-management.html?session=${sessionId}`;
    }

    // Delete session
    async function deleteSession(sessionId) {
        const session = sessions.find(s => s.id === sessionId);
        
        const result = await Swal.fire({
            title: 'ยืนยันการลบ',
            text: `คุณต้องการลบเซสชัน "${session.course_code}" วันที่ ${session.date} หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#dc2626'
        });
        
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, 'attendance_sessions', sessionId));
                
                Swal.fire('สำเร็จ', 'ลบเซสชันเรียบร้อย', 'success');
                await loadSessions();
                displaySessions();
                
            } catch (error) {
                console.error('Error deleting session:', error);
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลบเซสชันได้', 'error');
            }
        }
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
                const { signOutUser } = await import('../auth.js');
                await signOutUser();
            } catch (error) {
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถออกจากระบบได้', 'error');
            }
        }
    }

    // Make functions available globally
    window.forceOpenSession = forceOpenSession;
    window.forceCloseSession = forceCloseSession;
    window.viewSessionDetails = viewSessionDetails;
    window.deleteSession = deleteSession;
});