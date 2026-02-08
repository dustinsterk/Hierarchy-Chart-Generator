// Global variables
let hierarchyData = null;
let allNodesMap = new Map(); // Map of all nodes by name for quick lookup
let csvHeaders = []; // Store original CSV headers
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panInitialX = 0; // Store initial pan position when starting to pan
let panInitialY = 0; // Store initial pan position when starting to pan
let panSensitivity = 1.5; // Pan speed multiplier (higher = faster panning)
let panSensitivityEditMode = 1.5; // Pan speed in edit mode
let panSensitivityNormalMode = 2.5; // Pan speed when edit mode is off (faster)
let editMode = false;
let selectedNodeNames = new Set(); // Track multiple selected nodes
let draggedNode = null;
let dragOverNode = null;
let isResizing = false;
let resizeHandle = null;
let isMovingNode = false; // Track if we're currently moving a node
let nodePositions = new Map(); // Store manual positions: name -> {x, y, width, height}
let activeDrags = new Map(); // Track active drag operations: nodeName -> {element, offsetX, offsetY, width, height}
let nodeColors = new Map(); // Store node colors: name -> color
let globalNodeColor = '#667eea'; // Default node color
let fontFamily = "Verdana, sans-serif"; // Default font family
let fontSize = 12; // Default font size
let isMultiSelectMode = false; // Track if we're in multi-select mode (click and hold)
let multiSelectThreshold = 300; // Milliseconds to hold for multi-select (300ms)
let maxDepth = null; // Maximum depth to display (null = unlimited)
let nonParentGraceDepth = 2; // Levels from root to keep leaf nodes visible
let metadataPanelClosed = false; // Track if metadata panel is manually closed
let hideNonParentNodes = false; // Hide nodes that don't have children
let fileHasBeenLoaded = false; // Track if a file has been loaded (to hide instructions permanently)

// DOM elements
const csvFileInput = document.getElementById('csvFile');
const uploadBox = document.getElementById('uploadBox');
const uploadLabel = document.getElementById('uploadLabel');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const removeFileBtn = document.getElementById('removeFile');
const createNewGraphLink = document.getElementById('createNewGraph');
const chartContainer = document.getElementById('chartContainer');
const chartWrapper = document.getElementById('chartWrapper');
const chartSvg = document.getElementById('chartSvg');
const errorMessage = document.getElementById('errorMessage');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const resetZoomBtn = document.getElementById('resetZoom');
const downloadChartBtn = document.getElementById('downloadChart');
const editModeToggle = document.getElementById('editModeToggle');
const autoArrangeBtn = document.getElementById('autoArrange');
const addNodeBtn = document.getElementById('addNode');
const saveCSVBtn = document.getElementById('saveCSV');
const metadataPanel = document.getElementById('metadataPanel');
const metadataContent = document.getElementById('metadataContent');
const closeMetadataBtn = document.getElementById('closeMetadata');
const dropIndicator = document.getElementById('dropIndicator');
const styleControls = document.getElementById('styleControls');
const displayControls = document.getElementById('displayControls');
const styleSettingsDetails = document.getElementById('styleSettingsDetails');
const displaySettingsDetails = document.getElementById('displaySettingsDetails');
const globalNodeColorInput = document.getElementById('globalNodeColor');
const selectedNodeColorInput = document.getElementById('selectedNodeColor');
const selectedCountSpan = document.getElementById('selectedCount');
const applyGlobalColorBtn = document.getElementById('applyGlobalColor');
const applySelectedColorBtn = document.getElementById('applySelectedColor');
const fontFamilySelect = document.getElementById('fontFamily');
const fontSizeInput = document.getElementById('fontSize');
const applyFontFamilyBtn = document.getElementById('applyFontFamily');
const applyFontSizeBtn = document.getElementById('applyFontSize');
const depthSettingInput = document.getElementById('depthSetting');
const graceDepthInput = document.getElementById('graceDepth');
const hideNonParentsCheckbox = document.getElementById('hideNonParents');
const graceDepthRow = document.getElementById('graceDepthRow');
const headerElement = document.querySelector('header');
const uploadSection = document.querySelector('.upload-section');
const instructionsSection = document.querySelector('.instructions');

// File upload handlers
csvFileInput.addEventListener('change', handleFileSelect);
removeFileBtn.addEventListener('click', removeFile);
if (createNewGraphLink) {
    createNewGraphLink.addEventListener('click', (e) => {
        e.preventDefault();
        createNewGraph();
    });
}

// Click handler for upload area
if (uploadLabel) {
    uploadLabel.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (csvFileInput && !isProcessingFile) {
            csvFileInput.click();
        }
    });
}

// Drag and drop handlers for file upload
uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.classList.add('dragover');
});

uploadBox.addEventListener('dragleave', (e) => {
    // Only remove dragover if we're actually leaving the upload box
    if (!uploadBox.contains(e.relatedTarget)) {
        uploadBox.classList.remove('dragover');
    }
});

uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && (files[0].type === 'text/csv' || files[0].name.endsWith('.csv'))) {
        handleFile(files[0]);
    } else {
        showError('Please upload a valid CSV file.');
    }
});

// Note: Click handling is done entirely by the label's 'for' attribute
// No JavaScript click handler needed - this prevents conflicts and crashes

// Zoom controls
zoomInBtn.addEventListener('click', () => {
    currentZoom = Math.min(currentZoom * 1.2, 20);
    updateTransform();
});

zoomOutBtn.addEventListener('click', () => {
    currentZoom = Math.max(currentZoom / 1.2, 0.3);
    updateTransform();
});

resetZoomBtn.addEventListener('click', () => {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    updateTransform();
});

// Mouse wheel zoom - zoom towards mouse cursor position
chartSvg.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    // Get mouse position relative to SVG
    const rect = chartSvg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get the content group transform
    const contentGroup = chartSvg.querySelector('g.chart-content');
    if (!contentGroup) return;
    
    // Calculate zoom factor (smaller increments for smoother zooming)
    const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05; // Zoom out on scroll down, zoom in on scroll up
    const newZoom = Math.max(0.3, Math.min(20, currentZoom * zoomFactor));
    
    // Calculate the point in SVG coordinates before zoom
    const svgX = (mouseX - panX) / currentZoom;
    const svgY = (mouseY - panY) / currentZoom;
    
    // Calculate new pan to keep the same point under the mouse cursor
    panX = mouseX - svgX * newZoom;
    panY = mouseY - svgY * newZoom;
    
    currentZoom = newZoom;
    updateTransform();
}, { passive: false });

// Pan functionality - allow panning in edit mode when not interacting with nodes
chartSvg.addEventListener('mousedown', (e) => {
    // Allow panning when clicking on empty space (not on a node or its children)
    if (e.button === 0 && activeDrags.size === 0 && !isResizing) {
        // Check if clicking on empty space (not on a node, link, or text)
        const isNodeElement = e.target.closest('.node') || 
                              e.target.classList.contains('node') ||
                              e.target.classList.contains('node-rect') ||
                              e.target.classList.contains('node-text') ||
                              e.target.classList.contains('node-text-group') ||
                              e.target.classList.contains('child-count-badge') ||
                              e.target.classList.contains('child-count-text') ||
                              e.target.classList.contains('resize-handle');
        
        if (!isNodeElement && (e.target.tagName === 'svg' || 
            e.target.classList.contains('link') ||
            e.target.tagName === 'line' ||
            e.target.classList.contains('chart-content'))) {
            isPanning = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            panInitialX = panX;
            panInitialY = panY;
            chartSvg.style.cursor = 'grabbing';
            e.preventDefault(); // Prevent text selection
        }
    }
});

// Allow clicking on empty space to deselect in edit mode
chartSvg.addEventListener('click', (e) => {
    // Don't interfere with scrollbar clicks or if we just panned
    if (e.target === chartWrapper || chartWrapper.contains(e.target) || isPanning) {
        return;
    }
    
    if (editMode && !isMovingNode && !isResizing && !isMultiSelectMode) {
        // Check if clicking on empty space (not on a node)
        const isNodeElement = e.target.closest('.node') || 
                              e.target.classList.contains('node') ||
                              e.target.classList.contains('node-rect') ||
                              e.target.classList.contains('node-text') ||
                              e.target.classList.contains('node-text-group');
        
        if (!isNodeElement && (e.target.tagName === 'svg' || 
            e.target.classList.contains('link') ||
            e.target.tagName === 'line' ||
            e.target.classList.contains('chart-content'))) {
            selectedNodeNames.clear();
            updateMetadataPanel();
            updateSelectedCount();
            renderChart();
        }
    }
});

chartSvg.addEventListener('mousemove', (e) => {
    // Allow panning in both edit and non-edit modes when panning is active
    if (isPanning && activeDrags.size === 0 && !isResizing) {
        // Use faster panning when edit mode is off
        const currentPanSensitivity = editMode ? panSensitivityEditMode : panSensitivityNormalMode;
        const deltaX = (e.clientX - panStartX) * currentPanSensitivity;
        const deltaY = (e.clientY - panStartY) * currentPanSensitivity;
        panX = panInitialX + deltaX;
        panY = panInitialY + deltaY;
        updateTransform();
        e.preventDefault(); // Prevent text selection while panning
    }
});

chartSvg.addEventListener('mouseup', () => {
    isPanning = false;
    // Reset cursor based on edit mode
    if (editMode) {
        chartSvg.style.cursor = 'default';
    } else {
        chartSvg.style.cursor = 'default';
    }
});

chartSvg.addEventListener('mouseleave', () => {
    isPanning = false;
});

// Edit mode toggle
editModeToggle.addEventListener('click', () => {
    // Store current zoom and pan before toggling
    const savedZoom = currentZoom;
    const savedPanX = panX;
    const savedPanY = panY;
    
    editMode = !editMode;
    editModeToggle.textContent = `Edit Layout: ${editMode ? 'ON' : 'OFF'}`;
    editModeToggle.classList.toggle('active', editMode);
    chartContainer.classList.toggle('edit-mode', editMode);
    if (styleControls) styleControls.style.display = editMode ? 'flex' : 'none';
    if (displayControls) displayControls.style.display = editMode ? 'flex' : 'none';
    
    // Collapse Style Settings and Display Settings sections when edit mode is enabled
    if (editMode) {
        if (styleSettingsDetails) styleSettingsDetails.removeAttribute('open');
        if (displaySettingsDetails) displaySettingsDetails.removeAttribute('open');
    }
    
    // Show/hide metadata panel based on edit mode (only visible in edit mode when nodes are selected)
    if (metadataPanel) {
        if (editMode) {
            // Don't show metadata panel when entering edit mode - wait for node selection
            // The panel will be shown by updateMetadataPanel() when nodes are selected
            metadataPanel.style.display = 'none';
        } else {
            // Hide metadata panel when exiting edit mode
            metadataPanel.style.display = 'none';
        }
    }
    
    // Enable/disable Save CSV button based on edit mode (only enabled when edit mode is OFF)
    if (saveCSVBtn) {
        saveCSVBtn.disabled = editMode;
        saveCSVBtn.style.opacity = editMode ? '0.5' : '1';
        saveCSVBtn.style.cursor = editMode ? 'not-allowed' : 'pointer';
    }
    
    // Enable/disable Download Chart button based on edit mode (only enabled when edit mode is OFF)
    if (downloadChartBtn) {
        downloadChartBtn.disabled = editMode;
        downloadChartBtn.style.opacity = editMode ? '0.5' : '1';
        downloadChartBtn.style.cursor = editMode ? 'not-allowed' : 'pointer';
    }
    
    // Hide/show elements above zoom buttons in edit mode
    if (editMode) {
        // Hide elements above zoom buttons
        if (headerElement) headerElement.style.display = 'none';
        if (uploadSection) uploadSection.style.display = 'none';
        if (instructionsSection) instructionsSection.style.display = 'none';
        // Reset zoom and pan when entering edit mode
        currentZoom = 1;
        panX = 0;
        panY = 0;
        updateTransform();
    } else {
        // Show elements when edit mode is off (but keep instructions hidden if file has been loaded)
        if (headerElement) headerElement.style.display = '';
        if (uploadSection) uploadSection.style.display = '';
        // Only show instructions if file has never been loaded
        if (instructionsSection && !fileHasBeenLoaded) {
            instructionsSection.style.display = '';
        }
    }
    
    if (!editMode) {
        selectedNodeNames.clear();
        draggedNode = null;
        dragOverNode = null;
        isResizing = false;
        isMovingNode = false;
        isMultiSelectMode = false;
        activeDrags.clear();
        updateMetadataPanel();
        updateSelectedCount();
        renderChart();
        // Center the chart when exiting edit mode - use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                centerChart();
            });
        });
    } else {
        // When turning edit mode ON, zoom is reset, clear selection and hide metadata panel
        selectedNodeNames.clear();
        updateSelectedCount();
        updateMetadataPanel(); // This will hide the panel since no nodes are selected
        updateTransform();
    }
    updateChartWrapperHeight();
});

// Close metadata panel
closeMetadataBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    metadataPanelClosed = true;
    metadataPanel.style.display = 'none';
    selectedNodeNames.clear();
    updateSelectedCount();
    renderChart();
});

// Download chart
downloadChartBtn.addEventListener('click', downloadChart);

// Save CSV
saveCSVBtn.addEventListener('click', saveCSV);

// Auto Arrange
if (autoArrangeBtn) {
    autoArrangeBtn.addEventListener('click', autoArrange);
}
if (addNodeBtn) {
    addNodeBtn.addEventListener('click', addNewNode);
}

// Depth setting
if (depthSettingInput) {
    depthSettingInput.addEventListener('change', (e) => {
        const value = e.target.value.trim();
        if (value === '' || value === null) {
            maxDepth = null;
        } else {
            const depth = parseInt(value, 10);
            if (!isNaN(depth) && depth >= 1) {
                maxDepth = depth;
            } else {
                maxDepth = null;
                e.target.value = '';
            }
        }
        if (hierarchyData) {
            renderChart();
        }
    });
    
    // Also allow Enter key
    depthSettingInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.target.blur(); // Triggers change event
        }
    });
}

// Grace depth setting
if (graceDepthInput) {
    graceDepthInput.addEventListener('change', (e) => {
        const value = e.target.value.trim();
        if (value === '' || value === null) {
            nonParentGraceDepth = 2;
            e.target.value = '2';
        } else {
            const depth = parseInt(value, 10);
            if (!isNaN(depth) && depth >= 0) {
                nonParentGraceDepth = depth;
            } else {
                nonParentGraceDepth = 2;
                e.target.value = '2';
            }
        }
        if (hierarchyData) {
            renderChart();
        }
    });
    
    graceDepthInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    });
}

// Hide non-parent nodes setting
if (hideNonParentsCheckbox) {
    hideNonParentsCheckbox.addEventListener('change', (e) => {
        hideNonParentNodes = e.target.checked;
        updateGraceDepthUI();
        if (hierarchyData) {
            renderChart();
        }
    });
}

// Style controls
if (applyGlobalColorBtn) {
    applyGlobalColorBtn.addEventListener('click', () => {
        if (!allNodesMap || allNodesMap.size === 0) {
            console.warn('No nodes available');
            return;
        }
        globalNodeColor = globalNodeColorInput.value;
        // Apply to all nodes (this will overwrite any custom colors including root nodes)
        allNodesMap.forEach((node, name) => {
            nodeColors.set(name, globalNodeColor);
        });
        renderChart();
    });
}

// Root color button removed - functionality no longer needed

if (applySelectedColorBtn) {
    applySelectedColorBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (selectedNodeNames.size === 0) {
            alert('Please select at least one node first');
            return;
        }
        
        if (!selectedNodeColorInput) {
            console.error('selectedNodeColorInput not found');
            return;
        }
        
        const color = selectedNodeColorInput.value;
        
        // Set the color for all selected nodes (including root nodes)
        selectedNodeNames.forEach(nodeName => {
            nodeColors.set(nodeName, color);
        });
        
        if (!hierarchyData || hierarchyData.length === 0) {
            return;
        }
        
        renderChart();
    });
} else {
    console.error('applySelectedColorBtn element not found in DOM');
}

if (applyFontFamilyBtn) {
    applyFontFamilyBtn.addEventListener('click', () => {
        fontFamily = fontFamilySelect.value;
        renderChart();
    });
}

if (applyFontSizeBtn) {
    applyFontSizeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!fontSizeInput) {
            console.error('fontSizeInput not found');
            return;
        }
        
        const inputValue = fontSizeInput.value.trim();
        const newSize = parseInt(inputValue, 10);
        
        if (isNaN(newSize) || newSize < 8 || newSize > 24) {
            alert('Font size must be between 8 and 24 pixels. Current value: ' + inputValue);
            if (fontSizeInput) fontSizeInput.value = fontSize;
            return;
        }
        
        const oldSize = fontSize;
        fontSize = Number(newSize);
        
        if (!hierarchyData || hierarchyData.length === 0) {
            alert('Please load a CSV file first');
            fontSize = oldSize;
            if (fontSizeInput) fontSizeInput.value = oldSize;
            return;
        }
        
        renderChart();
    });
    
    // Also allow Enter key on the input
    if (fontSizeInput) {
        fontSizeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyFontSizeBtn.click();
            }
        });
    }
} else {
    console.error('applyFontSizeBtn element not found in DOM');
}

let isProcessingFile = false; // Prevent multiple simultaneous file operations

function handleFileSelect(e) {
    if (isProcessingFile) {
        console.warn('File already being processed, ignoring new selection');
        return;
    }
    
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    if (isProcessingFile) {
        console.warn('File already being processed');
        return;
    }
    
    isProcessingFile = true;
    
    try {
        fileName.textContent = file.name;
        fileInfo.style.display = 'flex';
        errorMessage.style.display = 'none';
        chartContainer.style.display = 'none';
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csv = e.target.result;
                if (!csv || csv.trim().length === 0) {
                    showError('CSV file is empty.');
                    isProcessingFile = false;
                    return;
                }
                parseCSV(csv);
                isProcessingFile = false;
            } catch (error) {
                console.error('Error reading file:', error);
                showError('Error reading file: ' + error.message);
                isProcessingFile = false;
            }
        };
        reader.onerror = () => {
            showError('Error reading file. Please try again.');
            isProcessingFile = false;
        };
        reader.readAsText(file);
    } catch (error) {
        console.error('Error in handleFile:', error);
        showError('Error processing file: ' + error.message);
        isProcessingFile = false;
    }
}

function removeFile() {
    csvFileInput.value = '';
    fileInfo.style.display = 'none';
    chartContainer.style.display = 'none';
    hierarchyData = null;
    allNodesMap.clear();
    nodePositions.clear();
    selectedNodeNames.clear();
    nodeColors.clear();
    currentZoom = 1;
    panX = 0;
    panY = 0;
    editMode = false;
    isProcessingFile = false;
    isMultiSelectMode = false;
    maxDepth = null; // Reset depth setting
    hideNonParentNodes = false; // Reset hide non-parent nodes setting
    nonParentGraceDepth = 2; // Reset grace depth setting
    metadataPanelClosed = false; // Reset metadata panel state
    // Only show metadata panel if in edit mode
    if (metadataPanel) {
        metadataPanel.style.display = editMode ? 'flex' : 'none';
    }
    if (depthSettingInput) depthSettingInput.value = '';
    if (graceDepthInput) graceDepthInput.value = '2';
    editModeToggle.textContent = 'Edit Layout: OFF';
    editModeToggle.classList.remove('active');
    chartContainer.classList.remove('edit-mode');
    if (styleControls) styleControls.style.display = 'none';
    if (displayControls) displayControls.style.display = 'none';
    // Keep instructions hidden permanently once a file has been loaded
    // Do not show instructions section again when file is removed
    if (instructionsSection && !fileHasBeenLoaded) {
        instructionsSection.style.display = '';
    }
    // Reset Save CSV button state (enabled when edit mode is OFF)
    if (saveCSVBtn) {
        saveCSVBtn.disabled = editMode;
        saveCSVBtn.style.opacity = editMode ? '0.5' : '1';
        saveCSVBtn.style.cursor = editMode ? 'not-allowed' : 'pointer';
    }
    // Reset Download Chart button state (enabled when edit mode is OFF)
    if (downloadChartBtn) {
        downloadChartBtn.disabled = editMode;
        downloadChartBtn.style.opacity = editMode ? '0.5' : '1';
        downloadChartBtn.style.cursor = editMode ? 'not-allowed' : 'pointer';
    }
    updateSelectedCount();
}

function createNewGraph() {
    if (isProcessingFile) {
        console.warn('File already being processed');
        return;
    }
    
    csvFileInput.value = '';
    fileName.textContent = '';
    fileInfo.style.display = 'none';
    errorMessage.style.display = 'none';
    
    hierarchyData = [];
    allNodesMap.clear();
    nodePositions.clear();
    selectedNodeNames.clear();
    nodeColors.clear();
    activeDrags.clear();
    
    currentZoom = 1;
    panX = 0;
    panY = 0;
    
    editMode = false;
    isMultiSelectMode = false;
    isResizing = false;
    isMovingNode = false;
    draggedNode = null;
    dragOverNode = null;
    maxDepth = null;
    hideNonParentNodes = false;
    nonParentGraceDepth = 2;
    metadataPanelClosed = false;
    
    if (metadataPanel) {
        metadataPanel.style.display = 'none';
    }
    if (depthSettingInput) depthSettingInput.value = '';
    if (graceDepthInput) graceDepthInput.value = '2';
    if (hideNonParentsCheckbox) hideNonParentsCheckbox.checked = false;
    updateGraceDepthUI();
    
    editModeToggle.textContent = 'Edit Layout: OFF';
    editModeToggle.classList.remove('active');
    chartContainer.classList.remove('edit-mode');
    if (styleControls) styleControls.style.display = 'none';
    if (displayControls) displayControls.style.display = 'none';
    
    if (saveCSVBtn) {
        saveCSVBtn.disabled = editMode;
        saveCSVBtn.style.opacity = editMode ? '0.5' : '1';
        saveCSVBtn.style.cursor = editMode ? 'not-allowed' : 'pointer';
    }
    if (downloadChartBtn) {
        downloadChartBtn.disabled = editMode;
        downloadChartBtn.style.opacity = editMode ? '0.5' : '1';
        downloadChartBtn.style.cursor = editMode ? 'not-allowed' : 'pointer';
    }
    
    if (!csvHeaders || csvHeaders.length === 0) {
        csvHeaders = ['name', 'parent_id', 'title', 'location', 'phone', 'email'];
    }
    
    const metadata = {};
    csvHeaders.forEach(header => {
        const headerLower = header.toLowerCase();
        if (headerLower !== 'parent_id' && 
            headerLower !== 'name' && 
            headerLower !== 'position_x' && 
            headerLower !== 'position_y' && 
            headerLower !== 'node_color') {
            metadata[header] = '';
        }
    });
    
    let newName = 'Root';
    let suffix = 1;
    while (allNodesMap.has(newName)) {
        suffix += 1;
        newName = `Root ${suffix}`;
    }
    
    const newNode = {
        name: newName,
        parentName: null,
        metadata: metadata,
        children: []
    };
    
    hierarchyData = [newNode];
    allNodesMap.set(newName, newNode);
    
    fileHasBeenLoaded = true;
    if (instructionsSection) instructionsSection.style.display = 'none';
    
    renderChart();
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            centerChart();
        });
    });
    updateSelectedCount();
}

function parseCSV(csv) {
    try {
        const lines = csv.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            showError('CSV file must have at least a header row and one data row.');
            return;
        }

        // Parse header
        csvHeaders = parseCSVLine(lines[0]).map(h => h.trim());
        const headersLower = csvHeaders.map(h => h.toLowerCase());
        const parentIdIndex = headersLower.indexOf('parent_id');
        const nameIndex = headersLower.indexOf('name');
        const positionXIndex = headersLower.indexOf('position_x');
        const positionYIndex = headersLower.indexOf('position_y');
        const nodeColorIndex = headersLower.indexOf('node_color');

        if (nameIndex === -1) {
            showError('CSV must contain a "name" column.');
            return;
        }

        // Parse data
        const nodes = [];
        allNodesMap.clear();
        nodePositions.clear();
        nodeColors.clear();

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length < nameIndex + 1) continue;

            const parentName = parentIdIndex !== -1 ? (values[parentIdIndex] || '').trim() : '';
            const name = values[nameIndex] ? values[nameIndex].trim() : '';

            if (!name) continue;

            // Store all metadata first (excluding parent_id, position_x, position_y, node_color, but keep name)
            const metadata = {};
            csvHeaders.forEach((header, index) => {
                const headerLower = header.toLowerCase();
                if (headerLower !== 'parent_id' && 
                    headerLower !== 'name' && 
                    headerLower !== 'position_x' && 
                    headerLower !== 'position_y' && 
                    headerLower !== 'node_color') {
                    metadata[header] = values[index] || '';
                }
            });

            // Load position if available (calculate height from metadata)
            if (positionXIndex !== -1 && positionYIndex !== -1) {
                const posX = parseFloat(values[positionXIndex] || '');
                const posY = parseFloat(values[positionYIndex] || '');
                if (!isNaN(posX) && !isNaN(posY)) {
                    // Calculate height based on metadata content
                    const title = metadata.title || '';
                    const location = metadata.location || '';
                    let lines = 1; // Name is always shown
                    if (title) lines++;
                    if (location) lines++;
                    const defaultHeight = Math.max(60, 40 + (lines - 1) * 18);
                    
                    nodePositions.set(name, {
                        x: posX,
                        y: posY,
                        width: 180, // Default width
                        height: defaultHeight
                    });
                }
            }

            // Load color if available
            if (nodeColorIndex !== -1) {
                const color = (values[nodeColorIndex] || '').trim();
                if (color) {
                    nodeColors.set(name, color);
                }
            }

            const node = {
                name: name,
                parentName: parentName === '' || parentName === 'null' || parentName === null ? null : parentName,
                metadata: metadata,
                children: []
            };

            nodes.push(node);
            allNodesMap.set(name, node);
        }

        if (nodes.length === 0) {
            showError('No valid nodes found in CSV file.');
            return;
        }

        // Build hierarchy - match parent_id to name
        const rootNodes = [];
        nodes.forEach(node => {
            if (node.parentName && allNodesMap.has(node.parentName)) {
                const parent = allNodesMap.get(node.parentName);
                parent.children.push(node);
            } else {
                rootNodes.push(node);
            }
        });

        if (rootNodes.length === 0) {
            showError('No root nodes found. Ensure at least one node has an empty or null parent_id.');
            return;
        }

        hierarchyData = rootNodes;
        errorMessage.style.display = 'none';
        // Hide instructions section permanently once CSV is loaded
        fileHasBeenLoaded = true;
        if (instructionsSection) instructionsSection.style.display = 'none';
        // Reset zoom and pan before rendering
        currentZoom = 1;
        panX = 0;
        panY = 0;
        renderChart();
        // Center the chart after rendering - use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                centerChart();
            });
        });
    } catch (error) {
        console.error('Error parsing CSV:', error);
        showError('Error parsing CSV file: ' + error.message);
    }
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}

function renderChart() {
    if (!hierarchyData || hierarchyData.length === 0) {
        console.warn('No hierarchy data to render', hierarchyData);
        return;
    }

    try {
        console.log('Rendering chart with', hierarchyData.length, 'root nodes');
        chartContainer.style.display = 'block';
        errorMessage.style.display = 'none';
    
        // Ensure chart wrapper is visible and has dimensions
        if (!chartWrapper) {
            console.error('Chart wrapper not found');
            return;
        }
        
        // Force dimensions if needed
        if (chartWrapper.offsetWidth === 0) {
            chartWrapper.style.width = '100%';
        updateChartWrapperHeight();
        }
    
        // Calculate dimensions - allow SVG to be larger than wrapper for scrolling
        const wrapperWidth = chartWrapper.clientWidth || chartWrapper.offsetWidth || 1600;
        const wrapperHeight = chartWrapper.clientHeight || 800;
        const initialWidth = Math.max(wrapperWidth, 1200);
        const initialHeight = Math.max(wrapperHeight, 800);
        
        // Set initial SVG dimensions (will be adjusted after layout calculation)
        chartSvg.setAttribute('width', initialWidth);
        chartSvg.setAttribute('height', initialHeight);
    chartSvg.style.display = 'block';
    chartSvg.innerHTML = '';

    // Create content group for transform
    const contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    contentGroup.setAttribute('class', 'chart-content');

    // Add arrow marker definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3, 0 6');
    polygon.setAttribute('fill', '#999');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    chartSvg.appendChild(defs);

    // Filter nodes if hideNonParentNodes is enabled
    let nodesToRender = hierarchyData;
    if (hideNonParentNodes) {
        // Filter function to only keep nodes that have visible children
        function filterParentNodes(nodes, currentDepth = 0) {
            return nodes.map(node => {
                // Check if we've reached max depth - nodes at maxDepth won't be shown
                if (maxDepth !== null && currentDepth >= maxDepth) {
                    return null;
                }
                
                // Recursively filter children
                const filteredChildren = filterParentNodes(node.children, currentDepth + 1);
                const hasDataChildren = node.children && node.children.length > 0;
                
                // Keep parents even if children are hidden by max depth
                if (hasDataChildren) {
                    return {
                        ...node,
                        children: filteredChildren
                    };
                }
                
                // Allow leaf nodes near the root to remain visible
                if (currentDepth <= nonParentGraceDepth) {
                    return {
                        ...node,
                        children: []
                    };
                }
                
                return null; // Filter out deeper nodes without visible children
            }).filter(node => node !== null); // Remove null entries
        }
        
        nodesToRender = filterParentNodes(hierarchyData);
    }
    
    // Calculate layout (will adjust dimensions based on actual content)
    const layout = calculateLayout(nodesToRender, initialWidth, initialHeight);
    
    // Draw links first (so they appear behind nodes)
    layout.links.forEach(link => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', link.x1);
        line.setAttribute('y1', link.y1);
        line.setAttribute('x2', link.x2);
        line.setAttribute('y2', link.y2);
        line.setAttribute('class', 'link');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        line.setAttribute('stroke', '#999');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('fill', 'none');
        contentGroup.appendChild(line);
    });

    // Draw nodes
    layout.nodes.forEach(layoutNode => {
        const node = findNodeByName(layoutNode.name);
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `node ${layoutNode.isRoot ? 'root' : ''}`);
        group.setAttribute('transform', `translate(${layoutNode.x}, ${layoutNode.y})`);
        group.setAttribute('data-node-name', layoutNode.name);
        
        if (selectedNodeNames.has(layoutNode.name)) {
            group.classList.add('selected');
        }
        if (draggedNode === layoutNode.name) {
            group.classList.add('dragging');
        }
        if (dragOverNode === layoutNode.name) {
            group.classList.add('drag-over');
        }

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', layoutNode.width);
        rect.setAttribute('height', layoutNode.height);
        rect.setAttribute('x', -layoutNode.width / 2);
        rect.setAttribute('y', -layoutNode.height / 2);
        rect.setAttribute('class', 'node-rect');
        
        // Apply node color - ALWAYS check custom color first
        // Custom colors in nodeColors take priority for ALL nodes (including roots)
        let nodeColor = nodeColors.get(layoutNode.name);
        
        // If no custom color exists, use default
        if (nodeColor === undefined || nodeColor === null || nodeColor === '') {
            // No custom color set, use global color for all nodes (including roots)
            nodeColor = globalNodeColor;
        }
        
        // Apply the color - custom colors override defaults for root nodes
        rect.setAttribute('fill', nodeColor);
        rect.setAttribute('stroke', adjustColorBrightness(nodeColor, -20));
        

        // Get node data for displaying title and location (node already declared above)
        const title = node && node.metadata && node.metadata.title ? node.metadata.title : '';
        const location = node && node.metadata && node.metadata.location ? node.metadata.location : '';
        
        // Create text group for multiple lines
        const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        textGroup.setAttribute('class', 'node-text-group');
        
        // Apply font settings (ensure fontSize is valid)
        let currentFontSize = fontSize;
        if (typeof currentFontSize !== 'number' || isNaN(currentFontSize) || currentFontSize < 8 || currentFontSize > 24) {
            currentFontSize = 14;
        }
        const nameFontSize = currentFontSize;
        const titleFontSize = Math.max(8, currentFontSize - 2);
        const locationFontSize = Math.max(8, currentFontSize - 3);
        
        // Name (always shown) - positioned at top
        const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameText.textContent = layoutNode.name;
        nameText.setAttribute('x', 0);
        nameText.setAttribute('y', -10);
        nameText.setAttribute('class', 'node-text node-name');
        nameText.setAttribute('font-family', fontFamily || "Verdana, sans-serif");
        nameText.setAttribute('font-size', nameFontSize + 'px');
        // Ensure root node text is white, not purple
        if (layoutNode.isRoot) {
            nameText.setAttribute('fill', 'white');
        }
        textGroup.appendChild(nameText);
        
        // Title (if available) - positioned below name
        let yOffset = 6;
        if (title) {
            const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            titleText.textContent = title;
            titleText.setAttribute('x', 0);
            titleText.setAttribute('y', yOffset);
            titleText.setAttribute('class', 'node-text node-title');
            titleText.setAttribute('font-family', fontFamily || "Verdana, sans-serif");
            titleText.setAttribute('font-size', titleFontSize + 'px');
            // Ensure root node text is white, not purple
            if (layoutNode.isRoot) {
                titleText.setAttribute('fill', 'white');
            }
            textGroup.appendChild(titleText);
            yOffset += 14;
        }
        
        // Location (if available) - positioned at bottom
        if (location) {
            const locationText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            locationText.textContent = location;
            locationText.setAttribute('x', 0);
            locationText.setAttribute('y', yOffset);
            locationText.setAttribute('class', 'node-text node-location');
            locationText.setAttribute('font-family', fontFamily || "Verdana, sans-serif");
            locationText.setAttribute('font-size', locationFontSize + 'px');
            // Ensure root node text is white, not purple
            if (layoutNode.isRoot) {
                locationText.setAttribute('fill', 'white');
            }
            textGroup.appendChild(locationText);
        }
        group.appendChild(rect);
        group.appendChild(textGroup);
        
        // Add child count indicator in top right corner for parent nodes
        if (node && node.children && node.children.length > 0) {
            // Count direct children (next level)
            const childrenCount = node.children.length;
            
            // Create a background circle for the count badge - append after textGroup to ensure it's on top
            const badgeBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            badgeBg.setAttribute('cx', layoutNode.width / 2 - 8);
            badgeBg.setAttribute('cy', -layoutNode.height / 2 + 8);
            badgeBg.setAttribute('r', 12);
            badgeBg.setAttribute('fill', '#ffffff');
            badgeBg.setAttribute('stroke', '#333333');
            badgeBg.setAttribute('stroke-width', '2');
            badgeBg.setAttribute('class', 'child-count-badge');
            badgeBg.style.pointerEvents = 'none';
            group.appendChild(badgeBg);
            
            // Create text for the count - ensure it's visible (especially for root nodes)
            const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            countText.textContent = childrenCount.toString();
            countText.setAttribute('x', layoutNode.width / 2 - 8);
            countText.setAttribute('y', -layoutNode.height / 2 + 12);
            countText.setAttribute('class', 'child-count-text');
            countText.setAttribute('font-family', fontFamily || "Verdana, sans-serif");
            countText.setAttribute('font-size', '12px');
            countText.setAttribute('font-weight', 'bold');
            countText.setAttribute('fill', '#000000');
            countText.setAttribute('stroke', 'none');
            countText.setAttribute('text-anchor', 'middle');
            countText.setAttribute('dominant-baseline', 'central');
            countText.style.pointerEvents = 'none';
            countText.style.fill = '#000000'; // Force black color via style
            // For root nodes, ensure the text is not affected by root node white text rule
            if (layoutNode.isRoot) {
                countText.setAttribute('data-root-child-count', 'true');
            }
            group.appendChild(countText);
        }
        
        // Add resize handles in edit mode (only for single selection)
        if (editMode && selectedNodeNames.size === 1 && selectedNodeNames.has(layoutNode.name)) {
            const handles = createResizeHandles(layoutNode.name, layoutNode.width, layoutNode.height);
            handles.forEach(handle => group.appendChild(handle));
        }
        
        // Add event listeners
        if (editMode) {
            // In edit mode, allow both selection and dragging
            let isDragging = false;
            let dragStartPos = null;
            let dragStartTime = 0;
            let multiSelectTimer = null;
            
            group.addEventListener('mousedown', (e) => {
                // Don't start drag if clicking on resize handle
                if (e.target.classList.contains('resize-handle')) {
                    return;
                }
                
                e.stopPropagation();
                
                // Record initial position and time
                dragStartPos = { x: e.clientX, y: e.clientY };
                dragStartTime = Date.now();
                isDragging = false;
                let multiSelectActivated = false;
                
                // Start multi-select timer (click and hold for 300ms)
                const timerId = setTimeout(() => {
                    multiSelectActivated = true;
                    isMultiSelectMode = true;
                    // Add to selection without removing others (multi-select)
                    toggleNodeSelection(layoutNode.name, true);
                }, multiSelectThreshold);
                
                const handleMouseMove = (moveEvent) => {
                    if (!dragStartPos) return;
                    
                    const dx = Math.abs(moveEvent.clientX - dragStartPos.x);
                    const dy = Math.abs(moveEvent.clientY - dragStartPos.y);
                    
                    // If mouse moved more than 5 pixels, cancel multi-select and start dragging
                    if (dx > 5 || dy > 5) {
                        clearTimeout(timerId);
                        isDragging = true;
                        isMultiSelectMode = false;
                        handleNodeMoveStart(e, layoutNode.name);
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                    }
                };
                
                const handleMouseUp = (upEvent) => {
                    clearTimeout(timerId);
                    
                    const timeHeld = Date.now() - dragStartTime;
                    
                    // Check if Command (Mac) or Ctrl (Windows/Linux) key is pressed
                    const isModifierPressed = upEvent.metaKey || upEvent.ctrlKey;
                    
                    // If it was held long enough, multi-select already happened
                    // If modifier key is pressed, toggle selection (multi-select)
                    // If it was just a quick click without modifier, single select
                    if (!isDragging && !multiSelectActivated && timeHeld < multiSelectThreshold) {
                        if (isModifierPressed) {
                            // Command/Ctrl + click - toggle selection (multi-select)
                            toggleNodeSelection(layoutNode.name, !selectedNodeNames.has(layoutNode.name));
                        } else {
                            // Single click - replace selection
                            selectNodeSingle(layoutNode.name);
                        }
                    }
                    
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    dragStartPos = null;
                    isMultiSelectMode = false;
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });
            
            // Click handler disabled - mousedown handles all selection
            // This prevents double-selection issues
        } else {
            // In non-edit mode, simple click to select, or Command/Ctrl+click for multi-select
            group.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Check if Command (Mac) or Ctrl (Windows/Linux) key is pressed
                const isModifierPressed = e.metaKey || e.ctrlKey;
                
                if (isModifierPressed) {
                    // Command/Ctrl + click - toggle selection (multi-select)
                    toggleNodeSelection(layoutNode.name, !selectedNodeNames.has(layoutNode.name));
                } else {
                    // Single click - replace selection
                    selectNodeSingle(layoutNode.name);
                }
            });
        }
        
        contentGroup.appendChild(group);
    });

        chartSvg.appendChild(contentGroup);
        updateTransform();
        console.log('Chart rendered successfully');
    } catch (error) {
        console.error('Error rendering chart:', error);
        showError('Error rendering chart: ' + error.message);
    }
}

function calculateLayout(nodes, width, height) {
    const defaultNodeWidth = 180; // Increased to fit more text
    const defaultNodeHeight = 60;
    const horizontalSpacing = 200;
    const verticalSpacing = 150;
    
    // Calculate node height based on content
    function getNodeHeight(node) {
        const manualPos = nodePositions.get(node.name);
        if (manualPos) return manualPos.height;
        
        const title = node.metadata && node.metadata.title ? node.metadata.title : '';
        const location = node.metadata && node.metadata.location ? node.metadata.location : '';
        let lines = 1; // Name is always shown
        if (title) lines++;
        if (location) lines++;
        
        // Base height + extra for each additional line
        return Math.max(defaultNodeHeight, 40 + (lines - 1) * 18);
    }
    
    const layoutNodes = [];
    const links = [];
    let yPosition = 100;

    function processNode(node, x, y, isRoot = false, currentDepth = 0) {
        // Check for manual position
        const manualPos = nodePositions.get(node.name);
        const finalX = manualPos ? manualPos.x : x;
        const finalY = manualPos ? manualPos.y : y;
        const nodeWidth = manualPos ? manualPos.width : defaultNodeWidth;
        const nodeHeight = manualPos ? manualPos.height : getNodeHeight(node);
        
        const layoutNode = {
            name: node.name,
            x: finalX,
            y: finalY,
            width: nodeWidth,
            height: nodeHeight,
            isRoot: isRoot
        };
        layoutNodes.push(layoutNode);

        // Check if we've reached max depth
        const nextDepth = currentDepth + 1;
        const shouldProcessChildren = node.children.length > 0 && (maxDepth === null || nextDepth < maxDepth);

        if (shouldProcessChildren) {
            const childCount = node.children.length;
            const totalWidth = (childCount - 1) * horizontalSpacing;
            const startX = finalX - totalWidth / 2;
            const childY = finalY + verticalSpacing;

            node.children.forEach((child, index) => {
                const childManualPos = nodePositions.get(child.name);
                const childX = childManualPos ? childManualPos.x : startX + index * horizontalSpacing;
                const childYPos = childManualPos ? childManualPos.y : childY;
                
                // Add link
                const childHeight = childManualPos ? childManualPos.height : getNodeHeight(child);
                links.push({
                    x1: finalX,
                    y1: finalY + nodeHeight / 2,
                    x2: childX,
                    y2: childYPos - childHeight / 2
                });

                processNode(child, startX + index * horizontalSpacing, childY, false, nextDepth);
            });
        }
    }

    // Process root nodes
    const rootCount = nodes.length;
    const rootTotalWidth = (rootCount - 1) * horizontalSpacing;
    const startX = width / 2 - rootTotalWidth / 2;

    nodes.forEach((node, index) => {
        const rootManualPos = nodePositions.get(node.name);
        const rootX = rootManualPos ? rootManualPos.x : (rootCount === 1 ? width / 2 : startX + index * horizontalSpacing);
        processNode(node, rootX, yPosition, true, 0);
    });

    // Prevent overlaps at each level
    const minSpacing = 20; // Minimum spacing between nodes at the same level
    const levelTolerance = 5; // Tolerance for considering nodes at the same level (same Y)
    
    // Group nodes by level (Y coordinate)
    const nodesByLevel = new Map();
    layoutNodes.forEach(node => {
        const levelKey = Math.round(node.y / levelTolerance) * levelTolerance;
        if (!nodesByLevel.has(levelKey)) {
            nodesByLevel.set(levelKey, []);
        }
        nodesByLevel.get(levelKey).push(node);
    });
    
    // Resolve overlaps at each level
    nodesByLevel.forEach((levelNodes, levelY) => {
        // Sort nodes by X position
        levelNodes.sort((a, b) => a.x - b.x);
        
        // Adjust positions to prevent overlaps
        for (let i = 1; i < levelNodes.length; i++) {
            const prevNode = levelNodes[i - 1];
            const currentNode = levelNodes[i];
            
            const prevRight = prevNode.x + prevNode.width / 2;
            const currentLeft = currentNode.x - currentNode.width / 2;
            const overlap = prevRight + minSpacing - currentLeft;
            
            if (overlap > 0) {
                // Shift current node to the right to prevent overlap
                currentNode.x += overlap;
            }
        }
    });

    // Adjust dimensions based on actual content - ensure it can exceed wrapper for scrolling
    const minX = Math.min(...layoutNodes.map(n => n.x - n.width / 2));
    const maxX = Math.max(...layoutNodes.map(n => n.x + n.width / 2));
    const minY = Math.min(...layoutNodes.map(n => n.y - n.height / 2));
    const maxY = Math.max(...layoutNodes.map(n => n.y + n.height / 2));
    
    const padding = 100;
    const adjustedWidth = Math.max(width, maxX - minX + padding * 2);
    const adjustedHeight = Math.max(height, maxY - minY + padding * 2);
    
    chartSvg.setAttribute('width', adjustedWidth);
    chartSvg.setAttribute('height', adjustedHeight);
    chartSvg.setAttribute('viewBox', `0 0 ${adjustedWidth} ${adjustedHeight}`);

    return { nodes: layoutNodes, links };
}

function findNodeByName(name) {
    return allNodesMap.get(name) || null;
}

function addNewNode() {
    if (!editMode) {
        alert('Please turn on Edit Layout mode to add a new node.');
        return;
    }
    if (!hierarchyData) return;

    // Ensure the new node is visible even if non-parents are hidden
    if (hideNonParentNodes) {
        hideNonParentNodes = false;
        if (hideNonParentsCheckbox) hideNonParentsCheckbox.checked = false;
    }

    const baseName = 'New Node';
    let index = 1;
    let newName = baseName;
    while (allNodesMap.has(newName)) {
        index += 1;
        newName = `${baseName} ${index}`;
    }

    if (csvHeaders.length === 0) {
        csvHeaders = ['name', 'parent_id'];
    }

    const metadata = {};
    csvHeaders.forEach(header => {
        const headerLower = header.toLowerCase();
        if (headerLower !== 'parent_id' &&
            headerLower !== 'name' &&
            headerLower !== 'position_x' &&
            headerLower !== 'position_y' &&
            headerLower !== 'node_color') {
            metadata[header] = '';
        }
    });

    const newNode = {
        name: newName,
        parentName: null,
        metadata: metadata,
        children: []
    };

    hierarchyData.push(newNode);
    allNodesMap.set(newName, newNode);

    const wrapperWidth = chartWrapper.clientWidth || 1200;
    const wrapperHeight = chartWrapper.clientHeight || 800;
    const centerX = (wrapperWidth / 2 - panX) / currentZoom;
    const centerY = (wrapperHeight / 2 - panY) / currentZoom;

    nodePositions.set(newName, {
        x: centerX,
        y: centerY,
        width: 180,
        height: 60
    });

    selectedNodeNames.clear();
    selectedNodeNames.add(newName);
    metadataPanelClosed = false;

    updateSelectedCount();
    renderChart();
    updateMetadataPanel();
}

function updateGraceDepthUI() {
    if (!graceDepthInput) return;
    const enabled = hideNonParentNodes;
    graceDepthInput.disabled = !enabled;
    if (graceDepthRow) {
        graceDepthRow.classList.toggle('grace-depth-disabled', !enabled);
    }
}

function updateChartWrapperHeight() {
    if (!chartWrapper) return;
    const height = editMode ? '600px' : '300px';
    chartWrapper.style.minHeight = height;
    chartWrapper.style.height = height;
}

function autoArrange() {
    if (!hierarchyData) return;
    
    // Clear all manual positions to start fresh
    nodePositions.clear();
    
    // Calculate layout parameters - tight spacing without overlap
    const wrapperWidth = chartWrapper.clientWidth || 1200;
    const wrapperHeight = chartWrapper.clientHeight || 800;
    const defaultNodeWidth = 180;
    const defaultNodeHeight = 60;
    const minHorizontalSpacing = 15; // Tight spacing between nodes at same level (reduced from 30)
    const verticalSpacing = 80; // Tight vertical spacing between levels (reduced from 120)
    const startY = 50;
    
    // Filter hierarchy to only visible nodes based on maxDepth and hideNonParentNodes
    function filterVisibleNodes(nodes, currentDepth = 0) {
        if (maxDepth !== null && currentDepth >= maxDepth) {
            return [];
        }
        
        return nodes.map(node => {
            const visibleChildren = filterVisibleNodes(node.children, currentDepth + 1);
            const filteredNode = {
                ...node,
                children: visibleChildren
            };
            
            // If hideNonParentNodes is enabled, only keep nodes that have visible children
            if (hideNonParentNodes) {
                const withinMaxDepth = maxDepth === null || currentDepth + 1 < maxDepth;
                
                if (!withinMaxDepth) {
                    return null; // Filter out this node
                }
                
                const hasDataChildren = node.children && node.children.length > 0;
                if (!hasDataChildren && currentDepth > nonParentGraceDepth) {
                    return null;
                }
            }
            
            return filteredNode;
        }).filter(node => node !== null); // Remove null entries
    }
    
    // Get only visible nodes
    const visibleHierarchy = filterVisibleNodes(hierarchyData);
    if (visibleHierarchy.length === 0) {
        renderChart();
        return;
    }
    
    // Calculate node height based on content
    function getNodeHeight(node) {
        const title = node.metadata && node.metadata.title ? node.metadata.title : '';
        const location = node.metadata && node.metadata.location ? node.metadata.location : '';
        let lines = 1; // Name is always shown
        if (title) lines++;
        if (location) lines++;
        return Math.max(defaultNodeHeight, 40 + (lines - 1) * 18);
    }
    
    // Calculate subtree widths (bottom-up) to determine spacing
    const subtreeWidths = new Map();
    
    function calculateSubtreeWidth(node, currentDepth = 0) {
        if (subtreeWidths.has(node.name)) {
            return subtreeWidths.get(node.name);
        }
        
        // Check if we've reached max depth - don't calculate for hidden nodes
        if (maxDepth !== null && currentDepth >= maxDepth) {
            const width = defaultNodeWidth;
            subtreeWidths.set(node.name, width);
            return width;
        }
        
        // Only consider visible children (already filtered)
        if (node.children.length === 0) {
            const width = defaultNodeWidth;
            subtreeWidths.set(node.name, width);
            return width;
        }
        
        // Calculate total width needed for all visible children with tight spacing
        let totalChildrenWidth = 0;
        node.children.forEach((child, index) => {
            totalChildrenWidth += calculateSubtreeWidth(child, currentDepth + 1);
            if (index < node.children.length - 1) {
                totalChildrenWidth += minHorizontalSpacing; // Tight spacing
            }
        });
        
        // Use max of node width or children width
        const width = Math.max(defaultNodeWidth, totalChildrenWidth);
        subtreeWidths.set(node.name, width);
        return width;
    }
    
    // Calculate widths for all subtrees (only visible nodes)
    visibleHierarchy.forEach(root => calculateSubtreeWidth(root, 0));
    
    // Position nodes (top-down) with balanced layout
    const levelYPositions = new Map();
    levelYPositions.set(0, startY);
    
    function positionNode(node, parentX, level, isRoot = false) {
        // Check if we've reached max depth
        if (maxDepth !== null && level >= maxDepth) {
            return;
        }
        
        const subtreeWidth = subtreeWidths.get(node.name);
        const nodeHeight = getNodeHeight(node);
        let nodeX, nodeY;
        
        if (isRoot) {
            // Position root nodes - center them horizontally (only visible roots)
            const rootIndex = visibleHierarchy.indexOf(node);
            let totalRootWidth = 0;
            visibleHierarchy.forEach((r, i) => {
                if (i < rootIndex) {
                    totalRootWidth += subtreeWidths.get(r.name) + minHorizontalSpacing;
                }
            });
            
            // Calculate total width of all visible roots
            let allRootsWidth = 0;
            visibleHierarchy.forEach(r => {
                allRootsWidth += subtreeWidths.get(r.name);
            });
            allRootsWidth += (visibleHierarchy.length - 1) * minHorizontalSpacing;
            
            // Center all roots
            const startX = (wrapperWidth - allRootsWidth) / 2;
            nodeX = startX + totalRootWidth + subtreeWidth / 2;
            nodeY = startY;
        } else {
            // Position child nodes - balance them around parent
            // Since we're working with filtered hierarchy, node.children already contains only visible children
            const siblings = node.parentName ? 
                (() => {
                    // Find parent in visible hierarchy to get visible siblings
                    function findParentInHierarchy(nodes, parentName) {
                        for (const n of nodes) {
                            if (n.name === parentName) return n;
                            const found = findParentInHierarchy(n.children, parentName);
                            if (found) return found;
                        }
                        return null;
                    }
                    const parentInHierarchy = findParentInHierarchy(visibleHierarchy, node.parentName);
                    return parentInHierarchy ? parentInHierarchy.children : [];
                })() : [];
            
            const childIndex = siblings.indexOf(node);
            
            // Calculate total width of all visible children
            let totalChildrenWidth = 0;
            siblings.forEach(sibling => {
                totalChildrenWidth += subtreeWidths.get(sibling.name);
            });
            totalChildrenWidth += (siblings.length - 1) * minHorizontalSpacing;
            
            // Center children around parent
            const childrenStartX = parentX - totalChildrenWidth / 2;
            let currentX = childrenStartX;
            
            // Find position for this child (only visible siblings)
            for (let i = 0; i < childIndex; i++) {
                const siblingWidth = subtreeWidths.get(siblings[i].name);
                currentX += siblingWidth + minHorizontalSpacing;
            }
            nodeX = currentX + subtreeWidth / 2;
            
            // Calculate Y based on level
            if (!levelYPositions.has(level)) {
                const parentLevel = level - 1;
                const parentY = levelYPositions.get(parentLevel) || startY;
                levelYPositions.set(level, parentY + verticalSpacing);
            }
            nodeY = levelYPositions.get(level);
        }
        
        // Store position
        nodePositions.set(node.name, {
            x: nodeX,
            y: nodeY,
            width: defaultNodeWidth,
            height: nodeHeight
        });
        
        // Position children recursively (node.children already contains only visible children from filtered hierarchy)
        if (maxDepth === null || level + 1 < maxDepth) {
            node.children.forEach(child => {
                positionNode(child, nodeX, level + 1, false);
            });
        }
    }
    
    // Position all root nodes (only visible)
    visibleHierarchy.forEach(root => {
        positionNode(root, 0, 0, true);
    });
    
    // Resolve overlaps at each level
    const levelTolerance = 5; // Tolerance for considering nodes at the same level
    const nodesByLevel = new Map();
    
    nodePositions.forEach((pos, nodeName) => {
        const levelKey = Math.round(pos.y / levelTolerance) * levelTolerance;
        if (!nodesByLevel.has(levelKey)) {
            nodesByLevel.set(levelKey, []);
        }
        nodesByLevel.get(levelKey).push({ name: nodeName, ...pos });
    });
    
    // Resolve overlaps at each level - make spacing as tight as possible
    nodesByLevel.forEach((levelNodes, levelY) => {
        // Sort nodes by X position
        levelNodes.sort((a, b) => a.x - b.x);
        
        // Adjust positions to prevent overlaps with minimal spacing
        for (let i = 1; i < levelNodes.length; i++) {
            const prevNode = levelNodes[i - 1];
            const currentNode = levelNodes[i];
            
            const prevRight = prevNode.x + prevNode.width / 2;
            const currentLeft = currentNode.x - currentNode.width / 2;
            const overlap = prevRight + minHorizontalSpacing - currentLeft;
            
            if (overlap > 0) {
                // Shift current node to the right to prevent overlap (tight spacing)
                currentNode.x += overlap;
                // Update stored position
                const storedPos = nodePositions.get(currentNode.name);
                if (storedPos) {
                    storedPos.x = currentNode.x;
                }
            } else {
                // If there's extra space, we could tighten it, but we'll leave it
                // to maintain balance. The minHorizontalSpacing ensures tight layout.
            }
        }
    });
    
    // Re-render chart with new positions
    renderChart();
}


function createResizeHandles(nodeName, width, height) {
    const handles = [];
    const handleSize = 8;
    const positions = [
        { x: -width/2, y: -height/2, cursor: 'nw-resize', name: 'nw' },
        { x: width/2, y: -height/2, cursor: 'ne-resize', name: 'ne' },
        { x: -width/2, y: height/2, cursor: 'sw-resize', name: 'sw' },
        { x: width/2, y: height/2, cursor: 'se-resize', name: 'se' }
    ];

    positions.forEach(pos => {
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        handle.setAttribute('x', pos.x - handleSize/2);
        handle.setAttribute('y', pos.y - handleSize/2);
        handle.setAttribute('width', handleSize);
        handle.setAttribute('height', handleSize);
        handle.setAttribute('class', 'resize-handle');
        handle.setAttribute('data-handle', pos.name);
        handle.setAttribute('data-node-name', nodeName);
        handle.style.cursor = pos.cursor;
        handle.style.fill = '#4caf50';
        handle.style.stroke = '#2e7d32';
        handle.style.strokeWidth = '1';
        
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            handleResizeStart(e, nodeName, pos.name);
        });
        
        handles.push(handle);
    });

    return handles;
}

function handleResizeStart(e, nodeName, handleName) {
    e.stopPropagation();
    e.preventDefault();
    isResizing = true;
    resizeHandle = handleName;
    
    const node = findNodeByName(nodeName);
    if (!node) return;
    
    // Get current position from the rendered node
    const nodeElement = chartSvg.querySelector(`[data-node-name="${nodeName}"]`);
    if (!nodeElement) return;
    
    const transform = nodeElement.getAttribute('transform');
    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
    if (!match) return;
    
    const currentX = parseFloat(match[1]);
    const currentY = parseFloat(match[2]);
    const rect = nodeElement.querySelector('.node-rect');
    const currentWidth = rect ? parseFloat(rect.getAttribute('width')) : 150;
    const currentHeight = rect ? parseFloat(rect.getAttribute('height')) : 60;
    
    // Get or create manual position
    const manualPos = nodePositions.get(nodeName) || { x: currentX, y: currentY, width: currentWidth, height: currentHeight };
    const startPos = getSVGPoint(e);
    const startWidth = manualPos.width;
    const startHeight = manualPos.height;
    const startX = manualPos.x;
    const startY = manualPos.y;

    const handleMouseMove = (e) => {
        const currentPos = getSVGPoint(e);
        const dx = currentPos.x - startPos.x;
        const dy = currentPos.y - startPos.y;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newX = startX;
        let newY = startY;
        
        const minSize = 80;
        
        if (handleName === 'se') {
            newWidth = Math.max(minSize, startWidth + dx);
            newHeight = Math.max(minSize, startHeight + dy);
        } else if (handleName === 'sw') {
            newWidth = Math.max(minSize, startWidth - dx);
            newHeight = Math.max(minSize, startHeight + dy);
            newX = startX + (startWidth - newWidth) / 2;
            newY = startY;
        } else if (handleName === 'ne') {
            newWidth = Math.max(minSize, startWidth + dx);
            newHeight = Math.max(minSize, startHeight - dy);
            newX = startX;
            newY = startY + (startHeight - newHeight) / 2;
        } else if (handleName === 'nw') {
            newWidth = Math.max(minSize, startWidth - dx);
            newHeight = Math.max(minSize, startHeight - dy);
            newX = startX + (startWidth - newWidth) / 2;
            newY = startY + (startHeight - newHeight) / 2;
        }
        
        nodePositions.set(nodeName, { x: newX, y: newY, width: newWidth, height: newHeight });
        renderChart();
    };

    const handleMouseUp = () => {
        isResizing = false;
        resizeHandle = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

// Helper function to get all descendants of a node
function getAllDescendants(nodeName) {
    const descendants = [];
    const node = findNodeByName(nodeName);
    if (!node) return descendants;
    
    function collectDescendants(currentNode) {
        currentNode.children.forEach(child => {
            descendants.push(child.name);
            collectDescendants(child);
        });
    }
    
    collectDescendants(node);
    return descendants;
}

function handleNodeMoveStart(e, nodeName) {
    e.stopPropagation();
    e.preventDefault();
    if (isResizing) return;
    
    // Check if this node is already being dragged
    if (activeDrags.has(nodeName)) return;
    
    // Set flag to indicate we're moving
    isMovingNode = true;
    
    const node = findNodeByName(nodeName);
    if (!node) return;
    
    // Get the node's current position from the rendered element
    const nodeElement = chartSvg.querySelector(`[data-node-name="${nodeName}"]`);
    if (!nodeElement) return;
    
    const transform = nodeElement.getAttribute('transform');
    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
    if (!match) return;
    
    const nodeCurrentX = parseFloat(match[1]);
    const nodeCurrentY = parseFloat(match[2]);
    
    // Get current size from stored position or calculate based on content
    const storedPos = nodePositions.get(nodeName);
    let nodeWidth = storedPos ? storedPos.width : 180;
    let nodeHeight = storedPos ? storedPos.height : 60;
    
    // If no stored position, calculate height based on content
    if (!storedPos && node.metadata) {
        const title = node.metadata.title ? node.metadata.title : '';
        const location = node.metadata.location ? node.metadata.location : '';
        let lines = 1; // Name
        if (title) lines++;
        if (location) lines++;
        nodeHeight = Math.max(60, 40 + (lines - 1) * 18);
    }
    
    // Get mouse position in SVG coordinates
    const mouseStartPos = getSVGPoint(e);
    
    // Calculate offset from mouse to node center
    const offsetX = mouseStartPos.x - nodeCurrentX;
    const offsetY = mouseStartPos.y - nodeCurrentY;
    
    // Store drag info for parent node
    activeDrags.set(nodeName, {
        element: nodeElement,
        offsetX: offsetX,
        offsetY: offsetY,
        width: nodeWidth,
        height: nodeHeight
    });
    
    // Get all descendants and store their relative positions
    const descendants = getAllDescendants(nodeName);
    const parentPos = nodePositions.get(nodeName) || { x: nodeCurrentX, y: nodeCurrentY };
    
    descendants.forEach(descName => {
        const descPos = nodePositions.get(descName);
        if (descPos) {
            // Calculate relative position to parent
            const relativeX = descPos.x - parentPos.x;
            const relativeY = descPos.y - parentPos.y;
            
            // Get descendant element
            const descElement = chartSvg.querySelector(`[data-node-name="${descName}"]`);
            if (descElement) {
                activeDrags.set(descName, {
                    element: descElement,
                    offsetX: offsetX, // Same offset as parent
                    offsetY: offsetY, // Same offset as parent
                    width: descPos.width,
                    height: descPos.height,
                    relativeX: relativeX, // Store relative position
                    relativeY: relativeY
                });
            }
        }
    });

    const handleMouseMove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const currentMousePos = getSVGPoint(e);
        
        // Calculate new parent position
        const newParentX = currentMousePos.x - offsetX;
        const newParentY = currentMousePos.y - offsetY;
        
        // Update parent node position
        nodePositions.set(nodeName, {
            x: newParentX,
            y: newParentY,
            width: nodeWidth,
            height: nodeHeight
        });
        
        // Update parent visual position
        if (nodeElement) {
            nodeElement.setAttribute('transform', `translate(${newParentX}, ${newParentY})`);
            nodeElement.classList.add('dragging');
        }
        
        // Update all descendants relative to parent
        descendants.forEach(descName => {
            const dragInfo = activeDrags.get(descName);
            if (dragInfo && dragInfo.relativeX !== undefined && dragInfo.relativeY !== undefined) {
                // Calculate new position maintaining relative offset
                const newX = newParentX + dragInfo.relativeX;
                const newY = newParentY + dragInfo.relativeY;
                
                // Update descendant position
                nodePositions.set(descName, {
                    x: newX,
                    y: newY,
                    width: dragInfo.width,
                    height: dragInfo.height
                });
                
                // Update visual position
                if (dragInfo.element) {
                    dragInfo.element.setAttribute('transform', `translate(${newX}, ${newY})`);
                    dragInfo.element.classList.add('dragging');
                }
            }
        });
    };

    const handleMouseUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const finalMousePos = getSVGPoint(e);
        const finalParentX = finalMousePos.x - offsetX;
        const finalParentY = finalMousePos.y - offsetY;
        
        // Update parent node final position
        nodePositions.set(nodeName, {
            x: finalParentX,
            y: finalParentY,
            width: nodeWidth,
            height: nodeHeight
        });
        
        // Remove dragging class from parent
        if (nodeElement) {
            nodeElement.classList.remove('dragging');
        }
        
        // Update all descendants with final positions
        descendants.forEach(descName => {
            const dragInfo = activeDrags.get(descName);
            if (dragInfo && dragInfo.relativeX !== undefined && dragInfo.relativeY !== undefined) {
                const finalX = finalParentX + dragInfo.relativeX;
                const finalY = finalParentY + dragInfo.relativeY;
                
                nodePositions.set(descName, {
                    x: finalX,
                    y: finalY,
                    width: dragInfo.width,
                    height: dragInfo.height
                });
                
                // Remove dragging class
                if (dragInfo.element) {
                    dragInfo.element.classList.remove('dragging');
                }
            }
        });
        
        // DISABLED: Check if parent was dropped on another node to change parent relationship
        // This functionality has been disabled - dragging nodes will only reposition them, not change parent relationships
        // const targetNode = findNodeAtPoint(finalParentX, finalParentY, nodeName);
        // if (targetNode && targetNode !== nodeName) {
        //     changeParent(nodeName, targetNode);
        // }
        
        // Clear all active drags and reset moving flag
        activeDrags.clear();
        isMovingNode = false;
        
        // Remove event listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Re-render to update links
        renderChart();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

function selectNodeSingle(nodeName) {
    // Single selection - replace current selection
    selectedNodeNames.clear();
    selectedNodeNames.add(nodeName);
    isMultiSelectMode = false;
    // Show metadata panel if it was closed and we're in edit mode
    if (metadataPanelClosed && editMode) {
        metadataPanelClosed = false;
        if (metadataPanel) metadataPanel.style.display = 'flex';
    }
    updateMetadataPanel();
    updateSelectedCount();
    renderChart();
}

function toggleNodeSelection(nodeName, add = true) {
    // Toggle node selection (for multi-select)
    if (add) {
        selectedNodeNames.add(nodeName);
        console.log('Added node to selection:', nodeName, 'Total selected:', selectedNodeNames.size);
        // Show metadata panel if it was closed and we're in edit mode
        if (metadataPanelClosed && editMode) {
            metadataPanelClosed = false;
            if (metadataPanel) metadataPanel.style.display = 'flex';
        }
    } else {
        selectedNodeNames.delete(nodeName);
        console.log('Removed node from selection:', nodeName, 'Total selected:', selectedNodeNames.size);
    }
    updateMetadataPanel();
    updateSelectedCount();
    renderChart();
}

function updateSelectedCount() {
    if (selectedCountSpan) {
        selectedCountSpan.textContent = selectedNodeNames.size;
    }
}

function selectNode(nodeName) {
    // Legacy function - use selectNodeSingle for single selection
    selectNodeSingle(nodeName);
}

function updateMetadataPanel() {
    // Don't update if panel is closed or if not in edit mode
    if (metadataPanelClosed || !editMode) {
        return;
    }
    
    // Show/hide metadata panel based on whether nodes are selected
    if (metadataPanel) {
        if (selectedNodeNames.size === 0) {
            // Hide panel when no nodes are selected
            metadataPanel.style.display = 'none';
            return;
        } else {
            // Show panel when nodes are selected
            metadataPanel.style.display = 'flex';
        }
    }
    
    if (selectedNodeNames.size === 0) {
        metadataContent.innerHTML = '<p class="no-selection">Click on a node to view/edit details<br><small>Click and hold to select multiple nodes</small></p>';
        if (selectedNodeColorInput) {
            selectedNodeColorInput.value = globalNodeColor;
        }
        return;
    }

    // For single selection, show full metadata panel
    if (selectedNodeNames.size === 1) {
        const nodeName = Array.from(selectedNodeNames)[0];
        const node = allNodesMap.get(nodeName);
        if (!node) return;
        
        updateSingleNodeMetadataPanel(node, nodeName);
    } else {
        // For multiple selection, show simplified panel
        updateMultiNodeMetadataPanel();
    }
}

function updateSingleNodeMetadataPanel(node, nodeName) {

    const form = document.createElement('form');
    form.className = 'metadata-form';
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveNodeMetadata(node.name);
    });

    // Name field
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    nameGroup.innerHTML = `
        <label for="node-name">Name *</label>
        <input type="text" id="node-name" value="${escapeHtml(node.name)}" required>
    `;
    form.appendChild(nameGroup);

    // Parent Name field (with dropdown)
    const parentGroup = document.createElement('div');
    parentGroup.className = 'form-group';
    const parentSelect = document.createElement('select');
    parentSelect.id = 'node-parent';
    parentSelect.innerHTML = '<option value="">-- Root Node --</option>';
    
    // Add all other nodes as potential parents (sorted ascending)
    const parentOptions = [];
    allNodesMap.forEach((n, name) => {
        if (name !== node.name && !isDescendant(node.name, name)) {
            parentOptions.push({ name: name, label: n.name });
        }
    });
    
    parentOptions
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
        .forEach(option => {
            parentSelect.innerHTML += `<option value="${escapeHtml(option.name)}" ${node.parentName === option.name ? 'selected' : ''}>${escapeHtml(option.label)}</option>`;
        });
    
    parentGroup.innerHTML = '<label for="node-parent">Parent</label>';
    parentGroup.appendChild(parentSelect);
    form.appendChild(parentGroup);

    // Metadata fields (exclude position_x, position_y, node_color, phone, email - these are handled separately or hidden)
    csvHeaders.forEach(header => {
        const headerLower = header.toLowerCase();
        if (headerLower !== 'parent_id' && 
            headerLower !== 'name' && 
            headerLower !== 'position_x' && 
            headerLower !== 'position_y' && 
            headerLower !== 'node_color' &&
            headerLower !== 'phone' &&
            headerLower !== 'email') {
            const group = document.createElement('div');
            group.className = 'form-group';
            const value = node.metadata[header] || '';
            // Capitalize label (especially for title and location)
            const labelText = headerLower === 'title' ? 'Title' : 
                             headerLower === 'location' ? 'Location' : 
                             header.charAt(0).toUpperCase() + header.slice(1);
            group.innerHTML = `
                <label for="meta-${header}">${escapeHtml(labelText)}</label>
                <input type="text" id="meta-${header}" value="${escapeHtml(value)}">
            `;
            form.appendChild(group);
        }
    });

    // Display total descendants count (non-editable)
    const descendantsCount = getAllDescendants(nodeName).length;
    const descendantsGroup = document.createElement('div');
    descendantsGroup.className = 'form-group';
    descendantsGroup.style.marginTop = '15px';
    descendantsGroup.style.paddingTop = '15px';
    descendantsGroup.style.borderTop = '1px solid #e0e0e0';
    descendantsGroup.innerHTML = `
        <label style="font-weight: 600; color: #555;">Total Descendants</label>
        <div style="padding: 8px 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; color: #333;">
            ${descendantsCount}
        </div>
    `;
    form.appendChild(descendantsGroup);

    // Form actions
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    actions.innerHTML = `
        <button type="submit" class="btn btn-success">Save</button>
        <button type="button" class="btn" onclick="deleteNode('${escapeHtml(node.name)}')">Delete</button>
    `;
    form.appendChild(actions);

    metadataContent.innerHTML = '';
    metadataContent.appendChild(form);
    
    // Update selected node color input
    if (selectedNodeColorInput) {
        // First check if node has a custom color set
        if (nodeColors.has(nodeName)) {
            selectedNodeColorInput.value = nodeColors.get(nodeName);
        } else {
            selectedNodeColorInput.value = globalNodeColor;
        }
    }
}

function updateMultiNodeMetadataPanel() {
    // Show simplified panel for multiple selections
    const info = document.createElement('div');
    info.className = 'multi-selection-info';
    
    const nodeList = Array.from(selectedNodeNames).map(name => {
        const node = allNodesMap.get(name);
        return node ? escapeHtml(name) : name;
    }).join(', ');
    
    info.innerHTML = `
        <h4>${selectedNodeNames.size} Node${selectedNodeNames.size > 1 ? 's' : ''} Selected</h4>
        <p><strong>Selected:</strong> ${nodeList}</p>
        <p style="margin-top: 15px;"><small>💡 Use the color picker above to change colors for all selected nodes.</small></p>
        <p style="margin-top: 10px;"><small>Click on empty space to deselect all, or click and hold on nodes to add more.</small></p>
    `;
    
    // Update color input to show color of first selected node
    if (selectedNodeColorInput) {
        // Get the first selected node (Sets maintain insertion order)
        const firstNodeName = Array.from(selectedNodeNames)[0];
        if (firstNodeName) {
            // Get the color of the first selected node, or use global default
            const firstNodeColor = nodeColors.get(firstNodeName);
            selectedNodeColorInput.value = firstNodeColor || globalNodeColor;
        } else {
            // Fallback to global color if no nodes (shouldn't happen)
            selectedNodeColorInput.value = globalNodeColor;
        }
    }
    
    metadataContent.innerHTML = '';
    metadataContent.appendChild(info);
}

function isDescendant(ancestorName, nodeName) {
    const node = allNodesMap.get(nodeName);
    if (!node || !node.parentName) return false;
    if (node.parentName === ancestorName) return true;
    return isDescendant(ancestorName, node.parentName);
}

function saveNodeMetadata(nodeName) {
    const node = allNodesMap.get(nodeName);
    if (!node) return;

    // Update name (if changed, need to update map key)
    const nameInput = document.getElementById('node-name');
    if (nameInput) {
        const newName = nameInput.value.trim();
        const oldName = node.name;
        if (newName !== oldName && newName) {
            // Name changed - update map key
            allNodesMap.delete(oldName);
            node.name = newName;
            allNodesMap.set(newName, node);
            
            // Update selection
            if (selectedNodeNames.has(oldName)) {
                selectedNodeNames.delete(oldName);
                selectedNodeNames.add(newName);
            }
            
            // Update parent references in all children
            allNodesMap.forEach(n => {
                if (n.parentName === oldName) {
                    n.parentName = newName;
                }
            });
            
            // Update position map key
            if (nodePositions.has(oldName)) {
                const pos = nodePositions.get(oldName);
                nodePositions.delete(oldName);
                nodePositions.set(newName, pos);
            }
            
            // Update color map key
            if (nodeColors.has(oldName)) {
                const color = nodeColors.get(oldName);
                nodeColors.delete(oldName);
                nodeColors.set(newName, color);
            }
            
            updateSelectedCount();
        }
    }

    // Update parent
    const parentSelect = document.getElementById('node-parent');
    if (parentSelect) {
        const newParentName = parentSelect.value || null;
        if (newParentName !== node.parentName) {
            changeParent(node.name, newParentName);
        }
    }

    // Update metadata (exclude position_x, position_y, node_color, phone, email - these are handled separately or hidden)
    csvHeaders.forEach(header => {
        const headerLower = header.toLowerCase();
        if (headerLower !== 'parent_id' && 
            headerLower !== 'name' && 
            headerLower !== 'position_x' && 
            headerLower !== 'position_y' && 
            headerLower !== 'node_color' &&
            headerLower !== 'phone' &&
            headerLower !== 'email') {
            const input = document.getElementById(`meta-${header}`);
            if (input) {
                node.metadata[header] = input.value.trim();
            }
        }
    });

    renderChart();
}

function changeParent(nodeName, newParentName) {
    const node = allNodesMap.get(nodeName);
    if (!node) return;

    // Remove from old parent
    if (node.parentName) {
        const oldParent = allNodesMap.get(node.parentName);
        if (oldParent) {
            oldParent.children = oldParent.children.filter(c => c.name !== nodeName);
        }
    } else {
        // Remove from root nodes
        hierarchyData = hierarchyData.filter(n => n.name !== nodeName);
    }

    // Add to new parent
    node.parentName = newParentName;
    if (newParentName) {
        const newParent = allNodesMap.get(newParentName);
        if (newParent) {
            newParent.children.push(node);
        }
    } else {
        hierarchyData.push(node);
    }

    renderChart();
}

function deleteNode(nodeName) {
    if (!confirm('Are you sure you want to delete this node? All children will become root nodes.')) {
        return;
    }

    const node = allNodesMap.get(nodeName);
    if (!node) return;

    // Move children to root
    node.children.forEach(child => {
        child.parentName = null;
        hierarchyData.push(child);
    });

    // Remove from parent
    if (node.parentName) {
        const parent = allNodesMap.get(node.parentName);
        if (parent) {
            parent.children = parent.children.filter(c => c.name !== nodeName);
        }
    } else {
        hierarchyData = hierarchyData.filter(n => n.name !== nodeName);
    }

    // Remove from map and positions
    allNodesMap.delete(nodeName);
    nodePositions.delete(nodeName);
    nodeColors.delete(nodeName);
    selectedNodeNames.delete(nodeName);

    updateMetadataPanel();
    updateSelectedCount();
    renderChart();
}

// This function is replaced by handleNodeMoveStart - keeping for compatibility but not used

function getSVGPoint(event) {
    const pt = chartSvg.createSVGPoint();
    const rect = chartSvg.getBoundingClientRect();
    
    // Get point in screen coordinates
    pt.x = event.clientX - rect.left;
    pt.y = event.clientY - rect.top;
    
    // Transform to SVG coordinates accounting for pan and zoom
    const contentGroup = chartSvg.querySelector('.chart-content');
    if (contentGroup) {
        const ctm = contentGroup.getScreenCTM();
        if (ctm && ctm.a !== 0 && ctm.d !== 0) {
            // Inverse transform: from screen to SVG coordinates
            pt.x = (pt.x - ctm.e) / ctm.a;
            pt.y = (pt.y - ctm.f) / ctm.d;
        }
    }
    
    return pt;
}

function findNodeAtPoint(x, y, excludeName) {
    const contentGroup = chartSvg.querySelector('.chart-content');
    if (!contentGroup) return null;

    const nodes = contentGroup.querySelectorAll('.node');
    for (const nodeEl of nodes) {
        const nodeName = nodeEl.getAttribute('data-node-name');
        if (nodeName === excludeName) continue;

        const transform = nodeEl.getAttribute('transform');
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (match) {
            const nodeX = parseFloat(match[1]);
            const nodeY = parseFloat(match[2]);
            const rect = nodeEl.querySelector('.node-rect');
            const nodeWidth = rect ? parseFloat(rect.getAttribute('width')) : 150;
            const nodeHeight = rect ? parseFloat(rect.getAttribute('height')) : 60;

            if (x >= nodeX - nodeWidth/2 && x <= nodeX + nodeWidth/2 &&
                y >= nodeY - nodeHeight/2 && y <= nodeY + nodeHeight/2) {
                return nodeName;
            }
        }
    }
    return null;
}

function updateTransform() {
    const contentGroup = chartSvg.querySelector('g.chart-content');
    if (contentGroup) {
        const transform = `translate(${panX}, ${panY}) scale(${currentZoom})`;
        contentGroup.setAttribute('transform', transform);
    }
}

function centerChart() {
    if (!hierarchyData || hierarchyData.length === 0) return;
    
    // Get the wrapper dimensions (visible viewport)
    const wrapperWidth = chartWrapper.clientWidth || chartWrapper.offsetWidth || 1600;
    const wrapperHeight = chartWrapper.clientHeight || 800;
    
    // Get the content group
    const contentGroup = chartSvg.querySelector('g.chart-content');
    if (!contentGroup) return;
    
    // Find all root nodes
    const rootNodes = contentGroup.querySelectorAll('.node.root');
    if (rootNodes.length === 0) return;
    
    // Calculate the center position of root nodes
    let rootCenterX = 0;
    let rootCenterY = 0;
    let rootCount = 0;
    
    rootNodes.forEach(node => {
        const transform = node.getAttribute('transform');
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (match) {
            const nodeX = parseFloat(match[1]);
            const nodeY = parseFloat(match[2]);
            rootCenterX += nodeX;
            rootCenterY += nodeY;
            rootCount++;
        }
    });
    
    if (rootCount === 0) return;
    
    // Calculate average center of root nodes
    rootCenterX = rootCenterX / rootCount;
    rootCenterY = rootCenterY / rootCount;
    
    // Calculate center of viewport (wrapper) - this is what's visible
    const viewportCenterX = wrapperWidth / 2;
    const viewportCenterY = wrapperHeight / 2;
    
    // The transform is: translate(panX, panY) scale(zoom)
    // After transform, a point (x, y) in SVG coordinates becomes: (x * zoom + panX, y * zoom + panY) in screen coordinates
    // To center the root nodes: rootCenterX * zoom + panX = viewportCenterX
    // So: panX = viewportCenterX - rootCenterX * zoom
    panX = viewportCenterX - rootCenterX * currentZoom;
    panY = viewportCenterY - rootCenterY * currentZoom;
    
    updateTransform();
}

function downloadChart() {
    // Prevent downloading when edit mode is ON
    if (editMode) {
        alert('Please turn off Edit Layout mode before downloading the chart.');
        return;
    }
    if (!hierarchyData) return;

    // Clone the SVG to avoid modifying the original
    const svgClone = chartSvg.cloneNode(true);
    
    // Get all computed styles and inline them
    const allElements = svgClone.querySelectorAll('*');
    allElements.forEach(element => {
        const computedStyle = window.getComputedStyle(element);
        
        // For rect elements (nodes), preserve fill and stroke
        if (element.tagName === 'rect' && element.classList.contains('node-rect')) {
            const fill = element.getAttribute('fill');
            const stroke = element.getAttribute('stroke');
            const strokeWidth = element.getAttribute('stroke-width') || '2';
            
            if (fill) element.setAttribute('fill', fill);
            if (stroke) element.setAttribute('stroke', stroke);
            element.setAttribute('stroke-width', strokeWidth);
            element.setAttribute('rx', '8');
        }
        
        // For text elements, preserve font properties
        if (element.tagName === 'text') {
            const fontSize = element.getAttribute('font-size') || computedStyle.fontSize;
            const fontFamily = element.getAttribute('font-family') || computedStyle.fontFamily;
            const fill = element.getAttribute('fill') || computedStyle.fill || '#ffffff';
            const fontWeight = element.getAttribute('font-weight') || computedStyle.fontWeight;
            
            element.setAttribute('font-size', fontSize);
            element.setAttribute('font-family', fontFamily);
            element.setAttribute('fill', fill);
            if (fontWeight) element.setAttribute('font-weight', fontWeight);
        }
        
        // For line elements (links), ensure marker-end and stroke are set
        if (element.tagName === 'line' && element.classList.contains('link')) {
            if (!element.getAttribute('marker-end')) {
                element.setAttribute('marker-end', 'url(#arrowhead)');
            }
            if (!element.getAttribute('stroke')) {
                element.setAttribute('stroke', '#999');
            }
            if (!element.getAttribute('stroke-width')) {
                element.setAttribute('stroke-width', '2');
            }
            element.setAttribute('fill', 'none');
        }
    });
    
    // Ensure defs with marker is included
    if (!svgClone.querySelector('defs')) {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3, 0 6');
        polygon.setAttribute('fill', '#999');
        marker.appendChild(polygon);
        defs.appendChild(marker);
        svgClone.insertBefore(defs, svgClone.firstChild);
    }
    
    // Add a style block with essential CSS
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
        .link {
            stroke: #999;
            stroke-width: 2;
            fill: none;
            marker-end: url(#arrowhead);
        }
        .node rect {
            stroke-width: 2;
            rx: 8;
        }
        .node text {
            fill: white;
            text-anchor: middle;
            dominant-baseline: middle;
            pointer-events: none;
        }
    `;
    
    // Insert style after defs
    const defs = svgClone.querySelector('defs');
    if (defs) {
        defs.appendChild(style);
    } else {
        const newDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        newDefs.appendChild(style);
        svgClone.insertBefore(newDefs, svgClone.firstChild);
    }
    
    // Serialize the cloned SVG
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = 'hierarchy-chart.svg';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    URL.revokeObjectURL(svgUrl);
}

function saveCSV() {
    // Prevent saving when edit mode is ON
    if (editMode) {
        alert('Please turn off Edit Layout mode before saving the CSV.');
        return;
    }
    if (!hierarchyData || csvHeaders.length === 0) return;

    // Collect all nodes in flat array
    const allNodes = [];
    function collectNodes(nodes) {
        nodes.forEach(node => {
            allNodes.push(node);
            if (node.children.length > 0) {
                collectNodes(node.children);
            }
        });
    }
    collectNodes(hierarchyData);

    // Build CSV - ensure name and parent_id columns exist
    const headersToUse = csvHeaders.filter(h => {
        const hLower = h.toLowerCase();
        return hLower !== 'id' && hLower !== 'position_x' && hLower !== 'position_y' && hLower !== 'node_color';
    });
    if (headersToUse.indexOf('name') === -1) headersToUse.unshift('name');
    if (headersToUse.indexOf('parent_id') === -1) {
        const nameIndex = headersToUse.indexOf('name');
        headersToUse.splice(nameIndex + 1, 0, 'parent_id');
    }
    
    // Add position and color columns at the end
    if (headersToUse.indexOf('position_x') === -1) headersToUse.push('position_x');
    if (headersToUse.indexOf('position_y') === -1) headersToUse.push('position_y');
    if (headersToUse.indexOf('node_color') === -1) headersToUse.push('node_color');
    
    const rows = [headersToUse.join(',')];
    
    allNodes.forEach(node => {
        const row = [];
        headersToUse.forEach(header => {
            const headerLower = header.toLowerCase();
            if (headerLower === 'parent_id') {
                row.push(escapeCSV(node.parentName || ''));
            } else if (headerLower === 'name') {
                row.push(escapeCSV(node.name));
            } else if (headerLower === 'position_x') {
                const pos = nodePositions.get(node.name);
                row.push(escapeCSV(pos ? pos.x.toString() : ''));
            } else if (headerLower === 'position_y') {
                const pos = nodePositions.get(node.name);
                row.push(escapeCSV(pos ? pos.y.toString() : ''));
            } else if (headerLower === 'node_color') {
                const color = nodeColors.get(node.name);
                row.push(escapeCSV(color || ''));
            } else {
                row.push(escapeCSV(node.metadata[header] || ''));
            }
        });
        rows.push(row.join(','));
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'hierarchy-export.csv';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    URL.revokeObjectURL(url);
}

function escapeCSV(value) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    chartContainer.style.display = 'none';
}

function adjustColorBrightness(color, amount) {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Adjust brightness
    const newR = Math.max(0, Math.min(255, r + amount));
    const newG = Math.max(0, Math.min(255, g + amount));
    const newB = Math.max(0, Math.min(255, b + amount));
    
    // Convert back to hex
    return '#' + [newR, newG, newB].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Make deleteNode available globally
window.deleteNode = deleteNode;

// Initialize transform on load
window.addEventListener('load', () => {
    updateTransform();
    // Ensure chart wrapper has dimensions
    if (chartWrapper) {
        chartWrapper.style.width = '100%';
        updateChartWrapperHeight();
    }
    // Hide metadata panel initially (only shown in edit mode)
    if (metadataPanel) {
        metadataPanel.style.display = 'none';
    }
    // Initialize style controls
    if (globalNodeColorInput) globalNodeColorInput.value = globalNodeColor;
    if (fontFamilySelect) fontFamilySelect.value = fontFamily;
    if (fontSizeInput) fontSizeInput.value = fontSize;
    if (hideNonParentsCheckbox) hideNonParentsCheckbox.checked = hideNonParentNodes;
    updateGraceDepthUI();
    if (graceDepthInput) graceDepthInput.value = String(nonParentGraceDepth);
    // Initialize Save CSV button state (enabled when edit mode is OFF)
    if (saveCSVBtn) {
        saveCSVBtn.disabled = editMode;
        saveCSVBtn.style.opacity = editMode ? '0.5' : '1';
        saveCSVBtn.style.cursor = editMode ? 'not-allowed' : 'pointer';
    }
    // Initialize Download Chart button state (enabled when edit mode is OFF)
    if (downloadChartBtn) {
        downloadChartBtn.disabled = editMode;
        downloadChartBtn.style.opacity = editMode ? '0.5' : '1';
        downloadChartBtn.style.cursor = editMode ? 'not-allowed' : 'pointer';
    }
    updateSelectedCount();
});

// Also initialize on DOMContentLoaded for faster initialization
document.addEventListener('DOMContentLoaded', () => {
    if (chartWrapper) {
        chartWrapper.style.width = '100%';
        updateChartWrapperHeight();
    }
    // Hide metadata panel initially (only shown in edit mode)
    if (metadataPanel) {
        metadataPanel.style.display = 'none';
    }
    // Initialize style controls
    if (globalNodeColorInput) globalNodeColorInput.value = globalNodeColor;
    if (fontFamilySelect) fontFamilySelect.value = fontFamily;
    if (fontSizeInput) fontSizeInput.value = fontSize;
    if (hideNonParentsCheckbox) hideNonParentsCheckbox.checked = hideNonParentNodes;
    updateGraceDepthUI();
    if (graceDepthInput) graceDepthInput.value = String(nonParentGraceDepth);
    // Initialize Save CSV button state (enabled when edit mode is OFF)
    if (saveCSVBtn) {
        saveCSVBtn.disabled = editMode;
        saveCSVBtn.style.opacity = editMode ? '0.5' : '1';
        saveCSVBtn.style.cursor = editMode ? 'not-allowed' : 'pointer';
    }
    // Initialize Download Chart button state (enabled when edit mode is OFF)
    if (downloadChartBtn) {
        downloadChartBtn.disabled = editMode;
        downloadChartBtn.style.opacity = editMode ? '0.5' : '1';
        downloadChartBtn.style.cursor = editMode ? 'not-allowed' : 'pointer';
    }
    updateSelectedCount();
});
