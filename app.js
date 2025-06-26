// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAAc27WlP5Q1ZtKyGnj-52aMzVp201J4iA",
  authDomain: "rx-checkin.firebaseapp.com",
  projectId: "rx-checkin",
  storageBucket: "rx-checkin.firebasestorage.app",
  messagingSenderId: "1075688404567",
  appId: "1:1075688404567:web:ef353461a074e212c89512"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Global variables
let currentUser = null;
let referenceLocation = { lat: 16.2467, lng: 103.2521 }; // พิกัดมหาวิทยาลัยมหาสารคาม
let allowedRadius = 100; // เมตร

// DOM Elements
const loginSection = document.getElementById('loginSection');
const studentDashboard = document.getElementById('studentDashboard');
const adminDashboard = document.getElementById('adminDashboard');
const userInfo = document.getElementById('userInfo');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');

// Check authentication state
auth.onAuthStateChanged(async (user) => {
    if (user && user.email.endsWith('@msu.ac.th')) {
        currentUser = user;
        
        // Check if user exists in database
        const studentExists = await checkStudentExists(user.email);
        const isAdmin = user.email === 'chiradet.l@msu.ac.th';
        
        if (studentExists || isAdmin) {
            showUserDashboard(user, isAdmin);
            await loadLocationSettings();
            if (isAdmin) {
                await loadAdminData();
            }
        } else {
            Swal.fire({
                icon: 'error',
                title: 'ไม่พบข้อมูลนิสิต',
                text: 'กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มข้อมูลของคุณ',
                confirmButtonColor: '#3B82F6'
            });
            await firebaseSignOut(auth);
        }
    } else {
        showLoginSection();
    }
});

// Sign in with Google
window.signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        if (!user.email.endsWith('@msu.ac.th')) {
            await firebaseSignOut(auth);
            Swal.fire({
                icon: 'error',
                title: 'อีเมล์ไม่ถูกต้อง',
                text: 'กรุณาใช้อีเมล์ @msu.ac.th เท่านั้น',
                confirmButtonColor: '#3B82F6'
            });
        }
    } catch (error) {
        console.error('Error signing in:', error);
        Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง',
            confirmButtonColor: '#3B82F6'
        });
    }
};

// Sign out
window.signOut = async () => {
    try {
        await firebaseSignOut(auth);
        showLoginSection();
    } catch (error) {
        console.error('Error signing out:', error);
    }
};

// Check if student exists in database
async function checkStudentExists(email) {
    try {
        const q = query(collection(db, 'students'), where('email', '==', email));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error('Error checking student:', error);
        return false;
    }
}

// Show login section
function showLoginSection() {
    loginSection.classList.remove('hidden');
    studentDashboard.classList.add('hidden');
    adminDashboard.classList.add('hidden');
    userInfo.classList.add('hidden');
}

// Show user dashboard
async function showUserDashboard(user, isAdmin) {
    loginSection.classList.add('hidden');
    userInfo.classList.remove('hidden');
    
    userPhoto.src = user.photoURL;
    userName.textContent = user.displayName;
    
    if (isAdmin) {
        adminDashboard.classList.remove('hidden');
        studentDashboard.classList.add('hidden');
    } else {
        studentDashboard.classList.remove('hidden');
        adminDashboard.classList.add('hidden');
        await loadStudentInfo(user.email);
    }
}

// Load student information
async function loadStudentInfo(email) {
    try {
        const q = query(collection(db, 'students'), where('email', '==', email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const studentData = querySnapshot.docs[0].data();
            const studentInfo = document.getElementById('studentInfo');
            studentInfo.innerHTML = `
                <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <i class="fas fa-id-card text-blue-500"></i>
                    <div>
                        <div class="font-medium text-gray-800">รหัสนิสิต</div>
                        <div class="text-gray-600">${studentData.studentId}</div>
                    </div>
                </div>
                <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <i class="fas fa-user text-green-500"></i>
                    <div>
                        <div class="font-medium text-gray-800">ชื่อ-นามสกุล</div>
                        <div class="text-gray-600">${studentData.name}</div>
                    </div>
                </div>
                <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <i class="fas fa-graduation-cap text-purple-500"></i>
                    <div>
                        <div class="font-medium text-gray-800">ชั้นปี</div>
                        <div class="text-gray-600">ปี ${studentData.year}</div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading student info:', error);
    }
}

// Check attendance
// Check attendance - อนุญาตให้เช็คได้ทุกกรณี
window.checkAttendance = async () => {
    if (!navigator.geolocation) {
        Swal.fire({
            icon: 'error',
            title: 'ไม่รองรับ GPS',
            text: 'เบราว์เซอร์ของคุณไม่รองรับการใช้งาน GPS',
            confirmButtonColor: '#3B82F6'
        });
        return;
    }

    // Show loading
    Swal.fire({
        title: 'กำลังตรวจสอบตำแหน่ง...',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            
            const distance = calculateDistance(
                userLat, userLng,
                referenceLocation.lat, referenceLocation.lng
            );
            
            const isInRadius = distance <= allowedRadius;
            
            // Save attendance (ทุกกรณี)
            const currentTime = await saveAttendance(userLat, userLng, distance, isInRadius);
            
            // Show success message with time
            Swal.fire({
                icon: 'success',
                title: 'เช็คชื่อเรียบร้อยแล้ว! ✅',
                html: `
                    <div class="text-lg">
                        <p class="mb-2">เวลาเช็คชื่อ: <strong>${currentTime}</strong></p>
                        <p class="text-gray-600">ระยะทาง: ${Math.round(distance)} เมตร</p>
                    </div>
                `,
                confirmButtonColor: '#10B981',
                showConfirmButton: true,
                timer: 4000
            });
            
            // Update attendance status display
            updateAttendanceStatusDisplay(currentTime, distance, isInRadius);
            
        },
        (error) => {
            console.error('Error getting location:', error);
            Swal.fire({
                icon: 'error',
                title: 'ไม่สามารถเข้าถึงตำแหน่ง',
                text: 'กรุณาอนุญาตให้เว็บไซต์เข้าถึงตำแหน่งของคุณ',
                confirmButtonColor: '#3B82F6'
            });
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
};

// Update attendance status display
function updateAttendanceStatusDisplay(time, distance, isInRadius) {
    const statusDiv = document.getElementById('attendanceStatus');
    const statusClass = isInRadius ? 'status-in' : 'status-out';
    const statusText = isInRadius ? 'อยู่ในรัศมี' : 'อยู่นอกรัศมี';
    const statusIcon = isInRadius ? 'fa-check-circle' : 'fa-exclamation-circle';
    
    statusDiv.innerHTML = `
        <div class="p-4 rounded-lg ${statusClass}">
            <div class="flex items-center justify-center space-x-2">
                <i class="fas ${statusIcon}"></i>
                <span class="font-semibold">เช็คชื่อล่าสุด: ${time}</span>
            </div>
            <div class="text-sm mt-1">
                ระยะทาง: ${Math.round(distance)} เมตร - ${statusText}
            </div>
        </div>
    `;
}

// Save attendance - เพิ่มการบันทึกสถานะตำแหน่ง
async function saveAttendance(lat, lng, distance, isInRadius) {
    try {
        const q = query(collection(db, 'students'), where('email', '==', currentUser.email));
        const querySnapshot = await getDocs(q);
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        if (!querySnapshot.empty) {
            const studentData = querySnapshot.docs[0].data();
            
            await addDoc(collection(db, 'attendance'), {
                studentId: studentData.studentId,
                studentName: studentData.name,
                email: currentUser.email,
                timestamp: now,
                location: { lat, lng },
                distance: distance,
                isInRadius: isInRadius,
                status: 'present' // ทุกคนได้สถานะ present
            });
        }
        
        return timeString;
    } catch (error) {
        console.error('Error saving attendance:', error);
        return new Date().toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
    }
}

// Clear all attendance - ฟังก์ชันใหม่
window.clearAllAttendance = async () => {
    const result = await Swal.fire({
        title: 'ยืนยันการลบข้อมูล',
        text: 'คุณต้องการลบการเช็คชื่อทั้งหมดใช่หรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280',
        confirmButtonText: 'ใช่, ลบทั้งหมด',
        cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
        try {
            // Show loading
            Swal.fire({
                title: 'กำลังลบข้อมูล...',
                allowOutsideClick: false,
                showConfirmButton: false,
                willOpen: () => {
                    Swal.showLoading();
                }
            });

            // Delete all attendance records
            const attendanceQuery = query(collection(db, 'attendance'));
            const querySnapshot = await getDocs(attendanceQuery);
            
            const deletePromises = [];
            querySnapshot.forEach((doc) => {
                deletePromises.push(deleteDoc(doc.ref));
            });
            
            await Promise.all(deletePromises);
            
            Swal.fire({
                icon: 'success',
                title: 'ลบข้อมูลสำเร็จ!',
                text: 'ลบการเช็คชื่อทั้งหมดเรียบร้อยแล้ว',
                confirmButtonColor: '#10B981'
            });
            
            // Reload admin data
            await loadAdminData();
            
        } catch (error) {
            console.error('Error clearing attendance:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถลบข้อมูลได้',
                confirmButtonColor: '#EF4444'
            });
        }
    }
};

// Delete individual attendance record
window.deleteAttendance = async (docId) => {
    const result = await Swal.fire({
        title: 'ยืนยันการลบ',
        text: 'คุณต้องการลบรายการนี้ใช่หรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280',
        confirmButtonText: 'ใช่, ลบ',
        cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, 'attendance', docId));
            
            Swal.fire({
                icon: 'success',
                title: 'ลบสำเร็จ!',
                text: 'ลบรายการเรียบร้อยแล้ว',
                timer: 2000,
                showConfirmButton: false
            });
            
            // Reload admin data
            await loadAdminData();
            
        } catch (error) {
            console.error('Error deleting attendance:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถลบรายการได้',
                confirmButtonColor: '#EF4444'
            });
        }
    }
};

// Load admin data - อัปเดตให้แสดงสถิติและสถานะตำแหน่ง
async function loadAdminData() {
    try {
        // Load total students
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        document.getElementById('totalStudents').textContent = studentsSnapshot.size;
        
        // Load today's attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const attendanceQuery = query(
            collection(db, 'attendance'),
            where('timestamp', '>=', today),
            orderBy('timestamp', 'desc')
        );
        
        const attendanceSnapshot = await getDocs(attendanceQuery);
        document.getElementById('todayAttendance').textContent = attendanceSnapshot.size;
        
        // Count in/out radius
        let inRadius = 0;
        let outRadius = 0;
        
        // Load attendance table
        const attendanceTable = document.getElementById('attendanceTable');
        attendanceTable.innerHTML = '';
        
        attendanceSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;
            
            // Count radius status
            if (data.isInRadius) {
                inRadius++;
            } else {
                outRadius++;
            }
            
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-100 hover:bg-gray-50';
            
            const statusClass = data.isInRadius ? 'status-in' : 'status-out';
            const statusText = data.isInRadius ? 'อยู่ในรัศมี' : 'อยู่นอกรัศมี';
            const statusIcon = data.isInRadius ? 'fa-check-circle' : 'fa-exclamation-circle';
            
            row.innerHTML = `
                <td class="px-4 py-3 text-gray-800">${data.studentId}</td>
                <td class="px-4 py-3 text-gray-800">${data.studentName}</td>
                <td class="px-4 py-3 text-gray-600">${data.timestamp.toDate().toLocaleString('th-TH')}</td>
                <td class="px-4 py-3 text-gray-600">${Math.round(data.distance)} ม.</td>
                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                        <i class="fas ${statusIcon} mr-1"></i>
                        ${statusText}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <button onclick="deleteAttendance('${docId}')" 
                            class="text-red-600 hover:text-red-800 transition-colors">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            attendanceTable.appendChild(row);
        });
        
        // Update radius statistics
        document.getElementById('inRadius').textContent = inRadius;
        document.getElementById('outRadius').textContent = outRadius;
        
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

// เพิ่ม import สำหรับ deleteDoc
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, doc, setDoc, getDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
