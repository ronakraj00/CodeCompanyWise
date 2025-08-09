
let questionsData = [];
let completedQuestions = new Set();
let chart = null;
let doughnutChart = null;
let lineChart = null;
let savedFiles = new Map(); // Store saved files with their data and progress
let currentFileName = '';
let currentFileData = null;
let currentQuestionsPage = 1;
const QUESTIONS_PER_PAGE = 10; // Number of questions per page in the table
function getPageKey(fileName) {
    return 'leetcode_page_' + fileName;
}

// Check if localStorage is available, fallback to cookies if not
function isLocalStorageAvailable() {
    try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
    } catch (e) {
        return false;
    }
}

// Storage wrapper that works with localStorage or cookies
const persistentStorage = {
    setItem: function(key, value) {
        if (isLocalStorageAvailable()) {
            localStorage.setItem(key, value);
        } else {
            // Fallback to cookies for long-term storage
            const expires = new Date();
            expires.setTime(expires.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year
            document.cookie = `${key}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`;
        }
    },
    
    getItem: function(key) {
        if (isLocalStorageAvailable()) {
            const val = localStorage.getItem(key);
            if (val !== null) return val;
        } 
    },
    
    removeItem: function(key) {
        if (isLocalStorageAvailable()) {
            localStorage.removeItem(key);
        }
    }
};

// Load completed questions and saved files
function loadCompletedQuestions() {
    try {
        const saved = persistentStorage.getItem('leetcode_completed_' + currentFileName);
        if (saved) {
            // Always store as string
            completedQuestions = new Set(JSON.parse(saved).map(id => id != null ? String(id) : id));
        } else {
            completedQuestions = new Set();
        }
    } catch (e) {
        console.log('No saved progress found for', currentFileName);
        completedQuestions = new Set();
    }
}

// Save completed questions
function saveCompletedQuestions() {
    if (currentFileName) {
        try {
            persistentStorage.setItem('leetcode_completed_' + currentFileName, JSON.stringify([...completedQuestions].map(id => id != null ? String(id) : id)));
            
            // Also update the saved file's progress
            if (savedFiles.has(currentFileName)) {
                const fileInfo = savedFiles.get(currentFileName);
                fileInfo.progress = [...completedQuestions].map(id => id != null ? String(id) : id);
                fileInfo.lastUpdated = new Date().toISOString();
                saveSavedFiles();
            }
        } catch (e) {
            console.error('Error saving progress:', e);
        }
    }
}

// Load saved files from persistent storage
function loadSavedFiles() {
    try {
        const saved = persistentStorage.getItem('leetcode_saved_files');
        if (saved) {
            const filesArray = JSON.parse(saved);
            savedFiles = new Map(filesArray);
            displaySavedFiles();
        }
    } catch (e) {
        console.log('No saved files found');
        savedFiles = new Map();
    }
}

// Save files to persistent storage
function saveSavedFiles() {
    try {
        persistentStorage.setItem('leetcode_saved_files', JSON.stringify([...savedFiles]));
    } catch (e) {
        console.error('Error saving files:', e);
    }
}

// Add this mapping function before any CSV parsing logic:
function mapCSVRow(row, idx) {
    // Normalize keys: trim whitespace from all keys
    const cleanRow = {};
    for (const key in row) {
        if (Object.hasOwn(row, key)) {
            cleanRow[key.trim()] = row[key];
        }
    }
    // Normalize difficulty
    let difficulty = (cleanRow['Difficulty'] || '').toLowerCase();
    if (difficulty === 'easy') difficulty = 'Easy';
    else if (difficulty === 'medium') difficulty = 'Medium';
    else if (difficulty === 'hard') difficulty = 'Hard';
    else difficulty = '';

    // Format acceptance rate as percentage string
    let acceptance = '';
    if (cleanRow['Acceptance Rate'] !== undefined && cleanRow['Acceptance Rate'] !== '') {
        let val = parseFloat(cleanRow['Acceptance Rate']);
        if (!isNaN(val)) acceptance = (val * 100).toFixed(1) + '%';
    }

    // Always set ID as a string
    return {
        ID: String(idx + 1),
        Title: cleanRow['Title'] || '',
        Acceptance: acceptance,
        Difficulty: difficulty,
        Frequency: cleanRow['Frequency'] || '',
        'Leetcode Question Link': cleanRow['Leetcode Question Link'] || cleanRow['Link'] || '',
        Topics: cleanRow['Topics'] || ''
    };
}

document.getElementById('csvFile').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        // Update button text to show selected file
        const wrapper = document.querySelector('.file-input-wrapper span');
        wrapper.textContent = `Selected: ${file.name}`;
        
        // Show save button and set default file name
        document.getElementById('saveFileBtn').style.display = 'inline-block';
        document.getElementById('fileNameInput').value = file.name.replace('.csv', '');
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: function(results) {
                // Map to internal format
                currentFileData = results.data.map(mapCSVRow);
                questionsData = currentFileData;
                // Remove .csv and any leading numbers/dots/spaces
                currentFileName = file.name.replace('.csv', '').replace(/^\d+\.\s*/, '');
                updateCurrentFileDisplay();
                loadCompletedQuestions();
                updateDisplay();
                showSections();
            },
            error: function(error) {
                alert('Error parsing CSV: ' + error.message);
                // Reset button text on error
                wrapper.textContent = 'Select File';
                document.getElementById('saveFileBtn').style.display = 'none';
            }
        });
    }
});

// Save file button event
document.getElementById('saveFileBtn').addEventListener('click', function() {
    const customName = document.getElementById('fileNameInput').value.trim();
    if (!customName) {
        alert('Please enter a file name');
        return;
    }
    
    if (!currentFileData) {
        alert('No file data to save');
        return;
    }

    // Check if name already exists
    const existingNames = [...savedFiles.keys()];
    if (existingNames.includes(customName)) {
        if (!confirm('A file with this name already exists. Do you want to replace it?')) {
            return;
        }
    }

    // Save the file
    savedFiles.set(customName, {
        data: currentFileData,
        progress: [...completedQuestions],
        uploadDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        originalName: document.getElementById('csvFile').files[0]?.name || 'Unknown'
    });

    currentFileName = customName;
    saveSavedFiles();
    displaySavedFiles();
    
    // Hide save button after saving
    document.getElementById('saveFileBtn').style.display = 'none';
    alert('File saved successfully!');

    // Update last selected file
    persistentStorage.setItem('leetcode_last_selected_file', customName);
});

function displaySavedFiles() {
    const container = document.getElementById('savedFilesList');
    const section = document.getElementById('savedFilesSection');
    if (!container || !section) return;
    if (savedFiles.size === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    container.innerHTML = '';
    
    [...savedFiles.entries()].forEach(([fileName, fileInfo]) => {
        const loadBtn = document.createElement('button');
        loadBtn.className = 'saved-file-btn' + (currentFileName === fileName ? ' active' : '');
        loadBtn.onclick = () => loadSavedFile(fileName);

        // Show completed/total
        const total = fileInfo.data ? fileInfo.data.length : 0;
        function capitalizeWords(str) {
            return str.replace(/\b\w/g, c => c.toUpperCase());
        }
        function addSpaceBeforeYear(str) {
            // Replace underscores with spaces for display
            str = str.replace(/_/g, ' ');
            // Add a space before a 4-digit year at the end of the string, e.g., 'Summer2023' -> 'Summer 2023'
            str = str.replace(/(\D)(\d{4})$/, '$1 $2');
            // Add a space between numbers and letters (e.g., 6months -> 6 Months, 1year -> 1 Year)
            str = str.replace(/(\d+)([a-zA-Z]+)/g, '$1 $2');
            // Special case: Alltime -> All Time
            str = str.replace(/Alltime/i, 'All Time');
            // Special case: 6months -> 6 Months, 1year -> 1 Year (already handled by previous regex, but ensure capitalization)
            return str;
        }
        let completed = 0;
        if (fileInfo.progress && fileInfo.data) {
            // Only count as completed those IDs that exist in the file's questions
            const validIds = new Set(fileInfo.data.filter(q => q.ID != null).map(q => q.ID.toString()));
            completed = fileInfo.progress.filter(id => validIds.has(id?.toString())).length;
        }
        let displayName = addSpaceBeforeYear(capitalizeWords(fileName));

        const contentSpan = document.createElement('span');
        contentSpan.style.cssText = 'display: flex; flex-direction: column; text-align: left; width: 100%; gap: 4px;';
        contentSpan.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 6px;">
                <span>📄</span>
                <span style="word-break: break-word;">${displayName}</span>
            </div>
            <span class="saved-file-progress-pill" style="margin-top: 10px; width:fit-content">${completed} / ${total}</span>
        `;
        loadBtn.appendChild(contentSpan);

        // Three-dots menu
        const menuActions = document.createElement('div');
        menuActions.className = 'file-actions';
        const menuBtn = document.createElement('button');
        menuBtn.className = 'file-menu-btn';
        menuBtn.innerHTML = '⋯';
        menuBtn.title = 'File actions';
        menuActions.appendChild(menuBtn);
        // Popover
        const menuPopover = document.createElement('div');
        menuPopover.className = 'file-menu-popover';
        menuPopover.innerHTML = `<button class="file-menu-item" type="button">Delete</button>`;
        menuActions.appendChild(menuPopover);

        // Show/hide popover logic
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            // Close all other popovers
            document.querySelectorAll('.file-menu-popover').forEach(pop => pop.classList.remove('show'));
            menuPopover.classList.toggle('show');
            // Add a one-time event listener to close on outside click
            function closeMenu(e) {
                if (!menuActions.contains(e.target)) {
                    menuPopover.classList.remove('show');
                    document.removeEventListener('mousedown', closeMenu);
                }
            }
            setTimeout(() => {
                document.addEventListener('mousedown', closeMenu);
            }, 0);
        };

        // Delete action
        menuPopover.querySelector('.file-menu-item').onclick = (e) => {
            e.stopPropagation();
            menuPopover.classList.remove('show');
            deleteSavedFile(fileName);
        };

        loadBtn.appendChild(menuActions);
        container.appendChild(loadBtn);
    });
}

function loadSavedFile(fileName) {
    if (!savedFiles.has(fileName)) {
        alert('File not found');
        return;
    }
    
    const fileInfo = savedFiles.get(fileName);
    questionsData = fileInfo.data;
    currentFileName = fileName;
    currentFileData = fileInfo.data;
    completedQuestions = new Set((fileInfo.progress || []).map(id => id != null ? String(id) : id));
    
    // Restore page for this file
    const savedPage = persistentStorage.getItem(getPageKey(fileName));
    if (savedPage && !isNaN(Number(savedPage))) {
        currentQuestionsPage = Number(savedPage);
    } else {
        currentQuestionsPage = 1;
    }
    updateDisplay();
    showSections();
    displaySavedFiles(); // Update active state
    
    // Update file input display
    const wrapper = document.querySelector('.file-input-wrapper span');
    wrapper.textContent = 'Select File';
    document.getElementById('saveFileBtn').style.display = 'none';

    // Update last selected file
    persistentStorage.setItem('leetcode_last_selected_file', fileName);
    updateCurrentFileDisplay();
}

async function deleteSavedFile(fileName) {
    if (await confirm(`Are you sure you want to delete "${fileName}"? This cannot be undone.`)) {
        savedFiles.delete(fileName);
        persistentStorage.removeItem('leetcode_completed_' + fileName);
        saveSavedFiles();
        displaySavedFiles();
        
        // If we deleted the currently active file, clear the display
        if (currentFileName === fileName) {
            currentFileName = '';
            currentFileData = null;
            questionsData = [];
            completedQuestions.clear();
            hideSections();
            const wrapper = document.querySelector('.file-input-wrapper span');
            wrapper.textContent = 'Select File';
        }

        // If the deleted file was the last selected, remove the key
        if (currentFileName === fileName) {
            persistentStorage.removeItem('leetcode_last_selected_file');
        }
        updateCurrentFileDisplay();
    }
}

function showSections() {
    document.getElementById('statsSection').classList.remove('collapsed');
    document.getElementById('chartSection').classList.remove('collapsed');
    document.getElementById('controlsSection').classList.remove('collapsed');
    document.getElementById('questionsSection').classList.remove('collapsed');
}

function hideSections() {
    document.getElementById('statsSection').classList.add('collapsed');
    document.getElementById('chartSection').classList.add('collapsed');
    document.getElementById('controlsSection').classList.add('collapsed');
    document.getElementById('questionsSection').classList.add('collapsed');
}

function updateDisplay() {
    updateStats();
    updateChart();
    renderQuestions();
}

function updateStats() {
    const total = questionsData.length;
    // Only count as completed those IDs that exist in the current questionsData
    const validIds = new Set(questionsData.filter(q => q.ID != null).map(q => q.ID.toString()));
    const completed = Array.from(completedQuestions).filter(id => validIds.has(id?.toString())).length;
    const easy = questionsData.filter(q => q.Difficulty === 'Easy').length;
    const medium = questionsData.filter(q => q.Difficulty === 'Medium').length;
    const hard = questionsData.filter(q => q.Difficulty === 'Hard').length;

    document.getElementById('totalCount').textContent = total;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('easyCount').textContent = easy;
    document.getElementById('mediumCount').textContent = medium;
    document.getElementById('hardCount').textContent = hard;
}

function getThemeVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function updateChart() {
    const ctx = document.getElementById('progressChart').getContext('2d');
    const doughnutCtx = document.getElementById('doughnutChart').getContext('2d');
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    const easyColor = getThemeVar('--accent2');
    const mediumColor = getThemeVar('--accent3');
    const hardColor = getThemeVar('--accent4');
    const accentColor = getThemeVar('--accent');
    const cardBg = getThemeVar('--bg-card');
    const borderMain = getThemeVar('--border-main');
    const textMuted = getThemeVar('--text-muted');
    const textMain = getThemeVar('--text-main');
    const easyTotal = questionsData.filter(q => q.Difficulty === 'Easy').length;
    const mediumTotal = questionsData.filter(q => q.Difficulty === 'Medium').length;
    const hardTotal = questionsData.filter(q => q.Difficulty === 'Hard').length;
    const easyCompleted = questionsData.filter(q => 
        q.Difficulty === 'Easy' && q.ID != null && completedQuestions.has(q.ID.toString())
    ).length;
    const mediumCompleted = questionsData.filter(q => 
        q.Difficulty === 'Medium' && q.ID != null && completedQuestions.has(q.ID.toString())
    ).length;
    const hardCompleted = questionsData.filter(q => 
        q.Difficulty === 'Hard' && q.ID != null && completedQuestions.has(q.ID.toString())
    ).length;

    if (chart) chart.destroy();
    if (doughnutChart) doughnutChart.destroy();
    if (lineChart) lineChart.destroy();

    // Bar Chart
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Easy', 'Medium', 'Hard'],
            datasets: [
                {
                    label: 'Completed',
                    data: [easyCompleted, mediumCompleted, hardCompleted],
                    backgroundColor: [easyColor, mediumColor, hardColor],
                    borderRadius: 16,
                    borderSkipped: false,
                    barPercentage: 0.55,
                    categoryPercentage: 0.55,
                    borderWidth: 0,
                },
                {
                    label: 'Remaining',
                    data: [easyTotal - easyCompleted, mediumTotal - mediumCompleted, hardTotal - hardCompleted],
                    backgroundColor: [accentColor, accentColor, accentColor],
                    borderRadius: 16,
                    borderSkipped: false,
                    barPercentage: 0.55,
                    categoryPercentage: 0.55,
                    borderWidth: 0,
                }
            ]
        },
        options: {
            responsive: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textMuted,
                        font: { family: 'inherit', size: 13, weight: 500 },
                        boxWidth: 16,
                        boxHeight: 16,
                        padding: 18
                    }
                },
                title: {
                    display: false
                },
                tooltip: {
                    backgroundColor: cardBg,
                    titleColor: textMain,
                    bodyColor: textMain,
                    borderColor: borderMain,
                    borderWidth: 1,
                    padding: 12,
                    caretSize: 6,
                    cornerRadius: 8
                }
            },
            layout: {
                padding: 10
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: textMuted,
                        font: { family: 'inherit', size: 13 }
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: {
                        color: borderMain,
                        borderColor: borderMain,
                        drawBorder: false,
                        lineWidth: 1.2
                    },
                    ticks: {
                        color: textMuted,
                        font: { family: 'inherit', size: 13 },
                        stepSize: 1
                    }
                }
            }
        }
    });

    // Doughnut Chart
    doughnutChart = new Chart(doughnutCtx, {
        type: 'doughnut',
        data: {
            labels: ['Easy', 'Medium', 'Hard'],
            datasets: [{
                data: [easyCompleted, mediumCompleted, hardCompleted],
                backgroundColor: [easyColor, mediumColor, hardColor],
                borderColor: borderMain,
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textMuted,
                        font: { family: 'inherit', size: 13 }
                    }
                },
                tooltip: {
                    backgroundColor: cardBg,
                    titleColor: textMain,
                    bodyColor: textMain,
                    borderColor: borderMain,
                    borderWidth: 1,
                }
            }
        }
    });

    // Line Chart (Cumulative Progress Over Time)
    // Build a timeline of completion
    let progressTimeline = [];
    if (questionsData.length > 0 && savedFiles.has(currentFileName)) {
        const fileInfo = savedFiles.get(currentFileName);
        if (fileInfo.progressHistory) {
            progressTimeline = fileInfo.progressHistory;
        } else if (fileInfo.progress) {
            // Fallback: just show current progress as a flat line
            progressTimeline = [{ date: fileInfo.lastUpdated || fileInfo.uploadDate, completed: fileInfo.progress.length }];
        }
    }
    // If no timeline, show a flat line
    if (progressTimeline.length === 0) {
        progressTimeline = [{ date: new Date().toISOString(), completed: easyCompleted + mediumCompleted + hardCompleted }];
    }
    // Format for chart.js
    const lineLabels = progressTimeline.map(p => new Date(p.date).toLocaleDateString());
    const lineData = progressTimeline.map(p => p.completed);
    lineChart = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: lineLabels,
            datasets: [{
                label: 'Cumulative Completed',
                data: lineData,
                fill: true,
                borderColor: accentColor,
                backgroundColor: accentColor + '22', // 13% opacity
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: accentColor,
                pointBorderColor: borderMain,
                pointHoverRadius: 5,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: cardBg,
                    titleColor: textMain,
                    bodyColor: textMain,
                    borderColor: borderMain,
                    borderWidth: 1,
                }
            },
            scales: {
                x: {
                    grid: { color: borderMain, drawBorder: false },
                    ticks: { color: textMuted, font: { family: 'inherit', size: 12 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: borderMain, drawBorder: false },
                    ticks: { color: textMuted, font: { family: 'inherit', size: 12 } }
                }
            }
        }
    });
}

function renderQuestions() {
    // Restore page for current file if available
    if (currentFileName) {
        const savedPage = persistentStorage.getItem(getPageKey(currentFileName));
        if (savedPage && !isNaN(Number(savedPage))) {
            currentQuestionsPage = Number(savedPage);
        }
    }
    const container = document.getElementById('questionsContainer');
    const difficultyFilter = document.getElementById('difficultyFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    const hideDifficulty = document.getElementById('hideDifficultyCheckbox').checked;
    const hideId = document.getElementById('hideIdCheckbox')?.checked;
    const hideAcceptance = document.getElementById('hideAcceptanceCheckbox')?.checked;
    const hideFrequency = document.getElementById('hideFrequencyCheckbox')?.checked;

    let filteredQuestions = questionsData.filter(question => {
        const idStr = question.ID != null ? String(question.ID) : '';
        const matchesDifficulty = !difficultyFilter || question.Difficulty === difficultyFilter;
        const isCompleted = idStr && completedQuestions.has(idStr);
        const matchesStatus = !statusFilter || 
            (statusFilter === 'completed' && isCompleted) ||
            (statusFilter === 'pending' && !isCompleted);
        const matchesSearch = !searchQuery || 
            (question.Title && question.Title.toLowerCase().includes(searchQuery)) ||
            (idStr && idStr.includes(searchQuery));

        return matchesDifficulty && matchesStatus && matchesSearch;
    });

    // Paging logic
    const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE));
    if (currentQuestionsPage > totalPages) currentQuestionsPage = totalPages;
    const startIdx = (currentQuestionsPage - 1) * QUESTIONS_PER_PAGE;
    const endIdx = startIdx + QUESTIONS_PER_PAGE;
    const pageQuestions = filteredQuestions.slice(startIdx, endIdx);

    if (filteredQuestions.length === 0) {
        container.innerHTML = '<div class="no-data">No questions match your filters.</div>';
        return;
    }

    const maxFrequency = Math.max(...questionsData.map(q => q.Frequency || 0));

    const tableHTML = `
        <div class="questions-table-scroll">
            <table>
                <thead>
                    <tr>
                        <th>✓</th>
                        ${!hideId ? '<th>ID</th>' : ''}
                        <th>Title</th>
                        ${!hideDifficulty ? '<th>Difficulty</th>' : ''}
                        ${!hideAcceptance ? '<th>Acceptance</th>' : ''}
                        ${!hideFrequency ? '<th>Frequency</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${pageQuestions.map(question => {
                        const idStr = question.ID != null ? String(question.ID) : '';
                        const isCompleted = idStr && completedQuestions.has(idStr);
                        const frequencyWidth = maxFrequency > 0 ? (question.Frequency / maxFrequency) * 100 : 0;
                        
                        return `
                            <tr class="${isCompleted ? 'question-row-completed' : ''}">
                                <td><label class="checkbox-label"><input type="checkbox" class="checkbox" 
                                            ${isCompleted ? 'checked' : ''} 
                                            onchange="toggleQuestion('${idStr}')"></label></td>
                                ${!hideId ? `<td class="question-id">${idStr}</td>` : ''}
                                <td><a href="${question['Leetcode Question Link']}" target="_blank" class="question-title">${question.Title || ''}</a></td>
                                ${!hideDifficulty ? `<td>
                                    <span class="difficulty-badge difficulty-${question.Difficulty ? question.Difficulty.toLowerCase() : ''}">
                                        ${question.Difficulty || ''}
                                    </span>
                                </td>` : ''}
                                ${!hideAcceptance ? `<td class="acceptance-rate">${question.Acceptance || ''}</td>` : ''}
                                ${!hideFrequency ? `<td>
                                    <div class="frequency-bar">
                                        <div class="frequency-fill" style="width: ${frequencyWidth}%"></div>
                                    </div>
                                </td>` : ''}
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    // Pagination controls
    let paginationHTML = '';
    if (totalPages > 1) {
        paginationHTML = '<div class="pagination">';
        paginationHTML += `<button class="pagination-btn" ${currentQuestionsPage === 1 ? 'disabled' : ''} onclick="window.changeQuestionsPage(${currentQuestionsPage - 1})">Prev</button>`;
        // Always show page 1
        paginationHTML += `<button class="pagination-btn${currentQuestionsPage === 1 ? ' active' : ''}" onclick="window.changeQuestionsPage(1)">1</button>`;
        // Ellipsis after 1 if needed
        if (currentQuestionsPage > 4) {
            paginationHTML += `<span style='padding:0 6px;color:var(--text-muted);user-select:none;'>...</span>`;
        }
        // Pages around current
        for (let i = Math.max(2, currentQuestionsPage - 2); i <= Math.min(totalPages - 1, currentQuestionsPage + 2); i++) {
            paginationHTML += `<button class="pagination-btn${i === currentQuestionsPage ? ' active' : ''}" onclick="window.changeQuestionsPage(${i})">${i}</button>`;
        }
        // Ellipsis before last if needed
        if (currentQuestionsPage < totalPages - 3) {
            paginationHTML += `<span style='padding:0 6px;color:var(--text-muted);user-select:none;'>...</span>`;
        }
        // Always show last page if more than 1
        if (totalPages > 1) {
            paginationHTML += `<button class="pagination-btn${currentQuestionsPage === totalPages ? ' active' : ''}" onclick="window.changeQuestionsPage(${totalPages})">${totalPages}</button>`;
        }
        paginationHTML += `<button class="pagination-btn" ${currentQuestionsPage === totalPages ? 'disabled' : ''} onclick="window.changeQuestionsPage(${currentQuestionsPage + 1})">Next</button>`;
        paginationHTML += '</div>';
    }
    container.innerHTML = tableHTML + paginationHTML;
}

function toggleQuestion(id) {
    if (id == null) return;
    const idStr = String(id);
    if (completedQuestions.has(idStr)) {
        completedQuestions.delete(idStr);
    } else {
        completedQuestions.add(idStr);
    }
    saveCompletedQuestions();
    updateDisplay();
}

async function resetProgress() {
    if (await confirm('Are you sure you want to reset progress for the current file? This cannot be undone.')) {
        completedQuestions.clear();
        saveCompletedQuestions();
        updateDisplay();
    }
}

function exportProgress() {
    if (!currentFileName) {
        alert('No file is currently loaded');
        return;
    }
    
    const exportData = {
        fileName: currentFileName,
        completedQuestions: [...completedQuestions],
        exportDate: new Date().toISOString(),
        totalQuestions: questionsData.length
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `leetcode_progress_${currentFileName}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
}

async function importProgress() {
    if (!currentFileName) {
        alert('Please load a file first before importing progress');
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const importData = JSON.parse(e.target.result);
                    if (importData.completedQuestions && Array.isArray(importData.completedQuestions)) {
                        if (await confirm(`Import ${importData.completedQuestions.length} completed questions? This will replace your current progress.`)) {
                            completedQuestions = new Set(importData.completedQuestions);
                            saveCompletedQuestions();
                            updateDisplay();
                            alert('Progress imported successfully!');
                        }
                    } else {
                        alert('Invalid progress file format');
                    }
                } catch (error) {
                    alert('Error reading progress file: ' + error.message);
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

// Add event listeners for filters
document.getElementById('difficultyFilter').addEventListener('change', renderQuestions);
document.getElementById('statusFilter').addEventListener('change', renderQuestions);
document.getElementById('searchInput').addEventListener('input', renderQuestions);
document.getElementById('hideDifficultyCheckbox').addEventListener('change', function() {
    const difficultyFilter = document.getElementById('difficultyFilter');
    difficultyFilter.disabled = this.checked;
    if (this.checked) {
        difficultyFilter.value = '';
    }
    persistentStorage.setItem('leetcode_hide_difficulty', String(this.checked));
    renderQuestions();
});
document.getElementById('hideIdCheckbox').addEventListener('change', function() {
    persistentStorage.setItem('leetcode_hide_id', String(this.checked));
    renderQuestions();
});
document.getElementById('hideAcceptanceCheckbox').addEventListener('change', function() {
    persistentStorage.setItem('leetcode_hide_acceptance', String(this.checked));
    renderQuestions();
});
document.getElementById('hideFrequencyCheckbox').addEventListener('change', function() {
    persistentStorage.setItem('leetcode_hide_frequency', String(this.checked));
    renderQuestions();
});

// Initialize
loadSavedFiles();
displaySavedFiles();

// Restore hide difficulty state
const hideDifficultySaved = persistentStorage.getItem('leetcode_hide_difficulty') === 'true';
const hideCheckbox = document.getElementById('hideDifficultyCheckbox');
const difficultyFilterInput = document.getElementById('difficultyFilter');
hideCheckbox.checked = hideDifficultySaved;
difficultyFilterInput.disabled = hideDifficultySaved;
if (hideDifficultySaved) {
    difficultyFilterInput.value = '';
}

// Restore hide states on load
const hideIdSaved = persistentStorage.getItem('leetcode_hide_id') === 'true';
const hideAcceptanceSaved = persistentStorage.getItem('leetcode_hide_acceptance') === 'true';
const hideFrequencySaved = persistentStorage.getItem('leetcode_hide_frequency') === 'true';
document.getElementById('hideIdCheckbox').checked = hideIdSaved;
document.getElementById('hideAcceptanceCheckbox').checked = hideAcceptanceSaved;
document.getElementById('hideFrequencyCheckbox').checked = hideFrequencySaved;

// Collapsible section toggling
window.addEventListener('DOMContentLoaded', function() {
    // Ensure only Questions List is open by default
    document.getElementById('statsSection').classList.add('collapsed');
    document.getElementById('chartSection').classList.add('collapsed');
    document.getElementById('controlsSection').classList.add('collapsed');
    document.getElementById('questionsSection').classList.remove('collapsed');
    // Collapsible logic
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', function() {
            const section = header.closest('.collapsible-section');
            section.classList.toggle('collapsed');
        });
        header.setAttribute('tabindex', '0');
        header.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                header.click();
            }
        });
    });
    // Advanced features toggle (with null check)
    const adv = document.getElementById('advancedFeatures');
    if (adv) {
        const advHeader = adv.querySelector('.advanced-header');
        if (advHeader) {
            advHeader.addEventListener('click', function() {
                adv.classList.toggle('collapsed');
            });
            advHeader.setAttribute('tabindex', '0');
            advHeader.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    advHeader.click();
                }
            });
        }
    }
});

// After displaySavedFiles() in initialization, add:
const lastFile = persistentStorage.getItem('leetcode_last_selected_file');
if (lastFile && savedFiles.has(lastFile)) loadSavedFile(lastFile);

// Add JS for modal, search, GitHub API fetch, and CSV loading:
(function() {
    const githubBtn = document.getElementById('githubBrowseBtn');
    const modal = document.getElementById('githubModal');
    let companyFolders = [];
    let csvList = [];
    let filteredList = [];
    let currentView = 'companies'; // or 'csvs'
    let selectedCompany = null;
    let funMessageInterval;

    const ICONS = {
        folder: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>`,
        file: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>`,
        backArrow: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>`
    };

    function closeModal() {
        document.body.classList.remove('modal-open');
        document.documentElement.classList.remove('modal-open');
        modal.style.display = 'none';
        modal.innerHTML = '';
        currentView = 'companies';
        selectedCompany = null;
        if (funMessageInterval) clearInterval(funMessageInterval);
    }
    
    function buildModal(title, showSearch, showBack) {
        document.body.classList.add('modal-open');
        document.documentElement.classList.add('modal-open');
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal">
                    <div class="github-modal-header">
                        <button class="modal-close" title="Close">&times;</button>
                        <h2>${title}</h2>
                    </div>
                    <div id="github-modal-content-wrapper"></div>
                </div>
            </div>
        `;
        modal.classList.add('github-modal');
        modal.style.display = 'block';

        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.modal-overlay').onclick = e => { if (e.target === modal.querySelector('.modal-overlay')) closeModal(); };

        const contentWrapper = document.getElementById('github-modal-content-wrapper');
        let contentHtml = '';
        if (showBack) {
            contentHtml += `
                <div class="github-modal-search-wrapper" style="background:var(--bg-card) !important; border-bottom:none; padding-bottom:0;">
                    <button class="back-btn" style="background:var(--bg-card) !important;" id="backToCompanies">
                        ${ICONS.backArrow}
                        <span>Back to Companies</span>
                    </button>
                </div>
            `;
        }
        if (showSearch) {
            contentHtml += `
                <div class="github-modal-search-wrapper">
                    <input class="github-modal-search" id="github-search-input" placeholder="Search..." />
                </div>
            `;
        }
        contentHtml += '<div class="modal-list"></div>';
        contentWrapper.innerHTML = contentHtml;

        if (showBack) {
            document.getElementById('backToCompanies').onclick = () => fetchAndShowCompanies(false);
        }
    }

    function renderLoading(messages) {
        const contentWrapper = document.getElementById('github-modal-content-wrapper');
        if (!contentWrapper) return;

        let msgIdx = 0;
        contentWrapper.innerHTML = `
            <div class="modal-loading">
                <div class="spinner"></div>
                <span id="fun-message">${messages[msgIdx]}</span>
            </div>
        `;
        
        if (funMessageInterval) clearInterval(funMessageInterval);
        funMessageInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % messages.length;
            const msgEl = document.getElementById('fun-message');
            if (msgEl) msgEl.textContent = messages[msgIdx];
        }, 1800);
    }

    function renderCompanyList(query) {
        const listContainer = modal.querySelector('.modal-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        filteredList = companyFolders.filter(f => f.name.toLowerCase().includes(query.toLowerCase()));
        if (filteredList.length === 0) {
            listContainer.innerHTML = '<div style="padding: 18px; color: #a1a1aa; text-align:center;">No companies found.</div>';
            return;
        }
        filteredList.forEach(f => {
            const item = document.createElement('div');
            item.className = 'modal-list-item';
            item.tabIndex = 0;
            item.innerHTML = `
                ${ICONS.folder}
                <div>
                    <strong>${f.name.replace(/_/g, ' ')}</strong>
                </div>
            `;
            item.onclick = () => {
                selectedCompany = f.name.replace(/_/g, ' ');
                fetchCSVsForCompany(f.url, selectedCompany);
            };
            item.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') item.onclick(); };
            listContainer.appendChild(item);
        });
    }

    function renderCSVList(query) {
        const listContainer = modal.querySelector('.modal-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        filteredList = csvList.filter(f => f.period.toLowerCase().includes(query.toLowerCase()));
        if (filteredList.length === 0) {
            listContainer.innerHTML = '<div style="padding: 18px; color: #a1a1aa; text-align:center;">No lists found.</div>';
            return;
        }
        filteredList.forEach(f => {
            const item = document.createElement('div');
            item.className = 'modal-list-item';
            item.tabIndex = 0;
            item.innerHTML = `
                ${ICONS.file}
                <div>
                    <strong>${f.period}</strong>
                    <div class="modal-list-item-desc">${f.description}</div>
                </div>
            `;
            item.onclick = () => selectCSV(f);
            item.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') selectCSV(f); };
            listContainer.appendChild(item);
        });
    }

    let GITHUB_TOKEN = null;
    async function getGithubToken() {
        if (GITHUB_TOKEN) return GITHUB_TOKEN;
        try {
            const res = await fetch('https://portfolio-api-dwyy.onrender.com/api/github-token');
            const data = await res.json();
            if (data.token) {
                GITHUB_TOKEN = data.token;
                return GITHUB_TOKEN;
            } else { throw new Error('Token not found in response'); }
        } catch (e) {
            throw new Error('Failed to fetch GitHub token: ' + (e.message || e));
        }
    }

    async function fetchCompanyFolders() {
        try {
            const token = await getGithubToken();
            const rootUrl = 'https://api.github.com/repos/liquidslr/leetcode-company-wise-problems/contents';
            const rootRes = await fetch(rootUrl, { headers: { 'Authorization': `token ${token}` } });
            if (!rootRes.ok) throw new Error('GitHub API error: ' + rootRes.status);
            const rootFiles = await rootRes.json();
            companyFolders = rootFiles.filter(f => f.type === 'dir');
            return true;
        } catch (err) {
            companyFolders = [];
            return err.message || 'Unknown error';
        }
    }
    
    async function fetchAndShowCompanies(isFirstLoad) {
        if (isFirstLoad) {
            buildModal('Browse Companies', false, false);
            renderLoading([
                "Grepping the GitHub firehose...",
                "Polishing our DSA skills...",
                "Brewing coffee for the code crawl...",
                "Asking an AI for interview tips..."
            ]);
            const result = await fetchCompanyFolders();
            if (funMessageInterval) clearInterval(funMessageInterval);
            if (result !== true) {
                modal.querySelector('.modal-loading').innerHTML = `<h2>Error</h2><p>${result}</p>`;
                return;
            }
        }
        
        buildModal('Browse Companies', true, false);
        modal.querySelector('#github-search-input').oninput = e => renderCompanyList(e.target.value);
        modal.querySelector('#github-search-input').placeholder = 'Search companies...';
        renderCompanyList('');
    }

    async function fetchCSVsForCompany(folderUrl, company) {
        buildModal(`Lists for ${company}`, true, true);
        renderLoading([
            "Sorting CSVs by date...",
            "Finding the latest question list...",
            "Preparing your practice session..."
        ]);

        try {
            const token = await getGithubToken();
            const folderRes = await fetch(folderUrl, { headers: { 'Authorization': `token ${token}` } });
            if (!folderRes.ok) throw new Error('GitHub API error: ' + folderRes.status);
            const folderFiles = await folderRes.json();
            if (funMessageInterval) clearInterval(funMessageInterval);

            csvList = folderFiles.filter(f => f.name.endsWith('.csv')).map(f => {
                const periodDescription = getPeriodDescription(f.name);
                return {
                    name: f.name,
                    download_url: f.download_url,
                    company: company,
                    period: periodDescription.label,
                    description: periodDescription.description
                };
            });
            
            buildModal(`Lists for ${company}`, true, true);
            modal.querySelector('#github-search-input').oninput = e => renderCSVList(e.target.value);
            modal.querySelector('#github-search-input').placeholder = 'Search by period (e.g., 6 months)...';
            renderCSVList('');
        } catch (err) {
            if (funMessageInterval) clearInterval(funMessageInterval);
            modal.querySelector('.modal-list').innerHTML = `<div style="padding:18px; color:var(--accent4);">${err.message || 'Unknown error'}</div>`;
        }
    }

    function getPeriodDescription(period) {
        const periodLower = period.toLowerCase().trim();
        
        // Convert common period names to descriptive labels based on actual API response
        if (periodLower.includes('thirty days') || periodLower.includes('30 days') || periodLower.includes('30day')) {
            return {
                label: 'Last 30 Days',
                description: 'Questions asked in the past 30 days'
            };
        } else if (periodLower.includes('three months') || periodLower.includes('3 months') || periodLower.includes('3month')) {
            return {
                label: 'Last 3 Months',
                description: 'Questions asked in the past 3 months'
            };
        } else if (periodLower.includes('more than six months') || periodLower.includes('6 months') || periodLower.includes('6month')) {
            return {
                label: 'More Than 6 Months',
                description: 'Questions asked in more than past 6 months ago'
            };
        } else if (periodLower.includes('six months') || periodLower.includes('more than 6 months')) {
            return {
                label: 'Last 6 Months',
                description: 'Questions asked in the past 6 months'
            };
        } else if (periodLower.includes('all') && !periodLower.includes('more than')) {
            return {
                label: 'All Time',
                description: 'All questions ever asked by this company'
            };
        } else if (periodLower.includes('one year') || periodLower.includes('1 year') || periodLower.includes('year') || periodLower.includes('12months')) {
            return {
                label: 'Last 1 Year',
                description: 'Questions asked in the past year'
            };
        } else if (periodLower.includes('two months') || periodLower.includes('2 months') || periodLower.includes('2month')) {
            return {
                label: 'Last 2 Months',
                description: 'Questions asked in the past 2 months'
            };
        } else if (periodLower.includes('four months') || periodLower.includes('4 months') || periodLower.includes('4month')) {
            return {
                label: 'Last 4 Months',
                description: 'Questions asked in the past 4 months'
            };
        } else if (periodLower.includes('nine months') || periodLower.includes('9 months') || periodLower.includes('9month')) {
            return {
                label: 'Last 9 Months',
                description: 'Questions asked in the past 9 months'
            };
        } else {
            // For any other period, format it nicely and try to extract time information
            // Remove numbered prefixes like "1. ", "2. " etc.
            const cleanPeriod = period.replace(/^\d+\.\s*/, '').replace('.csv', '');
            const formattedPeriod = cleanPeriod.replace(/(\d+)([a-zA-Z]+)/g, '$1 $2').replace(/\b\w/g, l => l.toUpperCase());
            return {
                label: formattedPeriod,
                description: 'Questions from this time period'
            };
        }
    }

    githubBtn.onclick = () => fetchAndShowCompanies(true);
    
    async function selectCSV(file) {
        // Don't close the modal, just change its content to the download progress UI.
        // This keeps the backdrop and scroll-lock active.
        const headerTitle = modal.querySelector('.github-modal-header h2');
        if(headerTitle) headerTitle.textContent = 'Downloading...';

        const contentWrapper = modal.querySelector('#github-modal-content-wrapper');
        if (contentWrapper) {
            contentWrapper.innerHTML = `
                <div class="modal-loading" style="justify-content:flex-start; padding-top:24px;">
                    <h2 style="font-size:1.1em; margin-top:0;">${file.period} list for ${file.company}</h2>
                    <div class="progress-bar" style="height: 24px; width: 100%; max-width: 300px;">
                        <div class="progress-fill" id="downloadProgressFill" style="width: 0%; transition: width 0.1s linear;"></div>
                    </div>
                    <div id="downloadProgressText" style="margin-top: 12px; color: var(--text-muted);">0%</div>
                </div>
            `;
        } else {
            // Fallback for safety, though it shouldn't be needed with the new structure.
            closeModal();
            document.body.classList.add('modal-open');
            modal.innerHTML = `
                <div class="modal-overlay"><div class="modal" style="text-align:center;">
                    <h2>Downloading...</h2>
                    <div class="progress-bar" style="height:24px;"><div id="downloadProgressFill" class="progress-fill" style="width:0%;"></div></div>
                    <div id="downloadProgressText" style="margin-top:12px;">0%</div>
                </div></div>
            `;
            modal.style.display = 'block';
        }

        try {
            const res = await fetch(file.download_url);
            if (!res.ok) throw new Error(`Network response was not ok: ${res.statusText}`);
            
            const contentLength = res.headers.get('content-length');
            const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
            let loadedSize = 0;
            
            const reader = res.body.getReader();
            const chunks = [];
            const progressFill = document.getElementById('downloadProgressFill');
            const progressText = document.getElementById('downloadProgressText');

            while(true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                chunks.push(value);
                loadedSize += value.length;
                
                if (totalSize > 0) {
                    const percent = Math.min(100, Math.round((loadedSize / totalSize) * 100));
                    if (progressFill) progressFill.style.width = `${percent}%`;
                    if (progressText) progressText.textContent = `${percent}%`;
                }
            }

            if (progressFill) progressFill.style.width = '100%';
            if (progressText) progressText.textContent = 'Parsing data...';

            // Combine chunks and decode
            const allChunks = new Uint8Array(loadedSize);
            let position = 0;
            chunks.forEach(chunk => {
                allChunks.set(chunk, position);
                position += chunk.length;
            });
            const csvText = new TextDecoder('utf-8').decode(allChunks);
            
            // Give a moment for the user to see the "Parsing" message
            setTimeout(() => {
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: true,
                    complete: function(results) {
                        closeModal(); // Close modal on success
                        // Map to internal format
                        currentFileData = results.data.map(mapCSVRow);
                        questionsData = currentFileData;
                        // Remove any leading numbers/dots/spaces from company and period
                        const cleanCompany = file.company.replace(/^\d+\.\s*/, '');
                        const cleanPeriod = file.period.replace(/^\d+\.\s*/, '');
                        currentFileName = cleanCompany + ' ' + cleanPeriod;
                        updateCurrentFileDisplay();
                        loadCompletedQuestions();
                        updateDisplay();
                        showSections();
                        // Suggest saving
                        setTimeout(() => {
                            savedFiles.set(cleanCompany + ' ' + cleanPeriod, {
                                data: currentFileData,
                                progress: [...completedQuestions],
                                uploadDate: new Date().toISOString(),
                                lastUpdated: new Date().toISOString(),
                                originalName: file.name
                            });
                            currentFileName = cleanCompany + ' ' + cleanPeriod;
                            saveSavedFiles();
                            displaySavedFiles();
                            window.alert('File saved successfully!');
                        }, 300);
                    },
                    error: function(error) {
                        modal.innerHTML = `<div class=\"modal-overlay\"><div class=\"modal\"><button class=\"modal-close\" title=\"Close\">&times;</button><h2>Error parsing CSV</h2><div style=\"color:#ef4444; margin:18px 0;\">${error.message}</div></div></div>`;
                        modal.querySelector('.modal-close').onclick = () => { modal.style.display = 'none'; modal.innerHTML = ''; };
                    }
                });
            }, 200);

        } catch (e) {
            modal.innerHTML = `<div class=\"modal-overlay\"><div class=\"modal\"><button class=\"modal-close\" title=\"Close\">&times;</button><h2>Error downloading CSV</h2><div style=\"color:#ef4444; margin:18px 0;\">${e.message || 'Unknown error'}</div></div></div>`;
            modal.querySelector('.modal-close').onclick = () => { modal.style.display = 'none'; modal.innerHTML = ''; };
        }
    }
})();

// Paging handler
window.changeQuestionsPage = function(page) {
    currentQuestionsPage = page;
    if (currentFileName) {
        persistentStorage.setItem(getPageKey(currentFileName), String(page));
    }
    renderQuestions();
}

// THEME TOGGLE LOGIC (refined)
const themeMap = {
    dark: {
        class: '',
        icon: 'icon-moon',
        name: 'Dark'
    },
    light: {
        class: 'theme-light',
        icon: 'icon-sun',
        name: 'Light'
    },
    solarized: {
        class: 'theme-solarized',
        icon: 'icon-solar',
        name: 'Solarized'
    },
    forest: {
        class: 'theme-forest',
        icon: 'icon-forest',
        name: 'Forest'
    },
    ocean: {
        class: 'theme-ocean',
        icon: 'icon-ocean',
        name: 'Ocean'
    },
    cyberpunk: {
        class: 'theme-cyberpunk',
        icon: 'icon-cyberpunk',
        name: 'Cyberpunk'
    }
};
function setTheme(theme) {
    Object.values(themeMap).forEach(t => t.class && document.body.classList.remove(t.class));
    if (themeMap[theme].class) document.body.classList.add(themeMap[theme].class);
    // Show only the correct SVG icon
    Object.values(themeMap).forEach(t => document.getElementById(t.icon).style.display = 'none');
    document.getElementById(themeMap[theme].icon).style.display = 'block';
    localStorage.setItem('leetcode_theme', theme);
    // Re-render charts to update theme colors
    if (typeof updateChart === 'function') setTimeout(updateChart, 0);
}
function getSavedTheme() {
    return localStorage.getItem('leetcode_theme') || 'dark';
}
document.addEventListener('DOMContentLoaded', function() {
    // Apply saved theme
    setTheme(getSavedTheme());
    // Toggle dropdown
    const btn = document.getElementById('themeToggleBtn');
    const dropdown = document.getElementById('themeDropdown');
    btn.onclick = function(e) {
        e.stopPropagation();
        const expanded = dropdown.classList.toggle('show');
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        if (expanded) dropdown.querySelector('.theme-dropdown-item.active')?.focus();
    };
    // Dropdown item click (only for theme items)
    dropdown.querySelectorAll('.theme-dropdown-item[data-theme]').forEach(item => {
        item.onclick = function(e) {
            const theme = item.getAttribute('data-theme');
            if (theme) setTheme(theme);
            dropdown.classList.remove('show');
            btn.setAttribute('aria-expanded', 'false');
            btn.focus();
        };
        item.onkeydown = function(e) {
            if (e.key === 'Enter' || e.key === ' ') { item.click(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); item.nextElementSibling?.focus(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); item.previousElementSibling?.focus(); }
            if (e.key === 'Escape') { dropdown.classList.remove('show'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
        };
    });
    // Keyboard: open with Enter/Space
    btn.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { btn.click(); }
        if (e.key === 'ArrowDown') { dropdown.classList.add('show'); dropdown.querySelector('.theme-dropdown-item.active')?.focus(); }
    };
    // Close dropdown on outside click
    document.addEventListener('mousedown', function(e) {
        if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
            dropdown.classList.remove('show');
            btn.setAttribute('aria-expanded', 'false');
        }
    });
    // Highlight active
    function updateActive() {
        const current = getSavedTheme();
        dropdown.querySelectorAll('.theme-dropdown-item').forEach(item => {
            if (item.getAttribute('data-theme') === current) item.classList.add('active');
            else item.classList.remove('active');
        });
    }
    updateActive();
    // Update active on theme change
    btn.addEventListener('click', updateActive);
    dropdown.querySelectorAll('.theme-dropdown-item').forEach(item => {
        item.addEventListener('click', updateActive);
    });
    // Aurora toggle event (separate)
    const auroraBtn = document.getElementById('auroraToggleBtn');
    if (auroraBtn) {
        auroraBtn.onclick = function(e) {
            e.stopPropagation();
            const enabled = !getAuroraEnabled();
            setAuroraEnabled(enabled);
        };
        auroraBtn.onkeydown = function(e) {
            if (e.key === 'Enter' || e.key === ' ') { auroraBtn.click(); }
        };
    }
    // Set initial state
    setAuroraEnabled(getAuroraEnabled());
});

// Custom Modal Dialog Logic
function showCustomModal(type, message, onConfirm, onCancel) {
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    const overlay = document.getElementById('customModalOverlay');
    const modal = document.getElementById('customModal');
    const msg = document.getElementById('customModalMessage');
    const btns = document.getElementById('customModalButtons');
    msg.textContent = message;
    btns.innerHTML = '';
    overlay.style.display = 'flex';
    function close() {
    overlay.style.display = 'none';
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    }
    if (type === 'alert') {
    const ok = document.createElement('button');
    ok.textContent = 'OK';
    ok.className = 'reset-btn';
    ok.onclick = () => { close(); if (onConfirm) onConfirm(); };
    btns.appendChild(ok);
    } else if (type === 'confirm') {
    const yes = document.createElement('button');
    yes.textContent = 'Yes';
    yes.className = 'reset-btn';
    yes.onclick = () => { close(); if (onConfirm) onConfirm(); };
    const no = document.createElement('button');
    no.textContent = 'No';
    no.className = 'reset-btn';
    no.onclick = () => { close(); if (onCancel) onCancel(); };
    btns.appendChild(yes);
    btns.appendChild(no);
    } else if (type === 'prompt') {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'modal-search';
    input.style.marginBottom = '18px';
    btns.appendChild(input);
    const ok = document.createElement('button');
    ok.textContent = 'OK';
    ok.className = 'reset-btn';
    ok.onclick = () => { close(); if (onConfirm) onConfirm(input.value); };
    btns.appendChild(ok);
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.className = 'reset-btn';
    cancel.onclick = () => { close(); if (onCancel) onCancel(); };
    btns.appendChild(cancel);
    }
    overlay.onclick = e => { if (e.target === overlay) close(); };
}
// Replace alert, confirm, prompt in code below
window.alert = (msg) => showCustomModal('alert', msg);
window.confirm = (msg) => new Promise(res => showCustomModal('confirm', msg, () => res(true), () => res(false)));
window.prompt = (msg, def) => new Promise(res => showCustomModal('prompt', msg, v => res(v), () => res(null)));

// --- CounterAPI V2 integration for global stats ---
// const counter = new Counter({ workspace: 'leetcode-tracker' });

// async function updateGlobalStats() {
//     const visitsEl = document.getElementById('totalVisits');
//     const solvedEl = document.getElementById('totalSolved');

//     // Increment and get visit count
//     counter.up('visit').then(result => {
//         if (visitsEl) visitsEl.textContent = (result.value || 0).toLocaleString();
//     }).catch(error => {
//         console.error('CounterAPI visit error:', error);
//         if (visitsEl) visitsEl.textContent = 'N/A';
//     });

//     // Get total solved count
//     counter.get('total-solved').then(result => {
//         if (solvedEl) solvedEl.textContent = (result.value || 0).toLocaleString();
//     }).catch(error => {
//         console.error('CounterAPI get solved error:', error);
//         if (solvedEl) solvedEl.textContent = 'N/A';
//     });
// }

// async function incrementSolvedCounter() {
//     const solvedEl = document.getElementById('totalSolved');
//     counter.up('total-solved').then(result => {
//         if (solvedEl) solvedEl.textContent = (result.value || 0).toLocaleString();
//     }).catch(error => {
//         console.error('CounterAPI increment solved error:', error);
//     });
// }

// function toggleQuestion(id) {
//     if (id == null) return;
//     const idStr = id.toString();
//     if (completedQuestions.has(idStr)) {
//         completedQuestions.delete(idStr);
//     } else {
//         completedQuestions.add(idStr);
//         incrementSolvedCounter();
//     }
//     saveCompletedQuestions();
//     updateDisplay();
// }

// Initialize
loadSavedFiles();
displaySavedFiles();
// updateGlobalStats();

// Aurora Toggle Logic
function setAuroraEnabled(enabled) {
    // Check if device is mobile
    const isMobile = window.innerWidth <= 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Disable aurora on mobile or if user prefers reduced motion
    if (isMobile || prefersReducedMotion) {
    enabled = false;
    if (isMobile) {
        // Show a subtle message that aurora is disabled on mobile
        console.log('Aurora background is disabled on mobile devices for better performance');
    }
    }
    
    if (enabled) document.body.classList.add('aurora-enabled');
    else document.body.classList.remove('aurora-enabled');
    localStorage.setItem('leetcode_aurora_enabled', enabled ? '1' : '0');
    updateAuroraSwitchUI(enabled);
}
function getAuroraEnabled() {
    // Check if device is mobile
    const isMobile = window.innerWidth <= 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Force disable on mobile or reduced motion preference
    if (isMobile || prefersReducedMotion) {
    return false;
    }
    
    return localStorage.getItem('leetcode_aurora_enabled') === '1';
}
function updateAuroraSwitchUI(enabled) {
    const switchEl = document.getElementById('auroraToggleSwitch');
    const mobileIndicator = document.getElementById('auroraMobileIndicator');
    if (!switchEl) return;
    
    // Check if device is mobile
    const isMobile = window.innerWidth <= 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Show mobile indicator if on mobile
    if (mobileIndicator) {
    if (isMobile) {
        mobileIndicator.style.display = 'inline';
        mobileIndicator.textContent = '(Mobile disabled)';
    } else if (prefersReducedMotion) {
        mobileIndicator.style.display = 'inline';
        mobileIndicator.textContent = '(Motion reduced)';
    } else {
        mobileIndicator.style.display = 'none';
    }
    }
    
    if (enabled && !isMobile && !prefersReducedMotion) {
    switchEl.style.background = 'var(--accent)';
    switchEl.firstElementChild.style.left = '18px';
    switchEl.firstElementChild.style.background = '#fff';
    } else {
    switchEl.style.background = 'var(--bg-accent)';
    switchEl.firstElementChild.style.left = '2px';
    switchEl.firstElementChild.style.background = 'var(--accent)';
    }
}

// --- Aurora Dynamic Color Animation (JS) - Optimized for Performance ---
(function() {
    if (!window.requestAnimationFrame) return;
    
    // Check if device is mobile or has reduced motion preference
    const isMobile = window.innerWidth <= 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Skip animation on mobile or if user prefers reduced motion
    if (isMobile || prefersReducedMotion) return;
    
    const root = document.documentElement;
    let t = 0;
    let animationId = null;
    
    function hslToHex(h, s, l) {
    l /= 100; s /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c/2, r=0, g=0, b=0;
    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
    
    function animateAurora() {
    t += 0.005; // Reduced speed for better performance
    // Animate the CSS variables for aurora colors (only 3 colors now)
    const h1 = (200 + 40 * Math.sin(t)) % 360;
    const h2 = (260 + 60 * Math.cos(t * 0.7)) % 360;
    const h3 = (50 + 30 * Math.sin(t * 1.3)) % 360;
    
    root.style.setProperty('--aurora1', hslToHex(h1, 100, 70));
    root.style.setProperty('--aurora2', hslToHex(h2, 90, 60));
    root.style.setProperty('--aurora3', hslToHex(h3, 95, 65));
    
    animationId = requestAnimationFrame(animateAurora);
    }
    
    function startAuroraAnimation() {
    if (isMobile || prefersReducedMotion) return;
    if (!animationId && document.body.classList.contains('aurora-enabled')) {
        animateAurora();
    }
    }
    
    function stopAuroraAnimation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    }
    
    // Start animation if aurora is enabled on load
    if (document.body.classList.contains('aurora-enabled')) {
    startAuroraAnimation();
    }
    
    // Observer for aurora toggle changes
    const observer = new MutationObserver(() => {
    if (document.body.classList.contains('aurora-enabled')) {
        startAuroraAnimation();
    } else {
        stopAuroraAnimation();
    }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    
    // Clean up on page unload
    window.addEventListener('beforeunload', stopAuroraAnimation);
})();

document.getElementById('zenModeBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    const isZen = document.body.classList.toggle('zen-mode');
    this.innerText = isZen ? '🗗' : '🗖';
    this.title = isZen ? 'Exit Full Screen' : 'Full Screen';
    if (isZen) {
    document.getElementById('questionsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // Do not scroll on exit
});

function updateCurrentFileDisplay() {
    const el = document.getElementById('currentFileDisplay');
    if (!el) return;
    if (currentFileName && currentFileName.trim() && window.innerWidth > 600) {
    const firstWord = currentFileName.trim().split(/\s+/)[0];
    el.textContent = firstWord;
    el.title = currentFileName;
    el.style.display = '';
    } else {
    el.textContent = '';
    el.title = '';
    el.style.display = 'none';
    }
}
window.addEventListener('resize', updateCurrentFileDisplay);

async function clearAllProgress() {
    if (!(await confirm('Are you sure you want to clear ALL data? This will remove all saved files and progress.'))) return;
    // Clear localStorage
    if (isLocalStorageAvailable()) {
        localStorage.clear();
    }
    // Clear all cookies set by the app
    document.cookie.split(';').forEach(function(c) {
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/');
    });
    // Also clear in-memory state
    completedQuestions = new Set();
    savedFiles = new Map();
    currentFileName = '';
    currentFileData = null;
    questionsData = [];
    updateDisplay();
    displaySavedFiles();
    hideSections();
    alert('All data has been cleared!');
}

document.querySelectorAll('.reset-btn').forEach(btn => {
    if (btn.getAttribute('onclick') === 'resetProgress()') {
        btn.onclick = async () => { await resetProgress(); };
    }
    if (btn.getAttribute('onclick') === 'importProgress()') {
        btn.onclick = async () => { await importProgress(); };
    }
    if (btn.getAttribute('onclick') === 'clearAllProgress()') {
        btn.onclick = async () => { await clearAllProgress(); };
    }
});

// Emoji alternator for footer
(function() {
const emojiSpan = document.getElementById('footer-emoji');
if (!emojiSpan) return;
const emojis = [
    { char: '❤️', label: 'love' },
    { char: '🧠', label: 'brain' },
    { char: '☕', label: 'coffee' },
    { char: '🔥', label: 'fire' },
    { char: '💻', label: 'laptop' }
];
let idx = 0;
setInterval(() => {
    idx = (idx + 1) % emojis.length;
    emojiSpan.textContent = emojis[idx].char;
    emojiSpan.setAttribute('aria-label', emojis[idx].label);
}, 1200);
})();