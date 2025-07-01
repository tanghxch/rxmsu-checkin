// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    query, 
    where, 
    getDocs 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase Config - ใส่ config ของคุณที่นี่
   const firebaseConfig = {
  apiKey: "AIzaSyBqzEXN64MDBEy-nHuUn4IrIUeKhSN10UA",
  authDomain: "rx-msu-checkin.firebaseapp.com",
  projectId: "rx-msu-checkin",
  storageBucket: "rx-msu-checkin.firebasestorage.app",
  messagingSenderId: "741604014209",
  appId: "1:741604014209:web:ef76b40f04e96f2d0a7580",
  measurementId: "G-69Z2MLNZSJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// User roles
const USER_ROLES = {
    ADMIN: 'admin',
    LECTURER: 'lecturer',
    STUDENT: 'student'
};

// Admin email
const ADMIN_EMAIL = 'chiradet.l@msu.ac.th';

// Export Firebase instances
export { auth, db, provider };

// Check if email is MSU domain
export function isMSUEmail(email) {
    return email && email.endsWith('@msu.ac.th');
}

// Get user role
export async function getUserRole(user) {
    if (!user || !user.email) return null;
    
    // Check if admin
    if (user.email === ADMIN_EMAIL) {
        return USER_ROLES.ADMIN;
    }
    
    try {
        // Check if lecturer
        const lecturerQuery = query(
            collection(db, 'lecturers'), 
            where('email', '==', user.email)
        );
        const lecturerSnapshot = await getDocs(lecturerQuery);
        
        if (!lecturerSnapshot.empty) {
            return USER_ROLES.LECTURER;
        }
        
        // Check if student
        const studentQuery = query(
            collection(db, 'students'), 
            where('email', '==', user.email)
        );
        const studentSnapshot = await getDocs(studentQuery);
        
        if (!studentSnapshot.empty) {
            return USER_ROLES.STUDENT;
        }
        
        return null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
}

// Google Sign In
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Check MSU email domain
        if (!isMSUEmail(user.email)) {
            await signOut(auth);
            throw new Error('กรุณาใช้อีเมล @msu.ac.th เท่านั้น');
        }
        
        return user;
    } catch (error) {
        console.error('Sign in error:', error);
        throw error;
    }
}

// Sign out
export async function signOutUser() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Sign out error:', error);
        throw error;
    }
}

// Redirect based on user role
export async function redirectBasedOnRole(user) {
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    
    const role = await getUserRole(user);
    
    if (!role) {
        Swal.fire({
            icon: 'error',
            title: 'ไม่พบข้อมูลผู้ใช้',
            text: 'กรุณาติดต่อผู้ดูแลระบบเพื่อลงทะเบียนเข้าใช้งาน',
            confirmButtonText: 'ตกลง'
        }).then(() => {
            signOutUser();
        });
        return;
    }
    
    // Redirect based on role
    const currentPath = window.location.pathname;
    
    switch (role) {
        case USER_ROLES.ADMIN:
            if (currentPath !== '/admin-dashboard.html' && !currentPath.startsWith('/admin/')) {
                window.location.href = '/admin-dashboard.html';
            }
            break;
        case USER_ROLES.LECTURER:
            if (currentPath !== '/lecturer-dashboard.html' && !currentPath.startsWith('/lecturer/')) {
                window.location.href = '/lecturer-dashboard.html';
            }
            break;
        case USER_ROLES.STUDENT:
            if (currentPath !== '/' && currentPath !== '/index.html') {
                window.location.href = '/';
            }
            break;
    }
}

// Check authentication and redirect
export function checkAuthAndRedirect() {
    onAuthStateChanged(auth, async (user) => {
        const currentPath = window.location.pathname;
        
        if (!user) {
            // Not logged in
            if (currentPath !== '/login.html') {
                window.location.href = '/login.html';
            }
            return;
        }
        
        // User is logged in
        if (currentPath === '/login.html') {
            await redirectBasedOnRole(user);
        } else {
            // Check if user has permission for current page
            const role = await getUserRole(user);
            const hasPermission = checkPagePermission(currentPath, role);
            
            if (!hasPermission) {
                await redirectBasedOnRole(user);
            }
        }
    });
}

// Check page permission
function checkPagePermission(path, role) {
    // Public pages
    if (['/login.html'].includes(path)) {
        return true;
    }
    
    // Student pages
    if (['/', '/index.html'].includes(path)) {
        return role === USER_ROLES.STUDENT;
    }
    
    // Lecturer pages
    if (path.startsWith('/lecturer/') || path === '/lecturer-dashboard.html') {
        return role === USER_ROLES.LECTURER;
    }
    
    // Admin pages
    if (path.startsWith('/admin/') || path === '/admin-dashboard.html') {
        return role === USER_ROLES.ADMIN;
    }
    
    // Shared pages (attendance management)
    if (path === '/attendance-management.html') {
        return role === USER_ROLES.ADMIN || role === USER_ROLES.LECTURER;
    }
    
    return false;
}

// Initialize auth checking
document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndRedirect();
});