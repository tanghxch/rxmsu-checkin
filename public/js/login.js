import { signInWithGoogle } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const loginLoading = document.getElementById('loginLoading');
    
    googleLoginBtn.addEventListener('click', async () => {
        try {
            googleLoginBtn.style.display = 'none';
            loginLoading.classList.remove('hidden');
            
            await signInWithGoogle();
            
            // Success - auth.js will handle redirect
            
        } catch (error) {
            console.error('Login error:', error);
            
            let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
            
            if (error.message.includes('@msu.ac.th')) {
                errorMessage = error.message;
            } else if (error.code === 'auth/popup-closed-by-user') {
                errorMessage = 'การเข้าสู่ระบบถูกยกเลิก';
            } else if (error.code === 'auth/popup-blocked') {
                errorMessage = 'Popup ถูกบล็อก กรุณาอนุญาต popup สำหรับเว็บไซต์นี้';
            }
            
            Swal.fire({
                icon: 'error',
                title: 'เข้าสู่ระบบไม่สำเร็จ',
                text: errorMessage,
                confirmButtonText: 'ตกลง'
            });
            
            googleLoginBtn.style.display = 'flex';
            loginLoading.classList.add('hidden');
        }
    });
});