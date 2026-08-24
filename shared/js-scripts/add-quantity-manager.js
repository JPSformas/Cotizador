/**
 * Quantity Manager for Product Pricing Modal
 * Manages the quantity-based pricing functionality with add/delete operations
 */

class QuantityManager {
    constructor() {
        this.maxCards = 5;
        this.cardCounter = 0;
        this.quantitiesContainer = null;
        this.addButton = null;
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        // Pricing mode toggle
        const singlePriceMode = document.getElementById('singlePriceMode');
        const quantityPriceMode = document.getElementById('quantityPriceMode');
        const singlePriceContainer = document.getElementById('singlePriceContainer');
        const quantityPriceContainer = document.getElementById('quantityPriceContainer');

        if (singlePriceMode && quantityPriceMode) {
            singlePriceMode.addEventListener('change', () => this.togglePricingMode('single'));
            quantityPriceMode.addEventListener('change', () => this.togglePricingMode('quantity'));
        }

        // Add quantity button
        this.addButton = document.getElementById('addQuantityBtn');
        if (this.addButton) {
            this.addButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.addQuantityCard();
            });
        }

        // Initialize quantities container
        this.quantitiesContainer = document.getElementById('quantitiesContainer');
        if (this.quantitiesContainer) {
            this.initializeFirstCard();
        }
    }

    togglePricingMode(mode) {
        const singlePriceContainer = document.getElementById('singlePriceContainer');
        const quantityPriceContainer = document.getElementById('quantityPriceContainer');
        
        if (mode === 'single') {
            this.hideContainer(quantityPriceContainer, () => {
                this.showContainer(singlePriceContainer);
            });
        } else {
            this.hideContainer(singlePriceContainer, () => {
                this.showContainer(quantityPriceContainer);
            });
        }
    }

    hideContainer(container, callback) {
        if (container) {
            container.classList.add('hidden');
            setTimeout(() => {
                container.style.display = 'none';
                if (callback) callback();
            }, 200);
        } else if (callback) {
            callback();
        }
    }

    showContainer(container) {
        if (container) {
            container.style.display = 'block';
            container.classList.remove('hidden');
            container.classList.add('showing');
            setTimeout(() => {
                container.classList.remove('showing');
            }, 400);
        }
    }

    initializeFirstCard() {
        const firstCard = document.getElementById('quantity-card-0');
        if (firstCard) {
            this.cardCounter = 0;
            this.updateAddButtonState();
            this.updateDeleteButtons();
        }
    }

    addQuantityCard() {
        if (this.cardCounter >= this.maxCards - 1) {
            return; // Button should be disabled, but just in case
        }

        this.cardCounter++;
        const newCard = this.createQuantityCard(this.cardCounter);
        
        if (this.quantitiesContainer && newCard) {
            this.quantitiesContainer.appendChild(newCard);
            this.updateAddButtonState();
            this.updateDeleteButtons();
            this.animateCardIn(newCard);
        }
    }

    createQuantityCard(cardId) {
        const cardTemplate = `
            <div class="quantity-card" id="quantity-card-${cardId}">
                <div class="quantity-card-body">
                    <div class="quantity-card-fields">
                        <div class="quantity-field">
                            <label class="form-label" for="ProductQuantity_${cardId}">Cantidad</label>
                            <input type="number" inputmode="numeric" class="form-control" id="ProductQuantity_${cardId}" name="ProductQuantity_${cardId}" min="1">
                        </div>
                        <div class="PVPCosto-field">
                            <label class="form-label" for="PVPCosto_${cardId}">PVP/Costo</label>
                            <div class="input-group">
                                <span class="input-group-text">$</span>
                                <input type="number" step="any" inputmode="numeric" class="form-control" id="PVPCosto_${cardId}" name="PVPCosto_${cardId}" min="0">
                            </div>
                        </div>
                    </div>
                    <div class="quantity-card-actions">
                        <button type="button" class="delete-btn" onclick="quantityManager.deleteQuantityCard(${cardId})" title="Eliminar cantidad">
                            <i class="far fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cardTemplate;
        return tempDiv.firstElementChild;
    }

    deleteQuantityCard(cardId) {
        const card = document.getElementById(`quantity-card-${cardId}`);
        if (!card) return;

        // Don't allow deleting if it's the only card remaining
        if (this.cardCounter === 0) return;

        this.animateCardOut(card, () => {
            card.remove();
            this.cardCounter--;
            this.updateAddButtonState();
            this.updateDeleteButtons();
        });
    }

    updateAddButtonState() {
        if (this.addButton) {
            const isMaxReached = this.cardCounter >= this.maxCards - 1;
            
            if (isMaxReached) {
                this.addButton.style.display = 'none';
            } else {
                this.addButton.style.display = 'block';
                this.addButton.innerHTML = '<i class="fas fa-plus"></i>Agregar cantidad';
            }
        }
    }

    updateDeleteButtons() {
        const deleteButtons = document.querySelectorAll('.quantity-card .delete-btn');
        const shouldShowDelete = this.cardCounter > 0;
        
        deleteButtons.forEach(button => {
            button.style.display = shouldShowDelete ? 'flex' : 'none';
        });
    }

    animateCardIn(card) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        requestAnimationFrame(() => {
            card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        });
    }

    animateCardOut(card, callback) {
        card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        card.style.opacity = '0';
        card.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
            if (callback) callback();
        }, 300);
    }


    // Public method to get all quantity data
    getQuantityData() {
        const quantities = [];
        const cards = document.querySelectorAll('.quantity-card');
        
        cards.forEach((card, index) => {
            const quantityInput = card.querySelector('input[type="number"][id^="ProductQuantity"]');
            const priceInput = card.querySelector('input[type="number"][id^="PVPCosto"]');
            
            if (quantityInput && priceInput) {
                quantities.push({
                    id: card.id,
                    quantity: parseInt(quantityInput.value) || 0,
                    price: parseFloat(priceInput.value) || 0
                });
            }
        });
        
        return quantities;
    }

    // Public method to validate all inputs
    validateInputs() {
        const cards = document.querySelectorAll('.quantity-card');
        let isValid = true;
        const errors = [];
        
        cards.forEach((card, index) => {
            const quantityInput = card.querySelector('input[type="number"][id^="ProductQuantity"]');
            const priceInput = card.querySelector('input[type="number"][id^="PVPCosto"]');
            
            if (quantityInput && priceInput) {
                const quantity = parseInt(quantityInput.value);
                const price = parseFloat(priceInput.value);
                
                if (!quantity || quantity <= 0) {
                    isValid = false;
                    errors.push(`Cantidad ${index + 1}: Debe ser mayor a 0`);
                    quantityInput.classList.add('is-invalid');
                } else {
                    quantityInput.classList.remove('is-invalid');
                }
                
                if (!price || price < 0) {
                    isValid = false;
                    errors.push(`Precio ${index + 1}: Debe ser mayor o igual a 0`);
                    priceInput.classList.add('is-invalid');
                } else {
                    priceInput.classList.remove('is-invalid');
                }
            }
        });
        
        return { isValid, errors };
    }

    // Public method to reset to default state
    reset() {
        // Remove all cards except the first one
        const cards = document.querySelectorAll('.quantity-card');
        cards.forEach((card, index) => {
            if (index > 0) {
                card.remove();
            }
        });
        
        this.cardCounter = 0;
        this.updateAddButtonState();
        this.updateDeleteButtons();
        
        // Clear first card inputs
        const firstCard = document.getElementById('quantity-card-0');
        if (firstCard) {
            const quantityInput = firstCard.querySelector('input[type="number"][id^="ProductQuantity"]');
            const priceInput = firstCard.querySelector('input[type="number"][id^="PVPCosto"]');
            
            if (quantityInput) quantityInput.value = '';
            if (priceInput) priceInput.value = '';
        }
    }
}

// Global instance
let quantityManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    quantityManager = new QuantityManager();
});

// Global function for backward compatibility
function addQuantity() {
    if (quantityManager) {
        quantityManager.addQuantityCard();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuantityManager;
}
