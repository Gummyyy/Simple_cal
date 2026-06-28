import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCgOLUbiqiru0hB23Zf_tQMzNMw20SVEzY",
    authDomain: "drugcal-5ea14.firebaseapp.com",
    projectId: "drugcal-5ea14",
    storageBucket: "drugcal-5ea14.firebasestorage.app",
    messagingSenderId: "283126928680",
    appId: "1:283126928680:web:c5feefee4994aea6acac1d",
    measurementId: "G-W8816DLN68"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let drugDatabase = [];
let cardCounter = 0;
let selectedDrug = null;

// TAB NAVIGATION
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.getAttribute('onclick') === `switchTab('${tabId}')`) b.classList.add('active');
    });
    if (tabId === 'calc-tab') fetchDrugsFromFirebase();
    if (tabId === 'list-tab') loadDrugList();
}

// FETCH FROM FIRESTORE
async function fetchDrugsFromFirebase() {
    try {
        const snapshot = await getDocs(collection(db, "drugs"));
        drugDatabase = [];
        snapshot.forEach(d => {
            const data = d.data();
            data.id = d.id;
            drugDatabase.push(data);
        });
    } catch (err) {
        console.error(err);
    }
}

// SEARCH DROPDOWN
const searchInput = document.getElementById('drug-search');
const searchDropdown = document.getElementById('drug-search-dropdown');
const addCardBtn = document.getElementById('add-card-btn');

function positionDropdown() {
    const rect = searchInput.getBoundingClientRect();
    searchDropdown.style.top = `${rect.bottom + 4}px`;
    searchDropdown.style.left = `${rect.left}px`;
    searchDropdown.style.width = `${rect.width}px`;
}

searchInput.addEventListener('input', function() {
    const term = this.value.trim().toLowerCase();

    selectedDrug = null;
    addCardBtn.disabled = true;

    if (term.length < 2) {
        searchDropdown.classList.remove('open');
        return;
    }

    const matches = drugDatabase.filter(d => d.name.toLowerCase().includes(term));
    searchDropdown.innerHTML = '';

    if (matches.length === 0) {
        searchDropdown.innerHTML = '<div class="drug-search-option no-result">No drugs found</div>';
    } else {
        matches.forEach(drug => {
            const item = document.createElement('div');
            item.className = 'drug-search-option';
            item.textContent = drug.name;
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                selectedDrug = drug;
                searchInput.value = drug.name;
                searchDropdown.classList.remove('open');
                addCardBtn.disabled = false;
            });
            searchDropdown.appendChild(item);
        });
    }

    positionDropdown();
    searchDropdown.classList.add('open');
});

searchInput.addEventListener('blur', function() {
    setTimeout(() => searchDropdown.classList.remove('open'), 150);
});

searchInput.addEventListener('focus', function() {
    if (this.value.trim().length >= 2 && !selectedDrug) {
        this.dispatchEvent(new Event('input'));
    }
});

// ADD DRUG CARD
window.addDrugCard = function() {
    if (!selectedDrug) return;

    const drug = selectedDrug;
    cardCounter++;
    const id = cardCounter;

    const doseMin = drug.doseMin ?? drug.dosePerKg ?? 0;
    const doseMax = drug.doseMax ?? drug.dosePerKg ?? 0;
    const doseUnit = drug.doseUnit || 'mg';

    const card = document.createElement('div');
    card.className = 'calc-drug-card';
    card.id = `drug-card-${id}`;
    card.dataset.drugId = drug.id;
    card.innerHTML = `
        <div class="calc-card-header">
            <span class="calc-card-drug-label">${drug.name}</span>
            <button class="remove-card-btn" onclick="removeDrugCard(${id})">×</button>
        </div>
        <div class="card-row">
            <div>
                <label>Concentration (${doseUnit} : ml)</label>
                <div class="concentration-row">
                    <input type="number" class="card-conc-mg" value="1" min="0.01" step="0.01">
                    <span class="conc-sep">:</span>
                    <input type="number" class="card-conc-ml" value="1" min="0.01" step="0.01">
                </div>
            </div>
            <div>
                <label>Dose (${doseUnit}/kg) <span class="dose-range-hint">${doseMin}–${doseMax}</span></label>
                <input type="number" class="card-dose-input" step="0.01" min="${doseMin}" max="${doseMax}" placeholder="${doseMin}">
            </div>
        </div>
        <button class="primary-btn" style="margin-bottom:0" onclick="calculateCard(${id})">Calculate</button>
        <div class="card-results" style="display:none">
            <p><strong>Preparation (total daily):</strong> <span class="out-preparation"></span></p>
            <p><strong>Per Dose:</strong> <span class="out-daily"></span></p>
            <p class="out-maxdose-note"></p>
            <p class="out-caution"></p>
        </div>
    `;

    document.getElementById('drug-cards-container').appendChild(card);

    // Reset search after adding
    searchInput.value = '';
    selectedDrug = null;
    addCardBtn.disabled = true;
}

// REMOVE DRUG CARD
window.removeDrugCard = function(id) {
    const el = document.getElementById(`drug-card-${id}`);
    if (el) el.remove();
}

// CALCULATE PER CARD
window.calculateCard = function(cardId) {
    const card = document.getElementById(`drug-card-${cardId}`);
    if (!card) return;

    const weight = parseFloat(document.getElementById('patient-weight').value) || 0;
    if (weight <= 0) { alert('Please enter patient weight at the top.'); return; }

    const drug = drugDatabase.find(d => d.id === card.dataset.drugId);
    if (!drug) { alert('Drug data not found. Please reload.'); return; }

    const concMg = parseFloat(card.querySelector('.card-conc-mg').value) || 1;
    const concMl = parseFloat(card.querySelector('.card-conc-ml').value) || 1;
    const dosePerKgInput = parseFloat(card.querySelector('.card-dose-input').value);
    if (isNaN(dosePerKgInput) || dosePerKgInput <= 0) { alert('Please enter a dose.'); return; }

    const doseMin = drug.doseMin ?? drug.dosePerKg ?? 0;
    const doseMax = drug.doseMax ?? drug.dosePerKg ?? dosePerKgInput;
    const concentration = concMg / concMl;

    let doseMg = dosePerKgInput * weight;
    let cappedByMax = false;
    if (drug.maxDose && doseMg > drug.maxDose) {
        doseMg = drug.maxDose;
        cappedByMax = true;
    }

    const dailyMl = doseMg / concentration;
    const perDoseMl = dailyMl / drug.timesPerDay;
    const perDoseMg = doseMg / drug.timesPerDay;
    const timingHtml = drug.timing ? ` <strong>${drug.timing}</strong>` : '';

    card.querySelector('.out-preparation').textContent =
        `${dailyMl.toFixed(2)} ml  (${doseMg.toFixed(2)} mg)`;
    card.querySelector('.out-daily').innerHTML =
        `${perDoseMl.toFixed(2)} ml  (${perDoseMg.toFixed(2)} mg)  ×  ${drug.timesPerDay} times/day${timingHtml}`;

    const maxNote = card.querySelector('.out-maxdose-note');
    const outOfRange = dosePerKgInput < doseMin || dosePerKgInput > doseMax;
    if (cappedByMax) {
        maxNote.textContent = `Note: Dose capped at maximum of ${drug.maxDose} mg.`;
    } else if (outOfRange) {
        maxNote.textContent = `Warning: ${dosePerKgInput} mg/kg is outside range (${doseMin}–${doseMax}).`;
    } else {
        maxNote.textContent = '';
    }

    card.querySelector('.out-caution').textContent =
        drug.cautionNote ? `Caution: ${drug.cautionNote}` : '';
    card.querySelector('.card-results').style.display = 'block';
}

// SAVE NEW DRUG
window.saveDrug = async function(e) {
    e.preventDefault();
    const newDrug = {
        name: document.getElementById('drug-name').value.trim(),
        doseMin: parseFloat(document.getElementById('drug-dose-min').value),
        doseMax: parseFloat(document.getElementById('drug-dose-max').value),
        doseUnit: document.getElementById('drug-dose-unit').value,
        timesPerDay: parseInt(document.getElementById('times-per-day').value),
        maxDose: parseFloat(document.getElementById('max-dose').value) || null,
        timing: document.getElementById('medication-timing').value,
        cautionNote: document.getElementById('caution-note').value.trim()
    };
    try {
        await addDoc(collection(db, "drugs"), newDrug);
        alert('Drug saved successfully!');
        document.getElementById('drug-form').reset();
        drugDatabase = [];
        window.switchTab('calc-tab');
    } catch (err) {
        console.error(err);
        alert('Failed to save drug.');
    }
}

// LOAD DRUG LIST
async function loadDrugList() {
    const container = document.getElementById('drug-list-container');
    if (drugDatabase.length === 0) {
        container.innerHTML = '<p>Loading...</p>';
        await fetchDrugsFromFirebase();
    }
    if (drugDatabase.length === 0) {
        container.innerHTML = '<p>No drugs in the database.</p>';
        return;
    }
    container.innerHTML = '';
    drugDatabase.forEach(drug => {
        const doseDisplay = drug.doseMin !== undefined
            ? `${drug.doseMin}–${drug.doseMax} mg/kg`
            : `${drug.dosePerKg} mg/kg`;
        const maxDoseHtml = drug.maxDose ? `<span>Max: <strong>${drug.maxDose} mg</strong></span>` : '';
        const timingHtml = drug.timing ? `<span class="timing-badge">${drug.timing}</span>` : '';
        const cautionHtml = drug.cautionNote
            ? `<p class="drug-contra">Caution: ${drug.cautionNote}</p>` : '';

        const card = document.createElement('div');
        card.className = 'drug-card';
        card.innerHTML = `
            <div class="drug-card-header">
                <span class="drug-card-name">${drug.name}</span>
                <div class="card-actions">
                    <button class="edit-btn" onclick="openEditModal('${drug.id}')">Edit</button>
                    <button class="delete-btn" onclick="deleteDrug('${drug.id}')">Delete</button>
                </div>
            </div>
            <div class="drug-meta">
                <span>Dose: <strong>${doseDisplay}</strong></span>
                <span>${drug.timesPerDay}x/day</span>
                ${maxDoseHtml}
            </div>
            ${timingHtml}
            ${cautionHtml}
        `;
        container.appendChild(card);
    });
}

// DELETE DRUG
window.deleteDrug = async function(id) {
    if (!confirm('Delete this drug from the database?')) return;
    try {
        await deleteDoc(doc(db, "drugs", id));
        drugDatabase = [];
        loadDrugList();
    } catch (err) {
        console.error(err);
        alert('Failed to delete drug.');
    }
}

// OPEN EDIT MODAL
window.openEditModal = function(id) {
    const drug = drugDatabase.find(d => d.id === id);
    if (!drug) return;
    document.getElementById('edit-drug-form').dataset.editId = id;
    document.getElementById('edit-drug-name').value = drug.name;
    document.getElementById('edit-dose-min').value = drug.doseMin ?? drug.dosePerKg ?? '';
    document.getElementById('edit-dose-max').value = drug.doseMax ?? drug.dosePerKg ?? '';
    document.getElementById('edit-drug-dose-unit').value = drug.doseUnit || 'mg';
    document.getElementById('edit-times-per-day').value = drug.timesPerDay;
    document.getElementById('edit-max-dose').value = drug.maxDose || '';
    document.getElementById('edit-medication-timing').value = drug.timing || 'AC';
    document.getElementById('edit-caution-note').value = drug.cautionNote || '';
    document.getElementById('edit-modal').style.display = 'flex';
}

window.closeEditModal = function() {
    document.getElementById('edit-modal').style.display = 'none';
}

// SAVE EDIT
window.saveEditDrug = async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit-drug-form').dataset.editId;
    const updated = {
        name: document.getElementById('edit-drug-name').value.trim(),
        doseMin: parseFloat(document.getElementById('edit-dose-min').value),
        doseMax: parseFloat(document.getElementById('edit-dose-max').value),
        doseUnit: document.getElementById('edit-drug-dose-unit').value,
        timesPerDay: parseInt(document.getElementById('edit-times-per-day').value),
        maxDose: parseFloat(document.getElementById('edit-max-dose').value) || null,
        timing: document.getElementById('edit-medication-timing').value,
        cautionNote: document.getElementById('edit-caution-note').value.trim()
    };
    try {
        await updateDoc(doc(db, "drugs", id), updated);
        closeEditModal();
        drugDatabase = [];
        loadDrugList();
    } catch (err) {
        console.error(err);
        alert('Failed to save changes.');
    }
}

// Boot
fetchDrugsFromFirebase();
