import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// Helper to determine the unit suffix text based on 'Calculated From' selection
function getUnitText() {
    const fromValue = document.getElementById('calc-from').value;
    if (fromValue === 'age') return 'years';
    if (fromValue === 'weight') return 'kg';
    if (fromValue === 'height*weight') return 'factor';
    return 'value';
}

// Global Tab Navigation
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('onclick') === `switchTab('${tabId}')`) {
            btn.classList.add('active');
        }
    });

    if(tabId === 'calc-tab') {
        fetchDrugsFromFirebase();
        document.getElementById('calc-results').style.display = 'none';
    }
}

// Updates live display placeholders when 'Calculated From' updates
window.updateCalculatedFromLabels = function() {
    toggleFormFields();
}

// Re-evaluates form structural rules based on layout selections
window.toggleFormFields = function() {
    const calcBy = document.getElementById('calc-by').value;
    const singleContainer = document.getElementById('single-rule-inputs');
    const rangeContainer = document.getElementById('range-rule-inputs');
    const addSingleBtn = document.getElementById('add-single-btn');
    
    // Reset dynamic UI nodes
    document.getElementById('single-rule-rows').innerHTML = '';
    document.getElementById('range-rows').innerHTML = '';

    if (calcBy === 'range') {
        singleContainer.style.display = 'none';
        rangeContainer.style.display = 'block';
        addRangeRow();
    } else {
        singleContainer.style.display = 'block';
        rangeContainer.style.display = 'none';
        
        // Show the add row button ONLY for constant mode
        addSingleBtn.style.display = (calcBy === 'constant') ? 'inline-block' : 'none';
        addSingleRuleRow();
    }
}

// Injects row for Static and Constant rules
window.addSingleRuleRow = function() {
    const wrapper = document.getElementById('single-rule-rows');
    const row = document.createElement('div');
    row.className = 'input-row single-entry';
    
    const unitText = getUnitText();
    
    row.innerHTML = `
        <div>
            <label>Threshold (${unitText}):</label>
            <input type="number" step="0.1" class="s-threshold" required>
        </div>
        <div>
            <label>Dosage:</label>
            <input type="number" step="0.1" class="s-dosage" required>
        </div>
        <div>
            <label>Dose Unit:</label>
            <select class="s-unit">
                <option value="ml">ml</option>
                <option value="cc">cc</option>
                <option value="tablespoon">tablespoon</option>
            </select>
        </div>
    `;
    wrapper.appendChild(row);
}

// Injects row for Range configurations
window.addRangeRow = function() {
    const wrapper = document.getElementById('range-rows');
    const row = document.createElement('div');
    row.className = 'input-row range-entry';
    
    const unitText = getUnitText();

    row.innerHTML = `
        <div>
            <label>Start (${unitText}):</label>
            <input type="number" step="0.1" class="r-start" required>
        </div>
        <div>
            <label>End (${unitText}):</label>
            <input type="number" step="0.1" class="r-end" required>
        </div>
        <div>
            <label>Dosage:</label>
            <input type="number" step="0.1" class="r-dosage" required>
        </div>
        <div>
            <label>Dose Unit:</label>
            <select class="r-unit">
                <option value="ml">ml</option>
                <option value="cc">cc</option>
                <option value="tablespoon">tablespoon</option>
            </select>
        </div>
    `;
    wrapper.appendChild(row);
}

// SAVE DATA TO FIRESTORE
window.saveDrug = async function(e) {
    e.preventDefault();
    const name = document.getElementById('drug-name').value;
    const calcFrom = document.getElementById('calc-from').value;
    const calcBy = document.getElementById('calc-by').value;
    const timesPerDay = parseInt(document.getElementById('times-per-day').value) || 1;
    const contraInput = document.getElementById('contraindications').value;
    const contraindications = contraInput.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    let newDrug = { name, calcFrom, calcBy, timesPerDay, contraindications, rules: [] };

    if (calcBy === 'range') {
        document.querySelectorAll('.range-entry').forEach(row => {
            newDrug.rules.push({
                start: parseFloat(row.querySelector('.r-start').value),
                end: parseFloat(row.querySelector('.r-end').value),
                dosage: parseFloat(row.querySelector('.r-dosage').value),
                unit: row.querySelector('.r-unit').value
            });
        });
    } else {
        document.querySelectorAll('.single-entry').forEach(row => {
            newDrug.rules.push({
                threshold: parseFloat(row.querySelector('.s-threshold').value),
                dosage: parseFloat(row.querySelector('.s-dosage').value),
                unit: row.querySelector('.s-unit').value
            });
        });
    }

    try {
        await addDoc(collection(db, "drugs"), newDrug);
        alert('Drug Saved Successfully!');
        
        document.getElementById('drug-form').reset();
        document.getElementById('calc-from').value = 'age';
        document.getElementById('calc-by').value = 'static';
        toggleFormFields();
        window.switchTab('calc-tab');
    } catch (error) {
        console.error("Error writing document: ", error);
        alert("Failed to save data to cloud server.");
    }
}

// FETCH FROM FIRESTORE
async function fetchDrugsFromFirebase() {
    const select = document.getElementById('calc-drug-select');
    select.innerHTML = '<option>Loading database...</option>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "drugs"));
        drugDatabase = [];
        
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id;
            drugDatabase.push(data);
        });

        select.innerHTML = '';
        if (drugDatabase.length === 0) {
            select.innerHTML = '<option value="">No drugs found.</option>';
            return;
        }

        drugDatabase.forEach(drug => {
            let opt = document.createElement('option');
            opt.value = drug.id;
            opt.textContent = drug.name;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error("Error reading data:", error);
        select.innerHTML = '<option>Error loading server records.</option>';
    }
}

// REFACTORED DOSAGE EVALUATION CORE
window.performCalculation = function() {
    const drugId = document.getElementById('calc-drug-select').value;
    const age = parseInt(document.getElementById('patient-age').value) || 0;
    const height = parseFloat(document.getElementById('patient-height').value) || 0;
    const weight = parseFloat(document.getElementById('patient-weight').value) || 0;

    const drug = drugDatabase.find(d => d.id === drugId);
    if(!drug) return;

    // Evaluate what target variable to match against
    let evaluateValue = 0;
    if (drug.calcFrom === 'age') evaluateValue = age;
    else if (drug.calcFrom === 'weight') evaluateValue = weight;
    else if (drug.calcFrom === 'height*weight') evaluateValue = height * weight;
    else if (drug.calcFrom === 'constant') evaluateValue = 1; // absolute scale factor

    let dosageFound = null;

    if (drug.calcBy === 'range') {
        dosageFound = drug.rules.find(r => evaluateValue >= r.start && evaluateValue <= r.end);
    } else {
        // For static / constant rules, match against nearest matched threshold mapping
        // If multiple matches are found, we'll fall back to the closest threshold limit matching criteria
        dosageFound = drug.rules.find(r => evaluateValue >= r.threshold) || drug.rules[0];
    }

    if (!dosageFound) {
        alert("No appropriate calculation metrics matched this patient's profile.");
        return;
    }

    // Normal base calculation vs structured single application dose calculations
    const normalDose = dosageFound.dosage;
    const totalDailyDose = normalDose * drug.timesPerDay;
    const doseUnit = dosageFound.unit;

    document.getElementById('out-normal').textContent = `${normalDose} ${doseUnit} (${drug.timesPerDay} times/day)`;
    document.getElementById('out-emergency').textContent = `${totalDailyDose} ${doseUnit} (Total Daily Dose)`;

    if(drug.contraindications && drug.contraindications.length > 0) {
        document.getElementById('out-warning').textContent = `Warning! Avoid if patient has vulnerabilities in: ${drug.contraindications.join(', ')}`;
    } else {
        document.getElementById('out-warning').textContent = '';
    }

    document.getElementById('calc-results').style.display = 'block';
}

// Initial Boot Run 
toggleFormFields();
fetchDrugsFromFirebase();