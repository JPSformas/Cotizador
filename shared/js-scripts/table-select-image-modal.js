// Image modal functionality for detalle-cotizacion.html
document.addEventListener('DOMContentLoaded', () => {
    
    // Image storage and management
    let lastDeletedImage = null;
    let uploadedImages = [];
    let currentSelectedImageUrl = null;
    let currentProductRow = null; // Track which product row is being edited
    let currentUploadArea = null; // Track the current upload area element
    
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
    function handlePaste(e) {
        // Only handle paste events when the image modal is open
        const modal = document.getElementById('imageModal');
        if (!modal || modal.style.display !== 'flex') return;
        
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
      if (!uploadedImagesGrid) return;
      
      // Find the current upload area (it might be in the modal)
      const uploadAreaElement = uploadedImagesGrid.querySelector('.upload-area');
      if (!uploadAreaElement) return;
      
      // Clear existing uploaded images (except the upload area)
      const uploadAreaClone = uploadAreaElement.cloneNode(true);
      uploadedImagesGrid.innerHTML = '';
      uploadedImagesGrid.appendChild(uploadAreaClone);
      
      // Re-setup drag and drop after rendering
      currentUploadArea = setupDragAndDrop();
      
      // Re-setup file input handler after rendering
      setupFileInputHandler();
      
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
    const imageModal = document.getElementById('imageModal');
    if (!imageModal) {
      console.warn('Image modal not found');
      return;
    }
    
    // Get elements scoped to the image modal
    const closeModalBtn = imageModal.querySelector('#closeModalBtn');
    const uploadedImagesGrid = imageModal.querySelector('#uploadedImagesGrid');
    const imageUploadInput = imageModal.querySelector('#imageUploadInput');
    const uploadArea = imageModal.querySelector('.upload-area');
    
    if (!closeModalBtn || !uploadedImagesGrid || !imageUploadInput || !uploadArea) {
      console.warn('Image modal elements not found', {
        closeModalBtn: !!closeModalBtn,
        uploadedImagesGrid: !!uploadedImagesGrid,
        imageUploadInput: !!imageUploadInput,
        uploadArea: !!uploadArea
      });
      return;
    }
    
    // Load saved images when page loads
    loadSavedImages();
    
    // Attach paste handler after modal is defined
    document.addEventListener('paste', handlePaste, false);
    
    // Setup file input handler using event delegation on the modal
    function setupFileInputHandler() {
      // Use event delegation on the modal to catch file input changes
      // This way it works even when the upload area is recreated
      imageModal.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'imageUploadInput' && e.target.type === 'file') {
          if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
            // Reset the file input
            e.target.value = '';
          }
        }
      }, true); // Use capture phase to catch early
    }
    
    // Find image item element in modal that matches a URL (for pre-filling selection)
    function findImageItemByUrl(url) {
      if (!url) return null;
      const items = imageModal.querySelectorAll('.image-item[data-image]');
      const currentPart = url.split('/').pop();
      for (const item of items) {
        const itemUrl = item.getAttribute('data-image');
        if (!itemUrl) continue;
        const itemPart = itemUrl.split('/').pop();
        if (currentPart === itemPart || url.includes(itemUrl) || itemUrl.includes(url)) return item;
      }
      return null;
    }
    
    // Open modal when clicking on product images in the table
    function openImageModal(productImg, productRow) {
      currentProductRow = productRow;
      currentSelectedImageUrl = productImg.src;
      
      imageModal.style.display = 'flex';
      selectedImages = [];
      // Restore saved 3-image selection from row if present (saved on modal close)
      const saved = productRow.dataset.selectedImageUrls;
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
        const mainItem = findImageItemByUrl(productImg.src);
        if (mainItem) selectedImages.push({ url: mainItem.getAttribute('data-image'), element: mainItem });
      }
      updateMultiSelectDisplay();
      
      // Re-setup drag and drop when modal opens (in case upload area was recreated)
      currentUploadArea = setupDragAndDrop();
      
      // Re-setup file input handler
      setupFileInputHandler();
    }
    
    // Function to setup click handlers for product images
    function setupProductImageHandlers() {
      document.querySelectorAll('.product-image img.product-img').forEach(img => {
        // Make the image container clickable
        const productImageContainer = img.closest('.product-image');
        if (productImageContainer && !productImageContainer.classList.contains('clickable-image')) {
          productImageContainer.style.cursor = 'pointer';
          productImageContainer.classList.add('clickable-image');
          
          // Add hover icon if it doesn't exist
          if (!productImageContainer.querySelector('.image-hover-icon')) {
            const hoverIcon = document.createElement('i');
            hoverIcon.className = 'fas fa-image image-hover-icon';
            productImageContainer.appendChild(hoverIcon);
          }
          
          productImageContainer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const productRow = img.closest('tr');
            openImageModal(img, productRow);
          });
        }
      });
    }
    
    // Initial setup
    setupProductImageHandlers();
    
    // Use MutationObserver to handle dynamically added product rows
    const tableObserver = new MutationObserver((mutations) => {
      setupProductImageHandlers();
    });
    
    const tableBody = document.querySelector('table tbody');
    if (tableBody) {
      tableObserver.observe(tableBody, {
        childList: true,
        subtree: true
      });
    }
    
    // Apply selected images (slot 1 = main; all 3 stored for PDF order)
    function applySelectedImages() {
      if (!currentProductRow) return;
      
      const productImg = currentProductRow.querySelector('.product-img');
      if (!productImg) return;
      
      if (selectedImages.length > 0) {
        productImg.src = selectedImages[0].url;
        currentSelectedImageUrl = selectedImages[0].url;
        const urls = selectedImages.map(img => img.url);
        currentProductRow.dataset.selectedImageUrls = JSON.stringify(urls);
      }
    }
    
    // Close modal
    closeModalBtn.addEventListener('click', () => {
      applySelectedImages();
      imageModal.style.display = 'none';
      selectedImages = [];
      currentProductRow = null;
    });
    
    // Close modal when clicking outside
    imageModal.addEventListener('click', (e) => {
      if (e.target === imageModal) {
        applySelectedImages();
        imageModal.style.display = 'none';
        selectedImages = [];
        currentProductRow = null;
      }
    });
    
    // Handle image selection: click to add (up to 3), click again to remove. Order = 1,2,3 (1 = main).
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
    
    // File input handler is now set up via setupFileInputHandler() function
    
    // Drag and drop functionality - setup when modal opens
    function setupDragAndDrop() {
      // Find the current upload area in the modal (it might have been recreated)
      const uploadAreaElement = imageModal.querySelector('.upload-area');
      if (!uploadAreaElement) return null;
      
      // Remove existing listeners to avoid duplicates by cloning
      const newUploadArea = uploadAreaElement.cloneNode(true);
      uploadAreaElement.parentNode.replaceChild(newUploadArea, uploadAreaElement);
      
      // Prevent default drag behaviors
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        newUploadArea.addEventListener(eventName, preventDefaults, false);
      });

      function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Highlight drop area when item is dragged over it
      ['dragenter', 'dragover'].forEach(eventName => {
        newUploadArea.addEventListener(eventName, highlight, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        newUploadArea.addEventListener(eventName, unhighlight, false);
      });

      function highlight() {
        newUploadArea.classList.add('highlight');
      }

      function unhighlight() {
        newUploadArea.classList.remove('highlight');
      }

      // Handle dropped files (multiple)
      newUploadArea.addEventListener('drop', handleDrop, false);
      function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files && files.length > 0) {
          handleFiles(files);
        }
      }
      
      return newUploadArea;
    }
    
    // Setup drag and drop initially
    currentUploadArea = setupDragAndDrop();
    
    // Setup file input handler initially
    setupFileInputHandler();
});

