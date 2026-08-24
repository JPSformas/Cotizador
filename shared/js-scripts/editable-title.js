// Handle editable title functionality
document.addEventListener('DOMContentLoaded', function() {
    const cotizationTitle = document.getElementById('cotizationTitle');
    const editIcon = document.getElementById('editTitleIcon');
    
    // Check if elements exist before proceeding
    if (!cotizationTitle || !editIcon) {
        return;
    }
    
    // Load saved title from localStorage or use default
    const savedTitle = localStorage.getItem('cotizationTitle');
    if (savedTitle) {
        cotizationTitle.textContent = savedTitle;
    }
    
    // Make icon clickable to focus the title
    editIcon.addEventListener('click', function() {
        cotizationTitle.focus();
        // Select all text for easier editing
        const range = document.createRange();
        range.selectNodeContents(cotizationTitle);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });
    
    // Save title when user finishes editing
    cotizationTitle.addEventListener('blur', function() {
        const titleText = this.textContent.trim();
        if (titleText === '') {
            this.textContent = 'Cotización';
        }
        localStorage.setItem('cotizationTitle', this.textContent);
        
        // Scroll back to start of text
        if (this.scrollLeft !== undefined) {
            this.scrollLeft = 0;
        }
    });
    
    // Prevent line breaks when pressing Enter
    cotizationTitle.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.blur();
        }
    });
});





