// 1. Import Firebase SDK modules from official CDNs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 2. PASTE YOUR EXACT FIREBASE CONFIG OBJECT HERE
const firebaseConfig = {
    apiKey: "AIzaSyCgOLUbiqiru0hB23Zf_tQMzNMw20SVEzY",
    authDomain: "drugcal-5ea14.firebaseapp.com",
    projectId: "drugcal-5ea14",
    storageBucket: "drugcal-5ea14.firebasestorage.app",
    messagingSenderId: "283126928680",
    appId: "1:283126928680:web:c5feefee4994aea6acac1d",
    measurementId: "G-W8816DLN68"
  };

// 3. Initialize Firebase and Firestore Database instance
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global Array to keep a copy of data in memory for fast local queries
let drugDatabase = [];

// Expose navigation function globally so onclick="" attributes can find it
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    if(tabId === 'calc-tab') {
        fetchDrugsFromFirebase();
    }
}

// Show/Hide fields based on calculation type selection
window.toggleFormFields = function() {
    const type = document.getElementById('calc-type').value;
    if (type === 'age-range') {
        document.getElementById('standard-dosage-inputs').style.display = 'none';
        document.getElementById('age-range-inputs').style.display = 'block';
    } else {
        document.getElementById('standard-dosage-inputs').style.display = 'block';
        document.getElementById('age-range-inputs').style.display = 'none';
    }
}

// Age Range dynamic fields builder
window.addAgeRangeRow = function() {
    const wrapper = document.getElementById('range-rows');
    const row = document.createElement('div');
    row.className = 'input-row range-entry';
    row.innerHTML = `
        <input type="number" placeholder="Min Age" class="r-min" required>
        <input type="number" placeholder="Max Age" class="r-max" required>
        <input type="number" step="0.1" placeholder="Normal" class="r-norm" required>
        <input type="number" step="0.1" placeholder="Emerg" class="r-emerg" required>
    `;
    wrapper.appendChild(row);
}

// SAVE TO FIREBASE FIRESTORE
window.saveDrug = async function(e) {
    e.preventDefault();
    const name = document.getElementById('drug-name').value;
    const calcType = document.getElementById('calc-type').value;
    const contraInput = document.getElementById('contraindications').value;
    const contraindications = contraInput.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    let newDrug = { name, calcType, contraindications };

    if (calcType === 'age-range') {
        newDrug.ranges = [];
        document.querySelectorAll('.range-entry').forEach(row => {
            newDrug.ranges.push({
                min: parseInt(row.querySelector('.r-min').value),
                max: parseInt(row.querySelector('.r-max').value),
                normal: parseFloat(row.querySelector('.r-norm').value),
                emergency: parseFloat(row.querySelector('.r-emerg').value)
            });
        });
    } else {
        newDrug.normal = parseFloat(document.getElementById('base-normal').value) || 0;
        newDrug.emergency = parseFloat(document.getElementById('base-emergency').value) || 0;
    }

    try {
        // Send object safely to Firestore cloud database under a collection named "drugs"
        await addDoc(collection(db, "drugs"), newDrug);
        alert('Drug Saved Globally to Firebase!');
        
        document.getElementById('drug-form').reset();
        document.getElementById('range-rows').innerHTML = '';
        window.switchTab('calc-tab');
    } catch (error) {
        console.error("Error writing document to Firebase: ", error);
        alert("Failed to save data to cloud server.");
    }
}

// FETCH FROM FIREBASE FIRESTORE
async function fetchDrugsFromFirebase() {
    const select = document.getElementById('calc-drug-select');
    select.innerHTML = '<option>Loading database...</option>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "drugs"));
        drugDatabase = []; // clear previous local array cache
        
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id; // append the dynamic Firestore ID
            drugDatabase.push(data);
        });

        // Populate dropdown menu with items
        select.innerHTML = '';
        if (drugDatabase.length === 0) {
            select.innerHTML = '<option value="">No drugs found. Add one!</option>';
            return;
        }

        drugDatabase.forEach(drug => {
            let opt = document.createElement('option');
            opt.value = drug.id;
            opt.textContent = drug.name;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error("Error reading data from Firebase:", error);
        select.innerHTML = '<option>Error loading server records.</option>';
    }
}

// DOSAGE EVALUATION CORE
window.performCalculation = function() {
    const drugId = document.getElementById('calc-drug-select').value;
    const age = parseInt(document.getElementById('patient-age').value) || 0;
    const height = parseFloat(document.getElementById('patient-height').value) || 0;
    const weight = parseFloat(document.getElementById('patient-weight').value) || 0;

    const drug = drugDatabase.find(d => d.id === drugId);
    if(!drug) return;

    let normalDose = 0;
    let emergencyDose = 0;

    if (drug.calcType === 'weight') {
        normalDose = weight * drug.normal;
        emergencyDose = weight * drug.emergency;
    } else if (drug.calcType === 'height-weight') {
        normalDose = (height * weight) * drug.normal;
        emergencyDose = (height * weight) * drug.emergency;
    } else if (drug.calcType === 'age-range') {
        const matchedRange = drug.ranges.find(r => age >= r.min && age <= r.max);
        if (matchedRange) {
            normalDose = matchedRange.normal;
            emergencyDose = matchedRange.emergency;
        } else {
            alert("No standard dosage rules match this patient's age range.");
            return;
        }
    }

    document.getElementById('out-normal').textContent = `${normalDose.toFixed(2)} mg`;
    document.getElementById('out-emergency').textContent = `${emergencyDose.toFixed(2)} mg`;

    if(drug.contraindications && drug.contraindications.length > 0) {
        document.getElementById('out-warning').textContent = `⚠️ Warnings! Avoid if patient has vulnerabilities in: ${drug.contraindications.join(', ')}`;
    } else {
        document.getElementById('out-warning').textContent = '';
    }
}

// Initial Boot run logic
fetchDrugsFromFirebase();