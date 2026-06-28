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
        updateAllCardSelects(document.getElementById('drug-search')?.value || '');
    } catch (err) {
        console.error(err);
    }
}

// SEARCH — updates every card's drug select filtered by search term
function updateAllCardSelects(searchTerm = '') {
    const filtered = searchTerm
        ? drugDatabase.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : drugDatabase;

    document.querySelectorAll('.card-drug-select').forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Drug --</option>';
        filtered.forEach(drug => {
            const opt = document.createElement('option');
            opt.value = drug.id;
            opt.textContent = drug.name;
            if (drug.id === currentVal) opt.selected = true;
            select.appendChild(opt);
        });
    });
}

document.getElementById('drug-search').addEventListener('input', function() {
    updateAllCardSelects(this.value);
});

// ADD DRUG CARD
window.addDrugCard = function() {
    if (drugDatabase.length === 0) {
        alert('Drug database is still loading. Please wait.');
        return;
    }
    cardCounter++;
    const id = cardCounter;

    const optionsHtml = drugDatabase.map(d =>
        `<option value="${d.id}">${d.name}</option>`
    ).join('');

    const card = document.createElement('div');
    card.className = 'calc-drug-card';
    card.id = `drug-card-${id}`;
    card.innerHTML = `
        <div class="calc-card-header">
            <span class="calc-card-drug-label">Select a drug</span>
            <button class="remove-card-btn" onclick="removeDrugCard(${id})">×</button>
        </div>
        <div class="input-group" style="margin-bottom:12px">
            <label>Drug:</label>
            <select class="card-drug-select" onchange="onCardDrugChange(this, ${id})">
                <option value="">-- Select Drug --</option>
                ${optionsHtml}
            </select>
        </div>
        <div class="card-row">
            <div>
                <label>Concentration (mg : ml)</label>
                <div class="concentration-row">
                    <input type="number" class="card-conc-mg" value="1" min="0.01" step="0.01">
                    <span class="conc-sep">:</span>
                    <input type="number" class="card-conc-ml" value="1" min="0.01" step="0.01">
                </div>
            </div>
            <div>
                <label>Dose (mg/kg) <span class="dose-range-hint" id="hint-${id}"></span></label>
                <input type="number" class="card-dose-input" step="0.01" min="0" placeholder="Enter dose">
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
}

// REMOVE DRUG CARD
window.removeDrugCard = function(id) {
    const el = document.getElementById(`drug-card-${id}`);
    if (el) el.remove();
}

// DRUG SELECTED IN A CARD — update label, dose range hint, input constraints
window.onCardDrugChange = function(selectEl, cardId) {
    const drug = drugDatabase.find(d => d.id === selectEl.value);
    const card = document.getElementById(`drug-card-${cardId}`);
    if (!card) return;

    const label = card.querySelector('.calc-card-drug-label');
    const hint = document.getElementById(`hint-${cardId}`);
    const doseInput = card.querySelector('.card-dose-input');
    const results = card.querySelector('.card-results');

    if (!drug) {
        label.textContent = 'Select a drug';
        hint.textContent = '';
        doseInput.removeAttribute('min');
        doseInput.removeAttribute('max');
        doseInput.value = '';
        results.style.display = 'none';
        return;
    }

    label.textContent = drug.name;

    const doseMin = drug.doseMin ?? drug.dosePerKg ?? 0;
    const doseMax = drug.doseMax ?? drug.dosePerKg ?? 0;

    hint.textContent = `Range: ${doseMin}–${doseMax}`;
    doseInput.min = doseMin;
    doseInput.max = doseMax;
    doseInput.placeholder = `${doseMin}–${doseMax}`;
    results.style.display = 'none';
}

// CALCULATE PER CARD
window.calculateCard = function(cardId) {
    const card = document.getElementById(`drug-card-${cardId}`);
    if (!card) return;

    const weight = parseFloat(document.getElementById('patient-weight').value) || 0;
    if (weight <= 0) { alert('Please enter patient weight at the top.'); return; }

    const drugId = card.querySelector('.card-drug-select').value;
    const drug = drugDatabase.find(d => d.id === drugId);
    if (!drug) { alert('Please select a drug.'); return; }

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
        maxNote.textContent = `Warning: ${dosePerKgInput} mg/kg is outside recommended range (${doseMin}–${doseMax}).`;
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
        timesPerDay: parseInt(document.getElementById('times-per-day').value),
        maxDose: parseFloat(document.getElementById('max-dose').value) || null,
        timing: document.getElementById('medication-timing').value.trim(),
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
            ? `<p class="drug-contra">Caution: ${drug.cautionNote}</p>`
            : '';

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
    document.getElementById('edit-times-per-day').value = drug.timesPerDay;
    document.getElementById('edit-max-dose').value = drug.maxDose || '';
    document.getElementById('edit-medication-timing').value = drug.timing || '';
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
        timesPerDay: parseInt(document.getElementById('edit-times-per-day').value),
        maxDose: parseFloat(document.getElementById('edit-max-dose').value) || null,
        timing: document.getElementById('edit-medication-timing').value.trim(),
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
