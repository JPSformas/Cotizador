document.addEventListener("DOMContentLoaded", () => {
    // Image storage and management
    let uploadedImages = []
    let selectedMainImageUrl = null

    // DOM Elements
    const uploadedImagesGrid = document.getElementById("uploadedImagesGrid")
    const imageUploadInput = document.getElementById("imageUploadInput")
    const uploadArea = document.querySelector(".upload-area")
    const saveChangesBtn = document.querySelector(".modal-footer .btn-primary")

    // Load saved images from sessionStorage
    function loadSavedImages() {
    const savedImages = sessionStorage.getItem("uploadedImages")
    if (savedImages) {
        uploadedImages = JSON.parse(savedImages)
        renderUploadedImages()
    }

    // Load selected main image
    const mainImage = sessionStorage.getItem("selectedMainImageUrl")
    if (mainImage) {
        selectedMainImageUrl = mainImage
        updateMainImageInTable(selectedMainImageUrl)
    }
    }

    // Save images to sessionStorage
    function saveImages() {
    sessionStorage.setItem("uploadedImages", JSON.stringify(uploadedImages))
    if (selectedMainImageUrl) {
        sessionStorage.setItem("selectedMainImageUrl", selectedMainImageUrl)
    }
    }

    // Render uploaded images in the grid
    function renderUploadedImages() {
    // Clear existing uploaded images (except the upload area)
    const uploadArea = uploadedImagesGrid.querySelector(".upload-area")
    uploadedImagesGrid.innerHTML = ""
    uploadedImagesGrid.appendChild(uploadArea)

    // Add each uploaded image
    uploadedImages.forEach((image, index) => {
        const imageItem = document.createElement("div")
        imageItem.className = "image-item"
        imageItem.setAttribute("data-image", image.url)
        imageItem.setAttribute("data-id", `uploaded-${index}`)

        // Check if this is the currently selected image
        if (image.url === selectedMainImageUrl) {
        imageItem.classList.add("selected-image")
        }

        const img = document.createElement("img")
        img.src = image.url
        img.alt = `Uploaded image ${index + 1}`

        // Add delete button
        const deleteBtn = document.createElement("button")
        deleteBtn.className = "image-delete-btn"
        deleteBtn.innerHTML = '<i class="far fa-trash-alt"></i>'

        imageItem.appendChild(img)
        imageItem.appendChild(deleteBtn)
        uploadedImagesGrid.appendChild(imageItem)

        // Add click event to select image
        imageItem.addEventListener("click", (e) => {
        if (e.target !== deleteBtn && !deleteBtn.contains(e.target)) {
            handleImageSelect(imageItem)
        }
        })

        // Add click event to delete button
        deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        handleImageDelete(imageItem)
        })
    })
    }

    // Handle image selection
    function handleImageSelect(imageItem) {
    const imageUrl = imageItem.getAttribute("data-image")
    if (imageUrl) {
        // Update the selected image
        selectedMainImageUrl = imageUrl

        // Update the selected class
        document.querySelectorAll(".image-item").forEach((item) => {
        item.classList.remove("selected-image")
        })
        imageItem.classList.add("selected-image")
    }
    }

    // Handle image deletion
    function handleImageDelete(imageItem) {
    const imageUrl = imageItem.getAttribute("data-image")

    // Remove from the array
    const index = uploadedImages.findIndex((img) => img.url === imageUrl)
    if (index !== -1) {
        uploadedImages.splice(index, 1)
        saveImages()
    }

    // If the deleted image was the selected main image, clear the selection
    if (imageUrl === selectedMainImageUrl) {
        selectedMainImageUrl = null
        sessionStorage.removeItem("selectedMainImageUrl")
    }

    // Remove the image from the DOM
    imageItem.remove()
    }

    // Update the main image in the table
    function updateMainImageInTable(imageUrl) {
    if (!imageUrl) return

    // Find the currently active row (you might need to adjust this selector)
    const activeRow = document.querySelector(".item-container.active") || document.querySelector(".item-container")

    if (activeRow) {
        const productImg = activeRow.querySelector(".product-img")
        if (productImg) {
        productImg.src = imageUrl
        }
    }
    }

    // Handle file upload for multiple files
    imageUploadInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
        handleFiles(Array.from(e.target.files))
        imageUploadInput.value = '';
    }
    })

    // Process multiple files
    function handleFiles(files) {
    // Create an array to store all new images
    const newImages = []

    // Process each file
    const totalFiles = files.length
    let processedFiles = 0

    files.forEach((file) => {
        if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (event) => {
            const imageUrl = event.target.result

            // Add to our temporary array
            newImages.push({ url: imageUrl })

            // Increment processed files counter
            processedFiles++

            // When all files are processed, update the main array and render
            if (processedFiles === totalFiles) {
            // Add all new images to the uploaded images array
            uploadedImages = [...uploadedImages, ...newImages]

            // Save all at once
            saveImages()

            // Render the updated list
            renderUploadedImages()
            }
        }
        reader.readAsDataURL(file)
        } else {
        // If not an image, increment counter but don't add to array
            processedFiles++
        }
    })
    }
    // Drag and drop functionality

    // Prevent default drag behaviors
    ;["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
        uploadArea.addEventListener(eventName, preventDefaults, false)
    })

    function preventDefaults(e) {
        e.preventDefault()
        e.stopPropagation()
    }
    // Highlight drop area when item is dragged over it
    ;["dragenter", "dragover"].forEach((eventName) => {
        uploadArea.addEventListener(eventName, highlight, false)
    })
    ;["dragleave", "drop"].forEach((eventName) => {
        uploadArea.addEventListener(eventName, unhighlight, false)
    })

    function highlight() {
        uploadArea.classList.add("highlight")
    }

    function unhighlight() {
        uploadArea.classList.remove("highlight")
    }

    // Handle dropped files
    uploadArea.addEventListener("drop", handleDrop, false)

    function handleDrop(e) {
    const dt = e.dataTransfer
    const files = dt.files

    if (files && files.length > 0) {
        handleFiles(Array.from(files))
    }
    }
    
    // Clipboard paste functionality
    document.addEventListener('paste', handlePaste, false);

    function handlePaste(e) {
        // Only handle paste events when the modal is open
        const modal = document.getElementById('modalAgregarProductosPIC');
        const isModalOpen = modal && modal.classList.contains('show');
        
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

    // Save changes button click handler
    saveChangesBtn.addEventListener("click", () => {
    // Update the main image in the table
    updateMainImageInTable(selectedMainImageUrl)

    // Close the modal
    const modalElement = document.getElementById("modalAgregarProductosPIC")
    const modal = bootstrap.Modal.getInstance(modalElement)
    modal.hide()
    })

    // Load saved images when page loads
    loadSavedImages()
})