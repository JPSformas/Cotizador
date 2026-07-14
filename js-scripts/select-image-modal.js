// JS basic demo
document.addEventListener('DOMContentLoaded', () => {

    // Original functionality
    document.getElementById('agregarCantidadDesktop').addEventListener('click', () => alert('Agregar nueva fila'));
    document.getElementById('saveItemCotization').addEventListener('click', () => alert('Guardado'));
    
    // Image storage and management
    let lastDeletedImage = null;
    let uploadedImages = [];
    let currentSelectedImageUrl = document.getElementById('selectedProductImage').src;
    
    // Ordered selection: up to 3 images, slot 1 = main image (used for PDF order later)
    let selectedImages = []; // Array of { url, element }, max 3, order 1 = main
    
    // Load saved images from localStorage
    function loadSavedImages() {
      const savedImages = sessionStorage.getItem('uploadedImages');
      if (savedImages) {
        uploadedImages = JSON.parse(savedImages);
        renderUploadedImages();
      }
    }
    
    // Save images to localStorage
    function saveImages() {
      sessionStorage.setItem('uploadedImages', JSON.stringify(uploadedImages));
    }
    
    // Handle files (used by both file upload and clipboard paste)
    function handleFiles(files) {
      if (files && files.length > 0) {
        const newImages = [];
        const totalFiles = files.length;
        let processedFiles = 0;
        
        Array.from(files).forEach(file => {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(event) {
              const imageUrl = event.target.result;
              newImages.push({ url: imageUrl });
              processedFiles++;
              
              if (processedFiles === totalFiles) {
                uploadedImages = [...uploadedImages, ...newImages];
                saveImages();
                renderUploadedImages();
              }
            };
            reader.readAsDataURL(file);
          } else {
            processedFiles++;
          }
        });
      }
    }
    
    // Clipboard paste functionality
    document.addEventListener('paste', handlePaste, false);

    function handlePaste(e) {
        // Only handle paste events when the modal is open
        const modal = document.getElementById('imageModal');
        const isModalOpen = modal && modal.style.display === 'flex';
        
        if (!isModalOpen) return;
        
        const clipboardData = e.clipboardData || window.clipboardData;
        const items = clipboardData.items;
        
        if (!items) return;
        
        const imageFiles = [];
        
        // Check all clipboard items for images
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // Check if the item is an image
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    imageFiles.push(file);
                }
            }
        }
        
        // If we found images, process them
        if (imageFiles.length > 0) {
            e.preventDefault(); // Prevent default paste behavior
            handleFiles(imageFiles);
        }
    }
    
    // Render uploaded images in the grid
    function renderUploadedImages() {
      const uploadedImagesGrid = document.getElementById('uploadedImagesGrid');
      
      // Clear existing uploaded images (except the upload area)
      const uploadArea = uploadedImagesGrid.querySelector('.upload-area');
      uploadedImagesGrid.innerHTML = '';
      uploadedImagesGrid.appendChild(uploadArea);
      
      // Add each uploaded image
      uploadedImages.forEach((image, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.setAttribute('data-image', image.url);
        imageItem.setAttribute('data-type', 'uploaded');
        imageItem.setAttribute('data-id', `uploaded-${index}`);
        
        const img = document.createElement('img');
        img.src = image.url;
        img.alt = `Uploaded image ${index + 1}`;
        
        // Only add delete button for uploaded images
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'image-delete-btn';
        deleteBtn.innerHTML = '<i class="far fa-trash-alt"></i>';
        
        imageItem.appendChild(img);
        imageItem.appendChild(deleteBtn);
        uploadedImagesGrid.appendChild(imageItem);
        
        // Add click event to select image
        imageItem.addEventListener('click', (e) => {
          // Don't trigger selection if clicking delete button or badge
          if (e.target !== deleteBtn && 
              !deleteBtn.contains(e.target) && 
              !e.target.classList.contains('selection-number-badge')) {
            handleImageSelect(imageItem);
          }
        });
        
        // Add click event to delete button
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleImageDelete(imageItem);
        });
      });
    }
    
    // JS for image modal
    const selectImageBtn = document.getElementById('selectImageBtn');
    const imageModal = document.getElementById('imageModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const selectedProductImage = document.getElementById('selectedProductImage');
    const imageUploadInput = document.getElementById('imageUploadInput');
    
    // Load saved images when page loads
    loadSavedImages();
    
    // Find image item in modal that matches a URL (for pre-filling selection)
    function findImageItemByUrl(url) {
      if (!url) return null;
      const modal = document.getElementById('imageModal');
      if (!modal) return null;
      const items = modal.querySelectorAll('.image-item[data-image]');
      const currentPart = url.split('/').pop();
      for (const item of items) {
        const itemUrl = item.getAttribute('data-image');
        if (!itemUrl) continue;
        const itemPart = itemUrl.split('/').pop();
        if (currentPart === itemPart || url.includes(itemUrl) || itemUrl.includes(url)) return item;
      }
      return null;
    }
    
    // Open modal
    selectImageBtn.addEventListener('click', () => {
      imageModal.style.display = 'flex';
      selectedImages = [];
      const container = selectedProductImage.closest('[data-product-images]') || selectedProductImage.parentElement;
      const saved = container && container.dataset.selectedImageUrls;
      if (saved) {
        try {
          const urls = JSON.parse(saved);
          urls.forEach(url => {
            const item = findImageItemByUrl(url);
            if (item && selectedImages.length < 3) selectedImages.push({ url: item.getAttribute('data-image'), element: item });
          });
        } catch (_) { /* ignore */ }
      }
      if (selectedImages.length === 0) {
        const mainItem = findImageItemByUrl(selectedProductImage.src);
        if (mainItem) selectedImages.push({ url: mainItem.getAttribute('data-image'), element: mainItem });
      }
      updateMultiSelectDisplay();
    });
    
    // Apply selected images (slot 1 = main; all 3 stored for PDF order)
    function applySelectedImages() {
      if (selectedImages.length > 0) {
        selectedProductImage.src = selectedImages[0].url;
        currentSelectedImageUrl = selectedImages[0].url;
        const urls = selectedImages.map(img => img.url);
        const container = selectedProductImage.closest('[data-product-images]') || selectedProductImage.parentElement;
        if (container) container.dataset.selectedImageUrls = JSON.stringify(urls);
      }
    }
    
    // Close modal
    closeModalBtn.addEventListener('click', () => {
      applySelectedImages();
      imageModal.style.display = 'none';
      selectedImages = [];
    });
    
    // Close modal when clicking outside
    imageModal.addEventListener('click', (e) => {
      if (e.target === imageModal) {
        applySelectedImages();
        imageModal.style.display = 'none';
        selectedImages = [];
      }
    });
    
    // Handle image selection: click to add (up to 3), click again to remove. Order 1 = main.
    function handleImageSelect(imageItem) {
      const imageUrl = imageItem.getAttribute('data-image');
      if (!imageUrl) return;
      handleToggleSelection(imageItem, imageUrl);
    }
    
    // Toggle selection: click to add (up to 3), click again to remove. Order 1 = main image.
    function handleToggleSelection(imageItem, imageUrl) {
      const existingIndex = selectedImages.findIndex(img => img.url === imageUrl);
      
      if (existingIndex !== -1) {
        selectedImages.splice(existingIndex, 1);
      } else {
        if (selectedImages.length >= 3) {
          alert('Solo puedes seleccionar hasta 3 imágenes');
          return;
        }
        selectedImages.push({ url: imageUrl, element: imageItem });
      }
      updateMultiSelectDisplay();
    }
    
    // Add selection number badge to image
    function addSelectionBadge(imageItem, number) {
      // Remove existing badge if any
      const existingBadge = imageItem.querySelector('.selection-number-badge');
      if (existingBadge) existingBadge.remove();
      
      const badge = document.createElement('div');
      badge.className = 'selection-number-badge';
      badge.textContent = number;
      imageItem.appendChild(badge);
    }
    
    // Update multi-select display (reorder badges if needed)
    function updateMultiSelectDisplay() {
      // Remove all badges first
      document.querySelectorAll('.selection-number-badge').forEach(badge => badge.remove());
      document.querySelectorAll('.image-item').forEach(item => {
        item.classList.remove('multi-selected');
        item.removeAttribute('data-selection-order');
      });
      
      // Re-add badges in order
      selectedImages.forEach((img, index) => {
        const imageItem = img.element;
        imageItem.classList.add('multi-selected');
        imageItem.setAttribute('data-selection-order', index + 1);
        addSelectionBadge(imageItem, index + 1);
      });
    }
    
    // Add click events to all image items for selection (product and zakeke images)
    document.querySelectorAll('#productImagesGrid .image-item, #zakekeImagesGrid .image-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Only select if not clicking the delete button or badge
        if (!e.target.classList.contains('image-delete-btn') && 
            !e.target.closest('.image-delete-btn') &&
            !e.target.classList.contains('selection-number-badge')) {
          handleImageSelect(item);
        }
      });
    });
    
    // Handle image deletion (only for uploaded images)
    function handleImageDelete(imageItem) {
      const imageType = imageItem.getAttribute('data-type');
      
      // Only allow deletion of uploaded images
      if (imageType === 'uploaded') {
        const imageId = imageItem.getAttribute('data-id');
        const imageUrl = imageItem.getAttribute('data-image');
        
        // Store the deleted image info for potential undo
        lastDeletedImage = {
          id: imageId,
          type: imageType,
          url: imageUrl,
          element: imageItem.cloneNode(true)
        };
        
        // Remove from uploaded images array
        const index = uploadedImages.findIndex(img => img.url === imageUrl);
        if (index !== -1) {
          uploadedImages.splice(index, 1);
          saveImages();
        }
        
        const selectedIndex = selectedImages.findIndex(img => img.url === imageUrl);
        if (selectedIndex !== -1) {
          selectedImages.splice(selectedIndex, 1);
          updateMultiSelectDisplay();
        }
        
        // Remove the image from the DOM
        imageItem.remove();
      }
    }
    
    // Handle file upload for multiple files
    imageUploadInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        // Reset the file input
        imageUploadInput.value = '';
      }
    });
    
    // Drag and drop functionality
    const uploadArea = document.querySelector('.upload-area');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
      uploadArea.classList.add('highlight');
    }

    function unhighlight() {
      uploadArea.classList.remove('highlight');
    }

    // Handle dropped files (multiple)
    uploadArea.addEventListener('drop', handleDrop, false);
    function handleDrop(e) {
      const dt = e.dataTransfer;
      const files = dt.files;
      
      if (files && files.length > 0) {
        handleFiles(files);
      }
    }
});