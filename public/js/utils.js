// Utility Functions

// Date and Time Utilities
const DateUtils = {
    // Get current date in YYYY-MM-DD format
    getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    },
    
    // Get current time in HH:MM format
    getCurrentTime() {
        const now = new Date();
        return now.toTimeString().slice(0, 5);
    },
    
    // Get current ISO datetime string
    getCurrentDateTime() {
        return new Date().toISOString();
    },
    
    // Format date for Thai display
    formatThaiDate(dateString) {
        const date = new Date(dateString);
        const thaiMonths = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];
        
        const day = date.getDate();
        const month = thaiMonths[date.getMonth()];
        const year = date.getFullYear() + 543; // Convert to Buddhist Era
        
        return `${day} ${month} ${year}`;
    },
    
    // Format time for Thai display
    formatThaiTime(timeString) {
        return `${timeString} น.`;
    }
};

// Validation Utilities
const ValidationUtils = {
    // Check if email is MSU domain
    isMSUEmail(email) {
        return email && email.endsWith('@msu.ac.th');
    },
    
    // Validate student ID format
    isValidStudentId(studentId) {
        return /^\d{10}$/.test(studentId);
    },
    
    // Validate course code format
    isValidCourseCode(courseCode) {
        return /^[A-Z]{2}\d{3}$/.test(courseCode);
    }
};

// GPS Utilities
const GPSUtils = {
    // Get current position
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser.'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                position => resolve(position),
                error => reject(error),
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    },
    
    // Calculate distance between two points in meters
    calculateDistance(lat1, lon1, lat2, lon2) {
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
    },
    
    // Check if position is within allowed radius
    isWithinRadius(currentLat, currentLon, centerLat, centerLon, allowedRadius) {
        const distance = this.calculateDistance(currentLat, currentLon, centerLat, centerLon);
        return distance <= allowedRadius;
    }
};

// UI Utilities
const UIUtils = {
    // Show loading state
    showLoading() {
        document.getElementById('loading-screen').classList.remove('hidden');
        document.getElementById('main-content').classList.add('hidden');
    },
    
    // Hide loading state
    hideLoading() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
    },
    
    // Show success message
    showSuccess(title, text) {
        Swal.fire({
            icon: 'success',
            title: title,
            text: text,
            confirmButtonColor: '#0066CC',
            confirmButtonText: 'ตกลง'
        });
    },
    
    // Show error message
    showError(title, text) {
        Swal.fire({
            icon: 'error',
            title: title,
            text: text,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'ตกลง'
        });
    },
    
    // Show warning message
    showWarning(title, text) {
        Swal.fire({
            icon: 'warning',
            title: title,
            text: text,
            confirmButtonColor: '#f59e0b',
            confirmButtonText: 'ตกลง'
        });
    },
    
    // Show confirmation dialog
    showConfirmation(title, text) {
        return Swal.fire({
            icon: 'question',
            title: title,
            text: text,
            showCancelButton: true,
            confirmButtonColor: '#0066CC',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ยกเลิก'
        });
    },
    
    // Create status badge
    createStatusBadge(status) {
        const statusConfig = {
            'present': { class: 'badge-success', text: 'เข้าเรียน' },
            'late': { class: 'badge-warning', text: 'มาสาย' },
            'absent': { class: 'badge-danger', text: 'ขาดเรียน' },
            'leave': { class: 'badge-info', text: 'ลา' },
            'pending': { class: 'badge-secondary', text: 'รอเปิด' },
            'open': { class: 'badge-success', text: 'เปิดแล้ว' },
            'closed': { class: 'badge-danger', text: 'ปิดแล้ว' }
        };
        
        const config = statusConfig[status] || { class: 'badge-secondary', text: status };
        return `<span class="badge ${config.class}">${config.text}</span>`;
    }
};

// Router Utilities
const Router = {
    // Navigate to a specific route
    navigate(route) {
        window.history.pushState({}, '', route);
        this.handleRoute();
    },
    
    // Handle current route
    handleRoute() {
        const path = window.location.pathname;
        // Route handling will be implemented in main.js
        console.log('Current route:', path);
    }
};

// Export utilities globally
window.DateUtils = DateUtils;
window.ValidationUtils = ValidationUtils;
window.GPSUtils = GPSUtils;
window.UIUtils = UIUtils;
window.Router = Router;