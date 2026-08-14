// Financial formatting utilities
class FinancialFormatter {
  constructor() {
    this.locale = 'es-AR'; // Argentine locale for comma as decimal separator
    this.decimalPlaces = 2;
  }

  // Format number for display (e.g., 1234.56 -> "1.234,56")
  formatForDisplay(value) {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return '';
    }

    return numValue.toLocaleString(this.locale, {
      minimumFractionDigits: this.decimalPlaces,
      maximumFractionDigits: this.decimalPlaces
    });
  }

  // Parse formatted string back to number (e.g., "1.234,56" -> 1234.56)
  parseFormattedValue(formattedValue) {
    if (!formattedValue || formattedValue === '') {
      return null;
    }

    // Remove all non-numeric characters except comma and dot
    const cleanValue = formattedValue.replace(/[^\d.,]/g, '');
    
    // Handle different decimal separators
    if (cleanValue.includes(',') && cleanValue.includes('.')) {
      // Format: 1.234,56 (comma is decimal separator)
      return parseFloat(cleanValue.replace(/\./g, '').replace(',', '.'));
    } else if (cleanValue.includes(',')) {
      // Check if comma is decimal separator or thousands separator
      const parts = cleanValue.split(',');
      if (parts[parts.length - 1].length <= 2) {
        // Comma is decimal separator (e.g., "1234,56")
        return parseFloat(cleanValue.replace(',', '.'));
      } else {
        // Comma is thousands separator (e.g., "1,234")
        return parseFloat(cleanValue.replace(/,/g, ''));
      }
    } else {
      // No comma, treat as regular number
      return parseFloat(cleanValue);
    }
  }

  // Format input value as user types
  formatInputValue(input) {
    const cursorPosition = input.selectionStart;
    const value = input.value;
    const parsedValue = this.parseFormattedValue(value);
    
    if (parsedValue !== null) {
      const formattedValue = this.formatForDisplay(parsedValue);
      input.value = formattedValue;
      
      // Restore cursor position
      const newCursorPosition = this.calculateNewCursorPosition(value, formattedValue, cursorPosition);
      input.setSelectionRange(newCursorPosition, newCursorPosition);
    }
  }

  // Calculate new cursor position after formatting
  calculateNewCursorPosition(oldValue, newValue, oldPosition) {
    // Simple approach: try to maintain relative position
    const oldLength = oldValue.length;
    const newLength = newValue.length;
    
    if (oldLength === 0) return newLength;
    
    const ratio = oldPosition / oldLength;
    return Math.round(ratio * newLength);
  }
}

// Initialize formatter
const financialFormatter = new FinancialFormatter();

// Auto-format inputs with financial formatting
document.addEventListener('DOMContentLoaded', function() {
  // Find all inputs that should have financial formatting
  const financialInputs = document.querySelectorAll('input[data-financial-format="true"]');
  
  financialInputs.forEach(input => {
    // Format on blur (when user leaves the field)
    input.addEventListener('blur', function() {
      financialFormatter.formatInputValue(this);
    });

    // Format on input (as user types)
    input.addEventListener('input', function() {
      // Only format if the value is complete (not while typing)
      if (this.value.length > 0 && !this.value.includes(',')) {
        // Don't format while user is typing numbers
        return;
      }
    });

    // Format on focus (when user enters the field)
    input.addEventListener('focus', function() {
      // Optional: you can add special behavior when focusing
    });
  });
});

// Function to format a specific input
function formatFinancialInput(inputElement) {
  financialFormatter.formatInputValue(inputElement);
}

// Function to get numeric value from formatted input
function getNumericValue(inputElement) {
  return financialFormatter.parseFormattedValue(inputElement.value);
}

// Function to set formatted value
function setFormattedValue(inputElement, numericValue) {
  inputElement.value = financialFormatter.formatForDisplay(numericValue);
}

// Export for use in other scripts
window.FinancialFormatter = FinancialFormatter;
window.financialFormatter = financialFormatter;
