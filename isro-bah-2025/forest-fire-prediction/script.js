const SCALER_MEAN = [25.122604419584352, 81.36147517628972, 24.983303840778987, 41.74993175085285, 2.2733087588671608, 0.000824312287159012, 11505570.081579112, 1.4687645972885461, 1.4200800151207822, 0.6981464858107526, -0.4910497139323728, 0.801619600537817, -0.2781698041775489];

const SCALER_SCALE = [6.698981030650625, 7.546995836906652, 14.566003437130558, 24.90361620131264, 1.4326293462030555, 0.0037353850987487157, 5306988.5686583705, 1.3559572336208348, 0.8837474999326552, 0.3443104213283698, 0.3910396355380254, 0.25195159198622774, 0.46534715146116484];

const FEATURE_ORDER = ['latitude', 'longitude', 'air_temp_c', 'relative_humidity_percent', 'wind_speed_ms', 'total_precipitation_m', 'net_solar_radiation_j_m2', 'leaf_area_index_high_veg', 'leaf_area_index_low_veg', 'month_sin', 'month_cos', 'day_of_year_sin', 'day_of_year_cos'];


const form = document.getElementById('prediction-form');
const resultContainer = document.getElementById('result-container');
const loader = document.getElementById('loader');
const predictButton = document.getElementById('predict-button');
const statusDisplay = document.getElementById('status-display');
const dateInput = document.getElementById('prediction_date');
const latitudeInput = document.getElementById('latitude-input');
const longitudeInput = document.getElementById('longitude-input');

let model, selectedLocation, mapMarker;

const map = L.map('map').setView([22.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

function updateLocation(lat, lon, source) {
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return;
    }

    selectedLocation = { lat, lon };
    statusDisplay.textContent = `Selected: Lat: ${lat.toFixed(4)}, Lng: ${lon.toFixed(4)}`;
    predictButton.disabled = false;

    if (mapMarker) {
        mapMarker.setLatLng(selectedLocation);
    } else {
        mapMarker = L.marker(selectedLocation).addTo(map);
    }

    if (source === 'inputs') {
        map.panTo(selectedLocation);
    }
    
    if (source === 'map') {
        latitudeInput.value = lat.toFixed(6);
        longitudeInput.value = lon.toFixed(6);
    }
}

map.on('click', e => updateLocation(e.latlng.lat, e.latlng.lng, 'map'));
latitudeInput.addEventListener('input', () => updateLocation(parseFloat(latitudeInput.value), parseFloat(longitudeInput.value), 'inputs'));
longitudeInput.addEventListener('input', () => updateLocation(parseFloat(latitudeInput.value), parseFloat(longitudeInput.value), 'inputs'));

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

document.addEventListener('DOMContentLoaded', () => {
    dateInput.valueAsDate = new Date();
    loadModel();
});

async function getEnvironmentalData(lat, lon, date) {
    const apiParams = 'T2M,RH2M,WS10M,ALLSKY_SFC_SW_DWN,PRECTOTCORR';
    const dateString = date.replace(/-/g, '');
    const apiUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${apiParams}&start=${dateString}&end=${dateString}&latitude=${lat}&longitude=${lon}&community=AG&format=json`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`NASA API Error: ${response.statusText}`);
    const data = await response.json();
    if (Object.keys(data.properties.parameter).length === 0) {
        throw new Error('NASA API returned no data for this location/date.');
    }
    return data.properties.parameter;
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!model || !selectedLocation) return;

    loader.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    statusDisplay.textContent = 'Fetching NASA weather data...';

    try {
        const dateString = dateInput.value;
        const apiData = await getEnvironmentalData(selectedLocation.lat, selectedLocation.lon, dateString);
        
        statusDisplay.textContent = 'Data received. Running prediction...';
        
        const dateKey = dateString.replace(/-/g, '');
        const rawValues = {
            latitude: selectedLocation.lat,
            longitude: selectedLocation.lon,
            year: parseInt(dateString.substring(0, 4)),
            air_temp_c: apiData.T2M[dateKey],
            relative_humidity_percent: apiData.RH2M[dateKey],
            wind_speed_ms: apiData.WS10M[dateKey],
            total_precipitation_m: apiData.PRECTOTCORR[dateKey] / 1000,
            net_solar_radiation_j_m2: apiData.ALLSKY_SFC_SW_DWN[dateKey] * 1e6,
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
        
        console.log(`Raw prediction probability: ${probability[0]}`);
        displayResult(probability[0] > 0.5);
        
        tf.dispose([inputTensor, prediction]);

    } catch (error) {
        statusDisplay.textContent = 'Prediction failed. See console for details.';
        resultContainer.textContent = `Error: ${error.message}`;
        resultContainer.className = 'high-risk';
        resultContainer.classList.remove('hidden');
        console.error(error);
    } finally {
        loader.classList.add('hidden');
    }
});

function displayResult(isHighRisk) {
    resultContainer.classList.remove('hidden', 'low-risk', 'high-risk');
    if (isHighRisk) {
        resultContainer.textContent = 'Fire Detected: YES (High Risk)';
        resultContainer.classList.add('high-risk');
    } else {
        resultContainer.textContent = 'Fire Detected: NO (Low Risk)';
        resultContainer.classList.add('low-risk');
    }
}