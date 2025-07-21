const SCALER_MEAN = [25.122604419584352, 81.36147517628972, 24.983303840778987, 41.74993175085285, 2.2733087588671608, 0.000824312287159012, 11505570.081579112, 1.4687645972885461, 1.4200800151207822, 0.6981464858107526, -0.4910497139323728, 0.801619600537817, -0.2781698041775489];
const SCALER_SCALE = [6.698981030650625, 7.546995836906652, 14.566003437130558, 24.90361620131264, 1.4326293462030555, 0.0037353850987487157, 5306988.5686583705, 1.3559572336208348, 0.8837474999326552, 0.3443104213283698, 0.3910396355380254, 0.25195159198622774, 0.46534715146116484];
const FEATURE_ORDER = ['latitude', 'longitude', 'air_temp_c', 'relative_humidity_percent', 'wind_speed_ms', 'total_precipitation_m', 'net_solar_radiation_j_m2', 'leaf_area_index_high_veg', 'leaf_area_index_low_veg', 'month_sin', 'month_cos', 'day_of_year_sin', 'day_of_year_cos'];

const ALBEDO = 0.20; 
const EMISSIVITY = 0.95;
const STEFAN_BOLTZMANN = 5.67e-8; 

const ACTIONABLE_FEATURES = [
    'air_temp_c', 'relative_humidity_percent', 'wind_speed_ms', 
    'total_precipitation_m', 'net_solar_radiation_j_m2', 
    'leaf_area_index_high_veg', 'leaf_area_index_low_veg'
];

const SUGGESTION_MAP = {
    'relative_humidity_percent': "Low humidity is a key driver. This dries out potential fuel like grass and leaves, making ignition much easier. Monitor humidity levels closely.",
    'wind_speed_ms': "High winds are increasing the risk. Wind accelerates fire spread and can carry embers long distances, starting new spot fires.",
    'air_temp_c': "High temperatures are a major factor. Hot conditions pre-heat and dry out the landscape, making it more susceptible to ignition.",
    'net_solar_radiation_j_m2': "Strong solar radiation is significantly heating and drying the ground. This is a primary contributor to the current risk level.",
    'leaf_area_index_high_veg': "The density of forest canopy (fuel) is a major factor. Areas with high LAI can support more intense crown fires.",
    'leaf_area_index_low_veg': "The amount of ground-level grass and shrubbery (fuel) is a significant factor. This is often the initial point of ignition.",
    'total_precipitation_m': "Lack of recent rainfall is a critical driver. The landscape is likely very dry and receptive to fire."
};

const form = document.getElementById('prediction-form');
const resultContainer = document.getElementById('result-container');
const loader = document.getElementById('loader');
const predictButton = document.getElementById('predict-button');
const fetchApiButton = document.getElementById('fetch-api-button');
const statusDisplay = document.getElementById('status-display');
const dateInput = document.getElementById('prediction_date');
const latitudeInput = document.getElementById('latitude-input');
const longitudeInput = document.getElementById('longitude-input');
const explanationSection = document.getElementById('explanation-section');
const suggestionsList = document.getElementById('suggestions-list');

let model, selectedLocation, mapMarker, saliencyChart;

const map = L.map('map').setView([22.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

function updateLocation(lat, lon, source) {
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
    selectedLocation = { lat, lon };
    if (!statusDisplay.textContent.startsWith('Warning:')) {
        statusDisplay.textContent = `Selected: Lat: ${lat.toFixed(4)}, Lng: ${lon.toFixed(4)}`;
    }
    fetchApiButton.disabled = false;
    if (mapMarker) mapMarker.setLatLng(selectedLocation);
    else mapMarker = L.marker(selectedLocation).addTo(map);
    if (source === 'inputs') map.panTo(selectedLocation);
    if (source === 'map') {
        latitudeInput.value = lat.toFixed(6);
        longitudeInput.value = lon.toFixed(6);
    }
}

map.on('click', e => updateLocation(e.latlng.lat, e.latlng.lng, 'map'));
latitudeInput.addEventListener('input', () => updateLocation(parseFloat(latitudeInput.value), parseFloat(longitudeInput.value), 'inputs'));
longitudeInput.addEventListener('input', () => updateLocation(parseFloat(longitudeInput.value), parseFloat(longitudeInput.value), 'inputs'));

async function loadModel() {
    try {
        model = await tf.loadGraphModel('model/model.json');
        statusDisplay.textContent = 'Model loaded. Select location/date.';
    } catch (error) {
        statusDisplay.textContent = 'Error: Could not load model.';
        console.error('Error loading model:', error);
    }
}

function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

function handleDateChange() {
    const selectedDate = new Date(dateInput.value.replace(/-/g, '/'));
    const currentYear = new Date().getFullYear();

    if (selectedDate.getFullYear() >= currentYear) {
        statusDisplay.textContent = 'Warning: For current/future dates, you must enter all weather values manually. The API only provides historical data.';
    } else {
        if (statusDisplay.textContent.startsWith('Warning:')) {
             if (selectedLocation) {
                statusDisplay.textContent = `Selected: Lat: ${selectedLocation.lat.toFixed(4)}, Lng: ${selectedLocation.lon.toFixed(4)}`;
            } else {
                statusDisplay.textContent = 'Please select a location on the map.';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const lastYearDate = new Date(today.setFullYear(today.getFullYear() - 1));
    dateInput.valueAsDate = lastYearDate;
    loadModel();
    dateInput.addEventListener('change', handleDateChange);
});

function getApiDateString(inputDateValue) {
    const date = new Date(inputDateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

async function getEnvironmentalData(lat, lon, dateValue) {
    const apiParams = 'T2M,RH2M,WS10M,ALLSKY_SFC_SW_DWN,ALLSKY_SFC_LW_DWN,PRECTOTCORR';
    const dateString = getApiDateString(dateValue);
    const nasaUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${apiParams}&start=${dateString}&end=${dateString}&latitude=${lat}&longitude=${lon}&community=AG&format=json`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(nasaUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`CORS Proxy or NASA API Error: ${response.statusText}`);
    const data = await response.json();
    if (Object.keys(data.properties.parameter).length === 0) throw new Error('NASA API returned no data.');
    return data.properties.parameter;
}

fetchApiButton.addEventListener('click', async () => {
    if (!selectedLocation) { 
        alert("Please select a location on the map first."); 
        return; 
    }

    const selectedDate = new Date(dateInput.value.replace(/-/g, '/'));
    const currentYear = new Date().getFullYear();
    if (selectedDate.getFullYear() >= currentYear) {
        alert('Warning: You are fetching for a current or future date. The API is historical and will likely fail. Manual data entry is recommended.');
    }

    statusDisplay.textContent = 'Fetching NASA weather data...';
    loader.classList.remove('hidden');
    predictButton.disabled = true;
    try {
        const apiData = await getEnvironmentalData(selectedLocation.lat, selectedLocation.lon, dateInput.value);
        const dateKey = getApiDateString(dateInput.value);
        if (apiData.T2M[dateKey] < -990) {
            const today = new Date(); today.setHours(0,0,0,0);
            const selectedApiDate = new Date(dateInput.value.replace(/-/g, '/'));
            const dayDifference = (today - selectedApiDate) / (1000 * 60 * 60 * 24);
            if(dayDifference < 3) throw new Error("API is historical. For recent dates, data may not be available. Enter forecast values manually.");
            else throw new Error("No valid data. The location is likely over water. Please select a point on land.");
        }
        
        const tempC = apiData.T2M[dateKey];
        const secondsInDay = 86400;
        const incomingShortwave_J_per_day = apiData.ALLSKY_SFC_SW_DWN[dateKey] * 1e6;
        const incomingLongwave_J_per_day = apiData.ALLSKY_SFC_LW_DWN[dateKey] * 1e6;
        const outgoingShortwave_J_per_day = incomingShortwave_J_per_day * ALBEDO;
        const tempK = tempC + 273.15;
        const outgoingLongwave_J_per_day = EMISSIVITY * STEFAN_BOLTZMANN * Math.pow(tempK, 4) * secondsInDay;
        const netRadiation = (incomingShortwave_J_per_day - outgoingShortwave_J_per_day) + (incomingLongwave_J_per_day - outgoingLongwave_J_per_day);

        document.getElementById('air_temp_c').value = tempC.toFixed(2);
        document.getElementById('relative_humidity_percent').value = apiData.RH2M[dateKey].toFixed(2);
        document.getElementById('wind_speed_ms').value = apiData.WS10M[dateKey].toFixed(2);
        document.getElementById('total_precipitation_m').value = (apiData.PRECTOTCORR[dateKey] / 1000).toFixed(6);
        
        const radInput = document.getElementById('net_solar_radiation_j_m2');
        if (netRadiation < 0) {
            radInput.value = '';
            radInput.placeholder = 'API value negative. Enter manually.';
        } else {
            radInput.value = netRadiation.toFixed(0);
        }
        
        statusDisplay.textContent = 'API data loaded. Validate values and predict.';
        predictButton.disabled = false;
    } catch (error) { statusDisplay.textContent = `Failed to fetch data: ${error.message}`; }
    finally { loader.classList.add('hidden'); }
});

function getSaliency(model, inputTensor) {
    return tf.tidy(() => {
        const predictFn = () => model.predict(inputTensor);
        const gradient = tf.grad(predictFn)(inputTensor);
        return gradient.abs().dataSync();
    });
}

function renderSaliencyChart(importances) {
    if (saliencyChart) saliencyChart.destroy();
    const ctx = document.getElementById('saliency-chart').getContext('2d');
    const sortedData = Object.entries(importances).sort((a, b) => b[1] - a[1]);
    const labels = sortedData.map(item => item[0]);
    const data = sortedData.map(item => item[1]);

    saliencyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Feature Importance',
                data: data,
                backgroundColor: 'rgba(0, 123, 255, 0.6)',
                borderColor: 'rgba(0, 123, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { display: false }, title: { display: true, text: 'Feature Importance for this Prediction' } },
            scales: { x: { beginAtZero: true } }
        }
    });
}

function generateSuggestions(importances) {
    suggestionsList.innerHTML = '';
    const sortedFeatures = Object.entries(importances).sort((a, b) => b[1] - a[1]);
    const actionableSuggestions = [];

    for (const [featureName, score] of sortedFeatures) {
        if (actionableSuggestions.length >= 2) break;
        if (ACTIONABLE_FEATURES.includes(featureName) && score > 0) {
            actionableSuggestions.push({
                feature: featureName,
                text: SUGGESTION_MAP[featureName] || "A key model parameter influencing the result."
            });
        }
    }
    
    if (actionableSuggestions.length === 0) {
        const listItem = document.createElement('li');
        listItem.textContent = "The risk is primarily driven by the location's inherent characteristics and the time of year rather than specific, immediate weather conditions.";
        suggestionsList.appendChild(listItem);
    } else {
        actionableSuggestions.forEach(suggestion => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<strong>${suggestion.feature}:</strong> ${suggestion.text}`;
            suggestionsList.appendChild(listItem);
        });
    }
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!model) return;

    loader.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    explanationSection.classList.add('hidden');
    statusDisplay.textContent = 'Running prediction...';

    try {
        const dateString = dateInput.value;
        const rawValues = {
            latitude: parseFloat(latitudeInput.value),
            longitude: parseFloat(longitudeInput.value),
            air_temp_c: parseFloat(document.getElementById('air_temp_c').value),
            relative_humidity_percent: parseFloat(document.getElementById('relative_humidity_percent').value),
            wind_speed_ms: parseFloat(document.getElementById('wind_speed_ms').value),
            total_precipitation_m: parseFloat(document.getElementById('total_precipitation_m').value),
            net_solar_radiation_j_m2: parseFloat(document.getElementById('net_solar_radiation_j_m2').value),
            leaf_area_index_high_veg: parseFloat(document.getElementById('leaf_area_index_high_veg').value),
            leaf_area_index_low_veg: parseFloat(document.getElementById('leaf_area_index_low_veg').value),
        };

        const date = new Date(dateString.replace(/-/g, '/'));
        rawValues['month_sin'] = Math.sin(2 * Math.PI * (date.getMonth() + 1) / 12.0);
        rawValues['month_cos'] = Math.cos(2 * Math.PI * (date.getMonth() + 1) / 12.0);
        rawValues['day_of_year_sin'] = Math.sin(2 * Math.PI * getDayOfYear(date) / 365.0);
        rawValues['day_of_year_cos'] = Math.cos(2 * Math.PI * getDayOfYear(date) / 365.0);
        
        const inputData = FEATURE_ORDER.map(name => rawValues[name]);
        const scaledData = inputData.map((v, i) => (v - SCALER_MEAN[i]) / SCALER_SCALE[i]);

        const inputTensor = tf.tensor2d([scaledData]);
        const prediction = model.predict(inputTensor);
        const probability = await prediction.data();
        
        const saliencyValues = getSaliency(model, inputTensor);
        const featureImportances = {};
        FEATURE_ORDER.forEach((name, i) => { featureImportances[name] = saliencyValues[i]; });
        
        console.log("Feature Saliency:", featureImportances);
        displayResult(probability[0] > 0.5);
        renderSaliencyChart(featureImportances);
        generateSuggestions(featureImportances);
        
        tf.dispose([inputTensor, prediction]);

    } catch (error) {
        statusDisplay.textContent = 'Prediction failed. Check all inputs are valid numbers.';
        resultContainer.textContent = `Error: ${error.message}`;
        resultContainer.className = 'high-risk';
        console.error(error);
    } finally {
        loader.classList.add('hidden');
    }
});

function displayResult(isHighRisk) {
    resultContainer.classList.remove('hidden', 'low-risk', 'high-risk');
    explanationSection.classList.remove('hidden');
    if (isHighRisk) {
        resultContainer.textContent = 'Fire Detected: YES (High Risk)';
        resultContainer.classList.add('high-risk');
    } else {
        resultContainer.textContent = 'Fire Detected: NO (Low Risk)';
        resultContainer.classList.add('low-risk');
    }
}