import { auth, db } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    collection, 
    getDocs, 
    query, 
    where 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loading = document.getElementById('loading');
    const userInfo = document.getElementById('userInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Stats elements
    const totalCourses = document.getElementById('totalCourses');
    const totalStudents = document.getElementById('totalStudents');
    const totalLecturers = document.getElementById('totalLecturers');
    const todaySessions = document.getElementById('todaySessions');

    // Auth state listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userInfo.textContent = user.displayName || user.email;
            await loadDashboardStats();
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

    // Load dashboard statistics
    async function loadDashboardStats() {
        try {
            // Get courses count
            const coursesSnapshot = await getDocs(collection(db, 'courses'));
            totalCourses.textContent = coursesSnapshot.size;

            // Get students count
            const studentsSnapshot = await getDocs(collection(db, 'students'));
            totalStudents.textContent = studentsSnapshot.size;

            // Get lecturers count
            const lecturersSnapshot = await getDocs(collection(db, 'lecturers'));
            totalLecturers.textContent = lecturersSnapshot.size;

            // Get today's sessions count
            const today = new Date().toISOString().split('T')[0];
            const todaySessionsQuery = query(
                collection(db, 'attendance_sessions'),
                where('date', '==', today)
            );
            const todaySessionsSnapshot = await getDocs(todaySessionsQuery);
            todaySessions.textContent = todaySessionsSnapshot.size;

        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            // Set default values on error
            totalCourses.textContent = '0';
            totalStudents.textContent = '0';
            totalLecturers.textContent = '0';
            todaySessions.textContent = '0';
        }
    }
});