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
    getDoc,
    setDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loading = document.getElementById('loading');
    const userInfo = document.getElementById('userInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Course management elements
    const addCourseBtn = document.getElementById('addCourseBtn');
    const searchInput = document.getElementById('searchInput');
    const codeFilter = document.getElementById('codeFilter');
    const clearFilters = document.getElementById('clearFilters');
    const coursesTableBody = document.getElementById('coursesTableBody');
    const emptyState = document.getElementById('emptyState');
    
    // Modal elements
    const courseModal = document.getElementById('courseModal');
    const modalTitle = document.getElementById('modalTitle');
    const courseForm = document.getElementById('courseForm');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    
    // Form elements
    const courseCode = document.getElementById('courseCode');
    const courseName = document.getElementById('courseName');
    const courseSection = document.getElementById('courseSection');
    
    // Enrollment modal elements
    const enrollmentModal = document.getElementById('enrollmentModal');
    const enrollmentModalTitle = document.getElementById('enrollmentModalTitle');
    const closeEnrollmentModal = document.getElementById('closeEnrollmentModal');
    const closeEnrollmentBtn = document.getElementById('closeEnrollmentBtn');
    const studentSearch = document.getElementById('studentSearch');
    const yearFilter = document.getElementById('yearFilter');
    const enrolledStudentSearch = document.getElementById('enrolledStudentSearch');
    const availableStudents = document.getElementById('availableStudents');
    const enrolledStudents = document.getElementById('enrolledStudents');
    const noAvailableStudents = document.getElementById('noAvailableStudents');
    const noEnrolledStudents = document.getElementById('noEnrolledStudents');

    // Data
    let courses = [];
    let students = [];
    let enrollments = [];
    let currentCourseId = null;
    let editingCourseId = null;

    // Auth state listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userInfo.textContent = user.displayName || user.email;
            await loadData();
            loading.style.display = 'none';
        }
    });

    // Event listeners
    logoutBtn.addEventListener('click', handleLogout);
    addCourseBtn.addEventListener('click', () => openCourseModal());
    closeModal.addEventListener('click', closeCourseModal);
    cancelBtn.addEventListener('click', closeCourseModal);
    courseForm.addEventListener('submit', handleCourseSubmit);
    
    // Filter event listeners
    searchInput.addEventListener('input', filterCourses);
    codeFilter.addEventListener('change', filterCourses);
    clearFilters.addEventListener('click', clearAllFilters);
    
    // Enrollment modal event listeners
    closeEnrollmentModal.addEventListener('click', closeEnrollModal);
    closeEnrollmentBtn.addEventListener('click', closeEnrollModal);
    studentSearch.addEventListener('input', filterAvailableStudents);
    yearFilter.addEventListener('change', filterAvailableStudents);
    enrolledStudentSearch.addEventListener('input', filterEnrolledStudents);

    // Load all data
    async function loadData() {
        try {
            await Promise.all([
                loadCourses(),
                loadStudents(),
                loadEnrollments()
            ]);
            populateFilters();
            displayCourses();
        } catch (error) {
            console.error('Error loading data:', error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้', 'error');
        }
    }

    // Load courses
    async function loadCourses() {
        const coursesQuery = query(collection(db, 'courses'), orderBy('created_at', 'desc'));
        const snapshot = await getDocs(coursesQuery);
        courses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    // Load students
    async function loadStudents() {
        const studentsQuery = query(collection(db, 'students'), orderBy('full_name'));
        const snapshot = await getDocs(studentsQuery);
        students = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    // Load enrollments
    async function loadEnrollments() {
        const snapshot = await getDocs(collection(db, 'course_enrollments'));
        enrollments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    // Populate filter options
    function populateFilters() {
        const codes = [...new Set(courses.map(course => course.code.substring(0, 2)))].sort();
        codeFilter.innerHTML = '<option value="">ทั้งหมด</option>';
        codes.forEach(code => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = code;
            codeFilter.appendChild(option);
        });
    }

    // Display courses
    function displayCourses(coursesToShow = courses) {
        coursesTableBody.innerHTML = '';
        
        if (coursesToShow.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        coursesToShow.forEach(course => {
            const enrollmentCount = enrollments.filter(e => e.course_id === course.id).length;
            const row = createCourseRow(course, enrollmentCount);
            coursesTableBody.appendChild(row);
        });
    }

    // Create course row
    function createCourseRow(course, enrollmentCount) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const createdDate = new Date(course.created_at).toLocaleDateString('th-TH');
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${course.code}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${course.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${course.section || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    ${enrollmentCount} คน
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdDate}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <button onclick="editCourse('${course.id}')" 
                        class="text-blue-600 hover:text-blue-900">แก้ไข</button>
                <button onclick="manageCourseEnrollment('${course.id}')" 
                        class="text-green-600 hover:text-green-900">จัดการนักศึกษา</button>
                <button onclick="deleteCourse('${course.id}')" 
                        class="text-red-600 hover:text-red-900">ลบ</button>
            </td>
        `;
        
        return row;
    }

    // Filter courses
    function filterCourses() {
        const searchTerm = searchInput.value.toLowerCase();
        const codePrefix = codeFilter.value;
        
        let filtered = courses;
        
        if (searchTerm) {
            filtered = filtered.filter(course => 
                course.code.toLowerCase().includes(searchTerm) ||
                course.name.toLowerCase().includes(searchTerm)
            );
        }
        
        if (codePrefix) {
            filtered = filtered.filter(course => 
                course.code.toLowerCase().startsWith(codePrefix.toLowerCase())
            );
        }
        
        displayCourses(filtered);
    }

    // Clear all filters
    function clearAllFilters() {
        searchInput.value = '';
        codeFilter.value = '';
        displayCourses();
    }

    // Open course modal
    function openCourseModal(courseId = null) {
        editingCourseId = courseId;
        
        if (courseId) {
            const course = courses.find(c => c.id === courseId);
            modalTitle.textContent = 'แก้ไขรายวิชา';
            courseCode.value = course.code;
            courseName.value = course.name;
            courseSection.value = course.section || '';
        } else {
            modalTitle.textContent = 'เพิ่มรายวิชาใหม่';
            courseForm.reset();
        }
        
        courseModal.classList.remove('hidden');
    }

    // Close course modal
    function closeCourseModal() {
        courseModal.classList.add('hidden');
        editingCourseId = null;
        courseForm.reset();
    }

    // Handle course form submit
    async function handleCourseSubmit(e) {
        e.preventDefault();
        
        const courseData = {
            code: courseCode.value.trim().toUpperCase(),
            name: courseName.value.trim(),
            section: courseSection.value.trim() || null
        };
        
        try {
            if (editingCourseId) {
                // Update existing course
                await updateDoc(doc(db, 'courses', editingCourseId), courseData);
                Swal.fire('สำเร็จ', 'แก้ไขรายวิชาเรียบร้อย', 'success');
            } else {
                // Check for duplicate course code
                const duplicateCourse = courses.find(c => c.code === courseData.code);
                if (duplicateCourse) {
                    Swal.fire('ข้อผิดพลาด', 'รหัสวิชานี้มีอยู่แล้ว', 'error');
                    return;
                }
                
                // Add new course
                courseData.created_at = new Date().toISOString();
                await addDoc(collection(db, 'courses'), courseData);
                Swal.fire('สำเร็จ', 'เพิ่มรายวิชาเรียบร้อย', 'success');
            }
            
            closeCourseModal();
            await loadCourses();
            populateFilters();
            displayCourses();
            
        } catch (error) {
            console.error('Error saving course:', error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกรายวิชาได้', 'error');
        }
    }

    // Delete course
    async function deleteCourse(courseId) {
        const course = courses.find(c => c.id === courseId);
        const enrollmentCount = enrollments.filter(e => e.course_id === courseId).length;
        
        let confirmText = `คุณต้องการลบรายวิชา "${course.code} - ${course.name}" หรือไม่?`;
        if (enrollmentCount > 0) {
            confirmText += `\n\nรายวิชานี้มีนักศึกษาลงทะเบียน ${enrollmentCount} คน การลบจะส่งผลต่อข้อมูลการเช็คชื่อ`;
        }
        
        const result = await Swal.fire({
            title: 'ยืนยันการลบ',
            text: confirmText,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#dc2626'
        });
        
        if (result.isConfirmed) {
            try {
                // Delete course enrollments first
                const enrollmentsToDelete = enrollments.filter(e => e.course_id === courseId);
                await Promise.all(
                    enrollmentsToDelete.map(enrollment => 
                        deleteDoc(doc(db, 'course_enrollments', enrollment.id))
                    )
                );
                
                // Delete course
                await deleteDoc(doc(db, 'courses', courseId));
                
                Swal.fire('สำเร็จ', 'ลบรายวิชาเรียบร้อย', 'success');
                
                await loadData();
                
            } catch (error) {
                console.error('Error deleting course:', error);
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลบรายวิชาได้', 'error');
            }
        }
    }

    // Manage course enrollment
    async function manageCourseEnrollment(courseId) {
        currentCourseId = courseId;
        const course = courses.find(c => c.id === courseId);
        enrollmentModalTitle.textContent = `จัดการการลงทะเบียน: ${course.code} - ${course.name}`;
        
        await loadEnrollmentData();
        enrollmentModal.classList.remove('hidden');
    }

    // Close enrollment modal
    function closeEnrollModal() {
        enrollmentModal.classList.add('hidden');
        currentCourseId = null;
        studentSearch.value = '';
        yearFilter.value = '';
        enrolledStudentSearch.value = '';
    }

    // Load enrollment data
    async function loadEnrollmentData() {
        await loadEnrollments();
        displayEnrollmentStudents();
    }

    // Display enrollment students
    function displayEnrollmentStudents() {
        const courseEnrollments = enrollments.filter(e => e.course_id === currentCourseId);
        const enrolledStudentIds = courseEnrollments.map(e => e.student_id);
        
        const availableStudentsList = students.filter(s => !enrolledStudentIds.includes(s.id));
        const enrolledStudentsList = students.filter(s => enrolledStudentIds.includes(s.id));
        
        displayAvailableStudents(availableStudentsList);
        displayEnrolledStudents(enrolledStudentsList);
    }

    // Display available students
    function displayAvailableStudents(studentsToShow) {
        availableStudents.innerHTML = '';
        
        if (studentsToShow.length === 0) {
            noAvailableStudents.classList.remove('hidden');
            return;
        }
        
        noAvailableStudents.classList.add('hidden');
        
        studentsToShow.forEach(student => {
            const studentElement = createStudentElement(student, false);
            availableStudents.appendChild(studentElement);
        });
    }

    // Display enrolled students
    function displayEnrolledStudents(studentsToShow) {
        enrolledStudents.innerHTML = '';
        
        if (studentsToShow.length === 0) {
            noEnrolledStudents.classList.remove('hidden');
            return;
        }
        
        noEnrolledStudents.classList.add('hidden');
        
        studentsToShow.forEach(student => {
            const studentElement = createStudentElement(student, true);
            enrolledStudents.appendChild(studentElement);
        });
    }

    // Create student element
    function createStudentElement(student, isEnrolled) {
        const div = document.createElement('div');
        div.className = 'p-3 hover:bg-gray-50 flex items-center justify-between';
        
        div.innerHTML = `
            <div class="flex-1">
                <div class="font-medium text-gray-900">${student.full_name}</div>
                <div class="text-sm text-gray-500">${student.student_id} | ชั้นปีที่ ${student.year_level}</div>
                <div class="text-xs text-gray-400">${student.email}</div>
            </div>
            <button onclick="${isEnrolled ? 'unenrollStudent' : 'enrollStudent'}('${student.id}')" 
                    class="px-3 py-1 rounded text-sm font-medium transition duration-200 ${
                        isEnrolled 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }">
                ${isEnrolled ? 'ยกเลิก' : 'ลงทะเบียน'}
            </button>
        `;
        
        return div;
    }

    // Filter available students
    function filterAvailableStudents() {
        const searchTerm = studentSearch.value.toLowerCase();
        const yearLevel = yearFilter.value;
        
        const courseEnrollments = enrollments.filter(e => e.course_id === currentCourseId);
        const enrolledStudentIds = courseEnrollments.map(e => e.student_id);
        
        let filtered = students.filter(s => !enrolledStudentIds.includes(s.id));
        
        if (searchTerm) {
            filtered = filtered.filter(student => 
                student.full_name.toLowerCase().includes(searchTerm) ||
                student.student_id.toLowerCase().includes(searchTerm) ||
                student.email.toLowerCase().includes(searchTerm)
            );
        }
        
        if (yearLevel) {
            filtered = filtered.filter(student => student.year_level.toString() === yearLevel);
        }
        
        displayAvailableStudents(filtered);
    }

    // Filter enrolled students
    function filterEnrolledStudents() {
        const searchTerm = enrolledStudentSearch.value.toLowerCase();
        
        const courseEnrollments = enrollments.filter(e => e.course_id === currentCourseId);
        const enrolledStudentIds = courseEnrollments.map(e => e.student_id);
        
        let filtered = students.filter(s => enrolledStudentIds.includes(s.id));
        
        if (searchTerm) {
            filtered = filtered.filter(student => 
                student.full_name.toLowerCase().includes(searchTerm) ||
                student.student_id.toLowerCase().includes(searchTerm) ||
                student.email.toLowerCase().includes(searchTerm)
            );
        }
        
        displayEnrolledStudents(filtered);
    }

    // Enroll student
    async function enrollStudent(studentId) {
        try {
            const enrollmentId = `${studentId}_${currentCourseId}`;
            await setDoc(doc(db, 'course_enrollments', enrollmentId), {
                course_id: currentCourseId,
                student_id: studentId,
                created_at: new Date().toISOString()
            });
            
            await loadEnrollmentData();
            displayEnrollmentStudents();
            
            const student = students.find(s => s.id === studentId);
            Swal.fire('สำเร็จ', `ลงทะเบียน ${student.full_name} เรียบร้อย`, 'success');
            
        } catch (error) {
            console.error('Error enrolling student:', error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลงทะเบียนได้', 'error');
        }
    }

    // Unenroll student
    async function unenrollStudent(studentId) {
        const student = students.find(s => s.id === studentId);
        
        const result = await Swal.fire({
            title: 'ยืนยันการยกเลิก',
            text: `คุณต้องการยกเลิกการลงทะเบียนของ ${student.full_name} หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ยกเลิก',
            cancelButtonText: 'ไม่ยกเลิก'
        });
        
        if (result.isConfirmed) {
            try {
                const enrollmentId = `${studentId}_${currentCourseId}`;
                await deleteDoc(doc(db, 'course_enrollments', enrollmentId));
                
                await loadEnrollmentData();
                displayEnrollmentStudents();
                
                Swal.fire('สำเร็จ', `ยกเลิกการลงทะเบียน ${student.full_name} เรียบร้อย`, 'success');
                
            } catch (error) {
                console.error('Error unenrolling student:', error);
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถยกเลิกการลงทะเบียนได้', 'error');
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
    window.editCourse = (courseId) => openCourseModal(courseId);
    window.deleteCourse = deleteCourse;
    window.manageCourseEnrollment = manageCourseEnrollment;
    window.enrollStudent = enrollStudent;
    window.unenrollStudent = unenrollStudent;
});