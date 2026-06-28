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

// TAB NAVIGATION
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.getAttribute('onclick') === `switchTab('${tabId}')`) b.classList.add('active');
    });

    if (tabId === 'calc-tab') {
        fetchDrugsFromFirebase();
        document.getElementById('calc-results').style.display = 'none';
    }
    if (tabId === 'list-tab') loadDrugList();
}

// FETCH FROM FIRESTORE (populates drugDatabase + calc dropdown)
async function fetchDrugsFromFirebase() {
    const select = document.getElementById('calc-drug-select');
    select.innerHTML = '<option>Loading...</option>';

    try {
        const snapshot = await getDocs(collection(db, "drugs"));
        drugDatabase = [];
        snapshot.forEach(d => {
            const data = d.data();
            data.id = d.id;
            drugDatabase.push(data);
        });

        select.innerHTML = '';
        if (drugDatabase.length === 0) {
            select.innerHTML = '<option value="">No drugs found.</option>';
            return;
        }
        drugDatabase.forEach(drug => {
            const opt = document.createElement('option');
            opt.value = drug.id;
            opt.textContent = drug.name;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error(err);
        select.innerHTML = '<option>Error loading drugs.</option>';
    }
}

// SAVE NEW DRUG
window.saveDrug = async function(e) {
    e.preventDefault();
    const newDrug = {
        name: document.getElementById('drug-name').value.trim(),
        dosePerKg: parseFloat(document.getElementById('drug-dose-per-kg').value),
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

// CALCULATE
window.performCalculation = function() {
    const drugId = document.getElementById('calc-drug-select').value;
    const weight = parseFloat(document.getElementById('patient-weight').value) || 0;
    const concMg = parseFloat(document.getElementById('conc-mg').value) || 1;
    const concMl = parseFloat(document.getElementById('conc-ml').value) || 1;

    const drug = drugDatabase.find(d => d.id === drugId);
    if (!drug) return;
    if (weight <= 0) { alert('Please enter patient weight.'); return; }

    const concentration = concMg / concMl; // mg per ml
    let doseMg = drug.dosePerKg * weight;
    let cappedByMax = false;

    if (drug.maxDose && doseMg > drug.maxDose) {
        doseMg = drug.maxDose;
        cappedByMax = true;
    }

    const dailyMl = doseMg / concentration;
    const perDoseMl = dailyMl / drug.timesPerDay;
    const perDoseMg = doseMg / drug.timesPerDay;

    document.getElementById('out-preparation').textContent =
        `${dailyMl.toFixed(2)} ml  (${doseMg.toFixed(2)} mg)`;
    document.getElementById('out-daily').textContent =
        `${perDoseMl.toFixed(2)} ml  (${perDoseMg.toFixed(2)} mg)  ×  ${drug.timesPerDay} times/day`;

    const maxNote = document.getElementById('out-maxdose-note');
    maxNote.textContent = cappedByMax
        ? `Note: Dose capped at maximum dose of ${drug.maxDose} mg.`
        : '';

    const warningEl = document.getElementById('out-warning');
    const timingText = drug.timing ? `Timing: ${drug.timing}` : '';
    const cautionText = drug.cautionNote ? `Caution: ${drug.cautionNote}` : '';
    warningEl.textContent = [timingText, cautionText].filter(Boolean).join('  |  ');

    document.getElementById('calc-results').style.display = 'block';
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
                <span>Dose: <strong>${drug.dosePerKg} mg/kg</strong></span>
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
    document.getElementById('edit-drug-dose-per-kg').value = drug.dosePerKg;
    document.getElementById('edit-times-per-day').value = drug.timesPerDay;
    document.getElementById('edit-max-dose').value = drug.maxDose || '';
    document.getElementById('edit-medication-timing').value = drug.timing || 'ante cibum';
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
        dosePerKg: parseFloat(document.getElementById('edit-drug-dose-per-kg').value),
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
