// Handle title image upload and color picker
document.addEventListener('DOMContentLoaded', function() {
    const titleImageInput = document.getElementById('titleImageInput');
    const titleColorPicker = document.getElementById('titleColorPicker');
    const colorSwatch = document.getElementById('colorSwatch');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageBtn = document.getElementById('removeImageBtn');
    
    // Check if elements exist
    if (!titleImageInput || !titleColorPicker || !colorSwatch) {
        return;
    }
    
    // Function to show image preview
    function showImagePreview(imageSrc) {
        if (imagePreview && imagePreviewContainer) {
            imagePreview.src = imageSrc;
            imagePreviewContainer.style.display = 'block';
        }
    }
    
    // Function to hide image preview
    function hideImagePreview() {
        if (imagePreviewContainer) {
            imagePreviewContainer.style.display = 'none';
        }
        if (titleImageInput) {
            titleImageInput.value = '';
        }
        localStorage.removeItem('cotizationTitleImage');
    }
    
    // Load saved color from localStorage
    const savedColor = localStorage.getItem('cotizationTitleColor');
    if (savedColor) {
        titleColorPicker.value = savedColor;
        colorSwatch.style.backgroundColor = savedColor;
    }
    
    // Load saved image if exists
    const savedImage = localStorage.getItem('cotizationTitleImage');
    if (savedImage && imagePreview) {
        showImagePreview(savedImage);
    }
    
    // Handle color picker change
    titleColorPicker.addEventListener('input', function() {
        const selectedColor = this.value;
        colorSwatch.style.backgroundColor = selectedColor;
        localStorage.setItem('cotizationTitleColor', selectedColor);
        
        // Apply color to title (optional - you can remove this if you don't want to change title color)
        const cotizationTitle = document.getElementById('cotizationTitle');
        if (cotizationTitle) {
            cotizationTitle.style.color = selectedColor;
        }
    });
    
    // Handle image file selection
    titleImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Por favor, selecciona un archivo de imagen válido.');
                this.value = '';
                return;
            }
            
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('El archivo es demasiado grande. Por favor, selecciona una imagen menor a 5MB.');
                this.value = '';
                return;
            }
            
            // Create preview or handle the file
            const reader = new FileReader();
            reader.onload = function(event) {
                // Store image data in localStorage (base64)
                localStorage.setItem('cotizationTitleImage', event.target.result);
                
                // Show preview
                showImagePreview(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Handle remove image button
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            hideImagePreview();
        });
    }
});

