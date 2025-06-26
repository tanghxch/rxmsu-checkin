// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    // ใส่ config ของคุณที่นี่
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
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
            
            if (distance <= allowedRadius) {
                // Save attendance
                await saveAttendance(userLat, userLng, distance);
                
                Swal.fire({
                    icon: 'success',
                    title: 'เช็คชื่อสำเร็จ!',
                    text: `คุณอยู่ห่างจากจุดเช็คชื่อ ${Math.round(distance)} เมตร`,
                    confirmButtonColor: '#10B981',
                    showConfirmButton: true,
                    timer: 3000
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'อยู่นอกพื้นที่',
                    text: `คุณอยู่ห่างจากจุดเช็คชื่อ ${Math.round(distance)} เมตร (เกินขอบเขต ${allowedRadius} เมตร)`,
                    confirmButtonColor: '#EF4444'
                });
            }
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

// Calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Save attendance
async function saveAttendance(lat, lng, distance) {
    try {
        const q = query(collection(db, 'students'), where('email', '==', currentUser.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const studentData = querySnapshot.docs[0].data();
            
            await addDoc(collection(db, 'attendance'), {
                studentId: studentData.studentId,
                studentName: studentData.name,
                email: currentUser.email,
                timestamp: new Date(),
                location: { lat, lng },
                distance: distance,
                status: 'present'
            });
        }
    } catch (error) {
        console.error('Error saving attendance:', error);
    }
}

// Admin functions
window.addStudent = async () => {
    const studentId = document.getElementById('studentId').value;
    const studentName = document.getElementById('studentName').value;
    const studentEmail = document.getElementById('studentEmail').value;
    const studentYear = document.getElementById('studentYear').value;
    
    if (!studentId || !studentName || !studentEmail || !studentYear) {
        Swal.fire({
            icon: 'warning',
            title: 'กรุณากรอกข้อมูลให้ครบ',
            confirmButtonColor: '#3B82F6'
        });
        return;
    }
    
    if (!studentEmail.endsWith('@msu.ac.th')) {
        Swal.fire({
            icon: 'error',
            title: 'อีเมล์ไม่ถูกต้อง',
            text: 'กรุณาใช้อีเมล์ @msu.ac.th เท่านั้น',
            confirmButtonColor: '#3B82F6'
        });
        return;
    }
    
    try {
        await addDoc(collection(db, 'students'), {
            studentId,
            name: studentName,
            email: studentEmail,
            year: parseInt(studentYear),
            createdAt: new Date()
        });
        
        // Clear form
        document.getElementById('studentId').value = '';
        document.getElementById('studentName').value = '';
        document.getElementById('studentEmail').value = '';
        document.getElementById('studentYear').value = '';
        
        Swal.fire({
            icon: 'success',
            title: 'เพิ่มนิสิตสำเร็จ',
            confirmButtonColor: '#10B981'
        });
        
        await loadAdminData();
    } catch (error) {
        console.error('Error adding student:', error);
        Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: 'ไม่สามารถเพิ่มนิสิตได้',
            confirmButtonColor: '#EF4444'
        });
    }
};

window.saveLocationSettings = async () => {
    const lat = parseFloat(document.getElementById('refLat').value);
    const lng = parseFloat(document.getElementById('refLng').value);
    const radius = parseInt(document.getElementById('radius').value);
    
    if (!lat || !lng || !radius) {
        Swal.fire({
            icon: 'warning',
            title: 'กรุณากรอกข้อมูลให้ครบ',
            confirmButtonColor: '#3B82F6'
        });
        return;
    }
    
    try {
        await setDoc(doc(db, 'settings', 'location'), {
            referenceLocation: { lat, lng },
            allowedRadius: radius,
            updatedAt: new Date()
        });
        
        referenceLocation = { lat, lng };
        allowedRadius = radius;
        
        Swal.fire({
            icon: 'success',
            title: 'บันทึกการตั้งค่าสำเร็จ',
            confirmButtonColor: '#10B981'
        });
    } catch (error) {
        console.error('Error saving location settings:', error);
        Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: 'ไม่สามารถบันทึกการตั้งค่าได้',
            confirmButtonColor: '#EF4444'
        });
    }
};

// Load location settings
async function loadLocationSettings() {
    try {
        const docRef = doc(db, 'settings', 'location');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            referenceLocation = data.referenceLocation;
            allowedRadius = data.allowedRadius;
            
            // Update admin form if visible
            if (!adminDashboard.classList.contains('hidden')) {
                document.getElementById('refLat').value = referenceLocation.lat;
                document.getElementById('refLng').value = referenceLocation.lng;
                document.getElementById('radius').value = allowedRadius;
            }
        }
    } catch (error) {
        console.error('Error loading location settings:', error);
    }
}

// Load admin data
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
        
        // Load attendance table
        const attendanceTable = document.getElementById('attendanceTable');
        attendanceTable.innerHTML = '';
        
        attendanceSnapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-100 hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-4 py-3 text-gray-800">${data.studentId}</td>
                <td class="px-4 py-3 text-gray-800">${data.studentName}</td>
                <td class="px-4 py-3 text-gray-600">${data.timestamp.toDate().toLocaleString('th-TH')}</td>
                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <i class="fas fa-check mr-1"></i>
                        เข้าเรียน
                    </span>
                </td>
            `;
            attendanceTable.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}
