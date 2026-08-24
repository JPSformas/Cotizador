/**
 * Reusable Autocomplete Component for Razón Social
 * 
 * Handles large datasets (7000+ clients) efficiently with:
 * - Debouncing to reduce API calls
 * - Result limiting (max 50 displayed)
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Smart filtering and sorting
 * - Loading states
 * - Create new client option
 * 
 * PRODUCTION INTEGRATION:
 * 1. Set CONFIG.API_ENDPOINT to your API endpoint
 * 2. Replace loadClientData() with actual API call
 * 3. Replace performSearch() setTimeout with actual API call
 * 4. Update createNewClient() with API call to create new client
 * 
 * API Expected Response Format:
 * [
 *   {
 *     "codigo": "0001",
 *     "nombre": "FINNEGANS S.A.",
 *     "descripcion": "",
 *     "activo": true
 *   },
 *   ...
 * ]
 * 
 * Usage:
 * - Automatically initializes on page load
 * - Use window.setRazonSocialData(data) to set data programmatically
 * - Use window.getRazonSocialValue(fieldId) to get selected value
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        MIN_SEARCH_LENGTH: 2,        // Minimum characters before searching
        DEBOUNCE_DELAY: 300,          // Delay in ms before filtering
        MAX_RESULTS: 100,             // Maximum results to display initially
        API_ENDPOINT: null,           // Set to API endpoint when available (e.g., '/api/clients/search')
        ENABLE_CREATE_NEW: true       // Allow creating new entries
    };
    
    // Track displayed results count for load more functionality
    let displayedResultsCount = {};

    // Client data storage (will be loaded from API or static data)
    let clientData = [];
    let filteredData = [];
    let filteredDataByField = {}; // Store filtered data per field for load more
    
    // Debounce timer
    let debounceTimer = null;
    
    // Active instance tracking
    let activeInstance = null;
    let highlightedIndex = -1;

    /**
     * Initialize autocomplete for a specific field
     */
    function initAutocomplete(fieldId) {
        const wrapper = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (!wrapper) return;

        const input = document.getElementById(fieldId);
        const dropdown = document.getElementById(`${fieldId}Dropdown`);
        const results = document.getElementById(`${fieldId}Results`);
        const loading = document.getElementById(`${fieldId}Loading`);
        const noResults = document.getElementById(`${fieldId}NoResults`);
        const footer = document.getElementById(`${fieldId}Footer`);
        const resultsCount = document.getElementById(`${fieldId}ResultsCount`);
        const totalCount = document.getElementById(`${fieldId}TotalCount`);
        const createBtn = document.getElementById(`${fieldId}CreateBtn`);
        const hiddenIdInput = document.getElementById(`${fieldId}Id`);
        
        // Initialize displayed results count
        displayedResultsCount[fieldId] = 0;

        if (!input || !dropdown || !results) return;

        // Load client data (mock data for now - replace with API call)
        if (clientData.length === 0) {
            loadClientData();
        }

        // Event: Input typing
        input.addEventListener('input', function() {
            clearDebounce();
            const query = this.value.trim();
            
            if (query.length < CONFIG.MIN_SEARCH_LENGTH) {
                hideDropdown();
                return;
            }

            debounceTimer = setTimeout(() => {
                performSearch(fieldId, query);
            }, CONFIG.DEBOUNCE_DELAY);
        });

        // Event: Focus - Open dropdown when clicking the field
        input.addEventListener('focus', function() {
            const query = this.value.trim();
            if (query.length >= CONFIG.MIN_SEARCH_LENGTH) {
                performSearch(fieldId, query);
            } else {
                // Show all clients when field is clicked/focused
                showAllClients(fieldId);
            }
        });
        
        // Event: Click on input - Open dropdown
        input.addEventListener('click', function(e) {
            e.stopPropagation();
            const query = this.value.trim();
            if (dropdown.style.display === 'none') {
                if (query.length >= CONFIG.MIN_SEARCH_LENGTH) {
                    performSearch(fieldId, query);
                } else {
                    showAllClients(fieldId);
                }
            }
        });

        // Event: Keyboard navigation
        input.addEventListener('keydown', function(e) {
            handleKeyboardNavigation(e, fieldId);
        });

        // Event: Click outside to close
        document.addEventListener('click', function(e) {
            if (!wrapper.contains(e.target)) {
                hideDropdown();
            }
        });

        // Event: Create new button (icon next to arrow)
        if (createBtn) {
            createBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                createNewClient(fieldId, input.value.trim());
            });
        }
        
        // Load more button will be created dynamically in renderResults
    }

    /**
     * Load client data (replace with actual API call)
     */
    function loadClientData() {
        // TODO: Replace with actual API call
        // Example API call:
        // fetch(CONFIG.API_ENDPOINT)
        //     .then(response => response.json())
        //     .then(data => {
        //         // Filter only active clients
        //         clientData = Array.isArray(data) ? data.filter(client => client.activo) : [];
        //     })
        //     .catch(error => {
        //         console.error('Error loading clients:', error);
        //     });

        // Mock data structure matching API format (remove when API is ready)
        clientData = [
            { codigo: "0001", nombre: "FINNEGANS S.A.", descripcion: "", activo: true },
            { codigo: "0002", nombre: "SOUTEX S.A.", descripcion: "", activo: true },
            { codigo: "0003", nombre: "SBATELLA JUAN PEDRO S.A.", descripcion: "", activo: true },
            { codigo: "0004", nombre: "MARTIN RODRIGUEZ S.A.", descripcion: "", activo: true },
            { codigo: "0005", nombre: "RIVERA & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0006", nombre: "JUAN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0007", nombre: "RODRIGUEZ & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0008", nombre: "RIVERA & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0009", nombre: "JUAN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0010", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0011", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0012", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0013", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0014", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0015", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0016", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0017", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0018", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0019", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0020", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0021", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0022", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0023", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0024", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0025", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0026", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0027", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0028", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0029", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0030", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0031", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0032", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0033", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0034", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0035", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0036", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0037", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0038", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0039", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0040", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0041", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0042", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0043", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0044", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0045", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0046", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0047", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0048", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0049", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0050", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0051", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0052", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0053", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0054", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0055", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0056", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0057", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0058", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0059", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0060", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0061", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0062", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0063", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0064", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0065", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0066", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0067", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0068", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0069", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0070", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0071", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0072", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0073", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0074", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0075", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0076", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0077", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0078", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0079", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0080", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0081", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0082", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0083", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0084", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0085", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0086", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0087", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0088", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0089", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0090", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0091", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0092", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0093", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0094", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0095", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0096", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0097", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0098", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0099", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0100", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0101", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0102", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0103", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0104", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0105", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0106", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0107", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0108", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0109", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0110", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0111", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
            { codigo: "0112", nombre: "MARTIN & CIA S.A.", descripcion: "", activo: true },
        ];
    }

    /**
     * Perform search with efficient filtering
     */
    function performSearch(fieldId, query) {
        const wrapper = document.querySelector(`[data-field-id="${fieldId}"]`);
        const dropdown = document.getElementById(`${fieldId}Dropdown`);
        const results = document.getElementById(`${fieldId}Results`);
        const loading = document.getElementById(`${fieldId}Loading`);
        const noResults = document.getElementById(`${fieldId}NoResults`);
        const footer = document.getElementById(`${fieldId}Footer`);
        const resultsCount = document.getElementById(`${fieldId}ResultsCount`);
        const totalCount = document.getElementById(`${fieldId}TotalCount`);

        if (!wrapper || !dropdown || !results) return;

        // Show loading state
        showLoading(fieldId);

        // TODO: Replace with actual API call
        // Example API call:
        // fetch(`${CONFIG.API_ENDPOINT}?q=${encodeURIComponent(query)}`)
        //     .then(response => response.json())
        //     .then(data => {
        //         const filtered = Array.isArray(data) ? data.filter(client => client.activo) : [];
        //         const limitedResults = filtered.slice(0, CONFIG.MAX_RESULTS);
        //         renderResults(fieldId, limitedResults, filtered.length, query);
        //     })
        //     .catch(error => {
        //         console.error('Error searching clients:', error);
        //         hideDropdown();
        //     });

        // Simulate API delay (remove when using real API)
        setTimeout(() => {
            // Filter clients (case-insensitive, matches anywhere in nombre)
            // Only show active clients
            const queryLower = query.toLowerCase();
            filteredData = clientData.filter(client => 
                client.activo && client.nombre.toLowerCase().includes(queryLower)
            );

            // Sort by relevance (exact matches first, then starts with, then contains)
            filteredData.sort((a, b) => {
                const aLower = a.nombre.toLowerCase();
                const bLower = b.nombre.toLowerCase();
                
                if (aLower === queryLower) return -1;
                if (bLower === queryLower) return 1;
                if (aLower.startsWith(queryLower)) return -1;
                if (bLower.startsWith(queryLower)) return 1;
                return aLower.localeCompare(bLower);
            });

            // Initial results (first 100)
            const limitedResults = filteredData.slice(0, CONFIG.MAX_RESULTS);
            const totalMatches = filteredData.length;
            
            // Store full filtered data for load more
            filteredDataByField[fieldId] = filteredData;
            displayedResultsCount[fieldId] = limitedResults.length;

            // Render results
            renderResults(fieldId, limitedResults, totalMatches, query);
        }, 100); // Remove this timeout when using real API
    }

    /**
     * Show all clients (when focused with no query)
     */
    function showAllClients(fieldId) {
        // Only show active clients
        const activeClients = clientData.filter(client => client.activo);
        const limitedResults = activeClients.slice(0, CONFIG.MAX_RESULTS);
        
        // Store full data for load more
        filteredDataByField[fieldId] = activeClients;
        displayedResultsCount[fieldId] = limitedResults.length;
        
        renderResults(fieldId, limitedResults, activeClients.length, '');
    }

    /**
     * Render search results
     */
    function renderResults(fieldId, results, total, query) {
        const dropdown = document.getElementById(`${fieldId}Dropdown`);
        const resultsContainer = document.getElementById(`${fieldId}Results`);
        const loading = document.getElementById(`${fieldId}Loading`);
        const noResults = document.getElementById(`${fieldId}NoResults`);
        const footer = document.getElementById(`${fieldId}Footer`);
        const resultsCount = document.getElementById(`${fieldId}ResultsCount`);
        const totalCount = document.getElementById(`${fieldId}TotalCount`);
        const input = document.getElementById(fieldId);
        const hiddenIdInput = document.getElementById(`${fieldId}Id`);

        if (!dropdown || !resultsContainer) return;

        // Hide loading
        if (loading) loading.style.display = 'none';

        // Clear previous results (including load more button)
        resultsContainer.innerHTML = '';
        highlightedIndex = -1;

        if (results.length === 0) {
            // Show no results
            if (noResults) noResults.style.display = 'block';
            if (footer) footer.style.display = 'none';
            resultsContainer.style.display = 'none';
        } else {
            // Show results
            if (noResults) noResults.style.display = 'none';
            resultsContainer.style.display = 'block';

            // Create result items
            results.forEach((client, index) => {
                const item = document.createElement('div');
                item.className = 'autocomplete-result-item';
                item.dataset.index = index;
                item.dataset.clientCodigo = client.codigo;
                item.dataset.clientNombre = client.nombre;

                // Highlight matching text
                const highlightedName = highlightMatch(client.nombre, query);

                item.innerHTML = `
                    <span class="result-name">${highlightedName}</span>
                    ${client.codigo ? `<span class="result-id">Código: ${client.codigo}</span>` : ''}
                `;

                // Click handler
                item.addEventListener('click', function() {
                    selectClient(fieldId, client.codigo, client.nombre);
                });

                resultsContainer.appendChild(item);
            });

            // Add "Cargar más" button at the end of results if there are more
            const currentCount = displayedResultsCount[fieldId] || results.length;
            if (currentCount < total) {
                const loadMoreBtn = document.createElement('div');
                loadMoreBtn.className = 'autocomplete-load-more-item';
                loadMoreBtn.innerHTML = `
                    <button type="button" class="btn btn-sm btn-link w-100 text-primary" data-field-id="${fieldId}">
                        <i class="fas fa-chevron-down me-1"></i>Cargar más
                    </button>
                `;
                
                // Add click handler
                loadMoreBtn.querySelector('button').addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    loadMoreResults(fieldId);
                });
                
                resultsContainer.appendChild(loadMoreBtn);
            }

            // Show footer with count
            if (footer && totalCount && resultsCount) {
                footer.style.display = 'block';
                resultsCount.textContent = currentCount;
                totalCount.textContent = total;
            } else if (footer) {
                footer.style.display = 'none';
            }
        }

        // Show dropdown
        dropdown.style.display = 'block';
        activeInstance = fieldId;
    }
    
    /**
     * Load more results
     */
    function loadMoreResults(fieldId) {
        const fullData = filteredDataByField[fieldId];
        if (!fullData) return;
        
        const currentCount = displayedResultsCount[fieldId] || CONFIG.MAX_RESULTS;
        const nextBatch = fullData.slice(currentCount, currentCount + CONFIG.MAX_RESULTS);
        
        if (nextBatch.length === 0) return;
        
        // Append new results to existing ones
        const resultsContainer = document.getElementById(`${fieldId}Results`);
        if (!resultsContainer) return;
        
        // Remove the "Cargar más" button temporarily
        const loadMoreItem = resultsContainer.querySelector('.autocomplete-load-more-item');
        if (loadMoreItem) {
            loadMoreItem.remove();
        }
        
        const query = document.getElementById(fieldId)?.value.trim() || '';
        
        nextBatch.forEach((client, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-result-item';
            item.dataset.index = currentCount + index;
            item.dataset.clientCodigo = client.codigo;
            item.dataset.clientNombre = client.nombre;

            const highlightedName = highlightMatch(client.nombre, query);

            item.innerHTML = `
                <span class="result-name">${highlightedName}</span>
                ${client.codigo ? `<span class="result-id">Código: ${client.codigo}</span>` : ''}
            `;

            item.addEventListener('click', function() {
                selectClient(fieldId, client.codigo, client.nombre);
            });

            resultsContainer.appendChild(item);
        });
        
        // Update displayed count
        displayedResultsCount[fieldId] = currentCount + nextBatch.length;
        
        // Update footer
        const total = fullData.length;
        const footer = document.getElementById(`${fieldId}Footer`);
        const resultsCount = document.getElementById(`${fieldId}ResultsCount`);
        const totalCount = document.getElementById(`${fieldId}TotalCount`);
        
        if (footer && resultsCount && totalCount) {
            resultsCount.textContent = displayedResultsCount[fieldId];
            totalCount.textContent = total;
        }
        
        // Add "Cargar más" button again if there are still more results
        if (displayedResultsCount[fieldId] < total) {
            const loadMoreBtn = document.createElement('div');
            loadMoreBtn.className = 'autocomplete-load-more-item';
            loadMoreBtn.innerHTML = `
                <button type="button" class="btn btn-sm btn-link w-100 text-primary" data-field-id="${fieldId}">
                    <i class="fas fa-chevron-down me-1"></i>Cargar más
                </button>
            `;
            
            loadMoreBtn.querySelector('button').addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                loadMoreResults(fieldId);
            });
            
            resultsContainer.appendChild(loadMoreBtn);
        }
    }

    /**
     * Highlight matching text in result
     */
    function highlightMatch(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    }

    /**
     * Select a client
     */
    function selectClient(fieldId, clientCodigo, clientNombre) {
        const input = document.getElementById(fieldId);
        const hiddenIdInput = document.getElementById(`${fieldId}Id`);
        const dropdown = document.getElementById(`${fieldId}Dropdown`);

        if (input) {
            input.value = clientNombre;
            input.dataset.selectedId = clientCodigo;
            input.dataset.selectedValue = clientNombre;
        }

        if (hiddenIdInput) {
            hiddenIdInput.value = clientCodigo;
        }

        // Mark as selected in results
        const results = document.getElementById(`${fieldId}Results`);
        if (results) {
            const items = results.querySelectorAll('.autocomplete-result-item');
            items.forEach(item => {
                item.classList.remove('selected');
                if (item.dataset.clientCodigo == clientCodigo) {
                    item.classList.add('selected');
                }
            });
        }

        hideDropdown();
        
        // Trigger change event
        if (input) {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    /**
     * Handle keyboard navigation
     */
    function handleKeyboardNavigation(e, fieldId) {
        const dropdown = document.getElementById(`${fieldId}Dropdown`);
        const results = document.getElementById(`${fieldId}Results`);
        
        if (!dropdown || dropdown.style.display === 'none') {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const query = document.getElementById(fieldId).value.trim();
                if (query.length >= CONFIG.MIN_SEARCH_LENGTH) {
                    performSearch(fieldId, query);
                } else {
                    showAllClients(fieldId);
                }
                return;
            }
            return;
        }

        const items = results.querySelectorAll('.autocomplete-result-item');
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
                updateHighlight(items);
                scrollToHighlighted(items);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, -1);
                updateHighlight(items);
                scrollToHighlighted(items);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && items[highlightedIndex]) {
                    items[highlightedIndex].click();
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                hideDropdown();
                break;
        }
    }

    /**
     * Update highlighted item
     */
    function updateHighlight(items) {
        items.forEach((item, index) => {
            item.classList.toggle('highlighted', index === highlightedIndex);
        });
    }

    /**
     * Scroll to highlighted item
     */
    function scrollToHighlighted(items) {
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
            items[highlightedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    /**
     * Show loading state
     */
    function showLoading(fieldId) {
        const dropdown = document.getElementById(`${fieldId}Dropdown`);
        const loading = document.getElementById(`${fieldId}Loading`);
        const results = document.getElementById(`${fieldId}Results`);
        const noResults = document.getElementById(`${fieldId}NoResults`);
        const footer = document.getElementById(`${fieldId}Footer`);

        if (dropdown) dropdown.style.display = 'block';
        if (loading) loading.style.display = 'block';
        if (results) results.style.display = 'none';
        if (noResults) noResults.style.display = 'none';
        if (footer) footer.style.display = 'none';
    }

    /**
     * Hide dropdown
     */
    function hideDropdown() {
        if (activeInstance) {
            const dropdown = document.getElementById(`${activeInstance}Dropdown`);
            if (dropdown) dropdown.style.display = 'none';
            activeInstance = null;
            highlightedIndex = -1;
        }
    }

    /**
     * Clear debounce timer
     */
    function clearDebounce() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
    }

    /**
     * Create new client (placeholder for future implementation)
     */
    function createNewClient(fieldId, name) {
        // TODO: Implement API call to create new client
        // For now, just select the typed name
        const input = document.getElementById(fieldId);
        const hiddenIdInput = document.getElementById(`${fieldId}Id`);
        
        if (input) {
            input.dataset.selectedId = 'new';
            input.dataset.selectedValue = name;
        }
        
        if (hiddenIdInput) {
            hiddenIdInput.value = 'new';
        }
        
        hideDropdown();
        
        // Trigger change event
        if (input) {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        console.log('Creating new client:', name);
        // TODO: Show modal or form to create new client
    }

    /**
     * Public API: Set client data (for external use)
     */
    window.setRazonSocialData = function(data) {
        clientData = data;
    };

    /**
     * Public API: Get selected value
     */
    window.getRazonSocialValue = function(fieldId) {
        const input = document.getElementById(fieldId);
        if (input) {
            return {
                codigo: input.dataset.selectedId || '',
                nombre: input.dataset.selectedValue || input.value || '',
                value: input.value || ''
            };
        }
        return null;
    };

    /**
     * Initialize all autocomplete fields on page load
     */
    document.addEventListener('DOMContentLoaded', function() {
        // Initialize main form field
        initAutocomplete('razonSocial');
        
        // Initialize modal field
        initAutocomplete('modalRazonSocial');
    });

})();

