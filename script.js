const state = {
    currentYear: new Date().getFullYear(),
    // New Schema: [{ id: '123', name: 'Exercise', color: '#ff7675' }]
    habits: JSON.parse(localStorage.getItem('habitList')) || [],
    // New Schema: "YYYY-MM-DD": { "habitId1": true, "habitId2": false }
    data: JSON.parse(localStorage.getItem('habitDataV2')) || {}
};

const dom = {
    appTitle: document.getElementById('appTitle'),
    yearContainer: document.getElementById('yearContainer'),
    habitModal: document.getElementById('habitModal'),
    habitList: document.getElementById('habitList'),
    modalDate: document.getElementById('modalDate'),
    dailyNote: document.getElementById('dailyNote'), // Added
    closeModalBtn: document.getElementById('closeModal'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    settingsList: document.getElementById('settingsList'),
    closeSettingsBtn: document.getElementById('closeSettings'),
    saveSettingsBtn: document.getElementById('saveSettings')
};

let selectedDateKey = null;

function init() {
    // 1. MIGRATION: Check if we need to upgrade from old Data
    migrateData();

    // 2. Fallback if no habits exist after migration
    if (!state.habits.length) {
        state.habits = [
            createHabit('Exercise'),
            createHabit('Read 10 pages'),
            createHabit('Drink 2L Water'),
            createHabit('Meditate'),
            createHabit('No Sugar')
        ];
        saveData();
    }

    dom.appTitle.textContent = `${state.currentYear} Habits`;
    renderFullYear();
    setupEventListeners();

    // Auto-scroll logic
    const currentMonthIndex = new Date().getMonth();
    setTimeout(() => {
        const monthElement = document.getElementById(`month-${currentMonthIndex}`);
        if (monthElement) monthElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// --- DATA MIGRATION ---
function migrateData() {
    const oldHabitNames = JSON.parse(localStorage.getItem('habitNames'));
    const oldData = JSON.parse(localStorage.getItem('habitData'));

    if (oldHabitNames && oldHabitNames.length > 0 && !localStorage.getItem('habitList')) {
        console.log("Migrating V1 data to V2...");

        // 1. Create IDs for existing habits
        state.habits = oldHabitNames.map(name => createHabit(name));

        // 2. Convert array boolean data to ID map
        for (const [dateKey, boolArray] of Object.entries(oldData || {})) {
            state.data[dateKey] = {};
            boolArray.forEach((isChecked, index) => {
                const habit = state.habits[index];
                if (habit && isChecked) {
                    state.data[dateKey][habit.id] = true;
                }
            });
        }

        saveData();
        // Clear old keys to avoid re-migration
        localStorage.removeItem('habitNames');
        localStorage.removeItem('habitData');
    }
}

function createHabit(name) {
    return {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: name
    };
}

// --- RENDER LOGIC ---
function getDaysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
}

function isToday(day, month, year) {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
}

function renderFullYear() {
    dom.yearContainer.innerHTML = '';
    const totalHabits = state.habits.length;

    for (let month = 0; month < 12; month++) {
        renderMonth(month, totalHabits);
    }
}

function renderMonth(month, totalHabits) {
    const monthName = new Date(state.currentYear, month).toLocaleString('default', { month: 'long' });

    const monthBlock = document.createElement('div');
    monthBlock.className = 'month-block';
    monthBlock.id = `month-${month}`;

    const title = document.createElement('h3');
    title.className = 'month-title';
    title.textContent = monthName;
    monthBlock.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    const daysInMonth = getDaysInMonth(month, state.currentYear);
    const firstDayIndex = new Date(state.currentYear, month, 1).getDay();

    // Padding
    for (let i = 0; i < firstDayIndex; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-cell empty';
        grid.appendChild(empty);
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        const dateKey = `${state.currentYear}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        const dayRecord = state.data[dateKey] || {};
        // Count how many of the *current* habits are completed
        let completedCount = 0;
        state.habits.forEach(h => {
            if (dayRecord[h.id]) completedCount++;
        });

        // Calculate percentage/step
        const percentage = totalHabits > 0 ? (completedCount / totalHabits * 100) : 0;

        const cell = document.createElement('div');
        cell.className = 'day-cell';
        if (isToday(i, month, state.currentYear)) cell.classList.add('today');

        // Show a dot if there is a note
        const hasNote = dayRecord.note && dayRecord.note.trim().length > 0;
        const noteIndicator = hasNote ? `<div style="position: absolute; top: 4px; right: 4px; width: 6px; height: 6px; background-color: #636e72; border-radius: 50%;"></div>` : '';

        cell.innerHTML = `
            ${noteIndicator}
            <span class="day-number">${i}</span>
            <div class="progress-track" style="opacity: ${totalHabits > 0 ? 1 : 0.3}">
                <div class="progress-fill" style="width: ${percentage}%; background-color: ${getGradientColor(percentage)}"></div>
            </div>
        `;

        cell.onclick = () => openHabitModal(dateKey, i, monthName);
        grid.appendChild(cell);
    }

    monthBlock.appendChild(grid);
    dom.yearContainer.appendChild(monthBlock);
}

function getGradientColor(percentage) {
    if (percentage === 0) return 'transparent';
    if (percentage <= 20) return '#ff7675'; // Red
    if (percentage <= 40) return '#fdcb6e'; // Orange
    if (percentage <= 60) return '#feca57'; // Yellow
    if (percentage <= 80) return '#a3cb38'; // Light Green
    return '#00b894'; // Green
}

// --- MODAL LOGIC ---
function openHabitModal(dateKey, day, monthName) {
    selectedDateKey = dateKey;
    dom.modalDate.innerText = `${monthName} ${day}`;
    dom.habitModal.classList.add('active');

    // Load Note
    const dayRecord = state.data[selectedDateKey] || {};
    dom.dailyNote.value = dayRecord.note || '';

    renderHabitList();
}

function renderHabitList() {
    dom.habitList.innerHTML = '';
    const dayRecord = state.data[selectedDateKey] || {};

    state.habits.forEach((habit) => {
        const item = document.createElement('div');
        item.className = 'habit-item';
        item.innerHTML = `
            <input type="checkbox" class="habit-checkbox" ${dayRecord[habit.id] ? 'checked' : ''}>
            <span class="habit-name">${habit.name}</span>
        `;

        const toggle = () => {
            const checkbox = item.querySelector('input');
            const newState = !dayRecord[habit.id];

            if (!state.data[selectedDateKey]) state.data[selectedDateKey] = {};
            state.data[selectedDateKey][habit.id] = newState;

            checkbox.checked = newState;
            saveData();
            renderFullYear();
        };

        // Click wrapper (excluding checkbox itself to avoid double toggle)
        item.onclick = (e) => {
            if (e.target.type !== 'checkbox') toggle();
        };

        // Native checkbox click
        item.querySelector('input').onclick = (e) => {
            e.stopPropagation(); // prevent wrapper click
            if (!state.data[selectedDateKey]) state.data[selectedDateKey] = {};
            state.data[selectedDateKey][habit.id] = e.target.checked;
            saveData();
            renderFullYear();
        };

        dom.habitList.appendChild(item);
    });
}

// --- SETTINGS LOGIC ---
function openSettings() {
    renderSettingsList();
    dom.settingsModal.classList.add('active');
}

function renderSettingsList() {
    dom.settingsList.innerHTML = '';

    if (state.habits.length === 0) {
        dom.settingsList.innerHTML = '<p style="text-align:center; color:#888; margin-bottom:1rem;">No habits yet. Add one!</p>';
    }

    state.habits.forEach((habit, index) => {
        const row = document.createElement('div');
        row.className = 'setting-row';
        row.innerHTML = `
            <input type="text" class="setting-input" value="${habit.name}" data-id="${habit.id}">
            <button class="icon-btn delete-btn" title="Delete Habit">🗑️</button>
        `;

        // Delete Handler
        row.querySelector('.delete-btn').onclick = () => {
            if (confirm(`Delete habit "${habit.name}"? This will hide it from your history.`)) {
                state.habits.splice(index, 1);
                saveData();
                renderSettingsList(); // Re-render settings
                renderFullYear(); // Re-render background
            }
        };

        dom.settingsList.appendChild(row);
    });

    // Add "New Habit" Button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-btn';
    addBtn.textContent = '+ Add New Habit';
    addBtn.onclick = () => {
        state.habits.push(createHabit('New Habit'));
        saveData();
        renderSettingsList();
    };
    dom.settingsList.appendChild(addBtn);
}

function saveSettings() {
    // Update names from inputs
    const inputs = dom.settingsList.querySelectorAll('.setting-input');
    inputs.forEach(input => {
        const id = input.dataset.id;
        const habit = state.habits.find(h => h.id === id);
        if (habit) habit.name = input.value.trim() || "Untitled Habit";
    });

    saveData();
    closeSettings();
    renderFullYear();
}

function saveData() {
    localStorage.setItem('habitList', JSON.stringify(state.habits));
    localStorage.setItem('habitDataV2', JSON.stringify(state.data));
}

function closeSettings() {
    dom.settingsModal.classList.remove('active');
}

function closeHabitModal() {
    dom.habitModal.classList.remove('active');
}

function setupEventListeners() {
    dom.closeModalBtn.onclick = closeHabitModal;
    dom.habitModal.onclick = (e) => {
        if (e.target === dom.habitModal) closeHabitModal();
    };

    // Save Note auto-save
    dom.dailyNote.addEventListener('input', (e) => {
        if (selectedDateKey) {
            if (!state.data[selectedDateKey]) state.data[selectedDateKey] = {};
            state.data[selectedDateKey].note = e.target.value;
            saveData();

            // Debounce the render to treat the typing as active
            // renderFullYear(); // We don't want to re-render the whole grid while typing if we can avoid it, 
            // but we need to update the dot. Maybe good to debounce. 
            // For now, keep it simple.
            renderFullYear();
        }
    });

    dom.settingsBtn.onclick = openSettings;
    dom.closeSettingsBtn.onclick = closeSettings;
    dom.saveSettingsBtn.onclick = saveSettings;
}

init();
