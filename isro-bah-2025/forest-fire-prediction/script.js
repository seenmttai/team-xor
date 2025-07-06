const SCALER_MEAN = [25.122604419584352, 81.36147517628972, 24.983303840778987, 41.74993175085285, 2.2733087588671608, 0.000824312287159012, 11505570.081579112, 1.4687645972885461, 1.4200800151207822, 0.6981464858107526, -0.4910497139323728, 0.801619600537817, -0.2781698041775489];

const SCALER_SCALE = [6.698981030650625, 7.546995836906652, 14.566003437130558, 24.90361620131264, 1.4326293462030555, 0.0037353850987487157, 5306988.5686583705, 1.3559572336208348, 0.8837474999326552, 0.3443104213283698, 0.3910396355380254, 0.25195159198622774, 0.46534715146116484];

const FEATURE_ORDER = ['latitude', 'longitude', 'air_temp_c', 'relative_humidity_percent', 'wind_speed_ms', 'total_precipitation_m', 'net_solar_radiation_j_m2', 'leaf_area_index_high_veg', 'leaf_area_index_low_veg', 'month_sin', 'month_cos', 'day_of_year_sin', 'day_of_year_cos'];

const ALBEDO = 0.20;
const EMISSIVITY = 0.95;
const STEFAN_BOLTZMANN = 5.67e-8; 

const form = document.getElementById('prediction-form');
const resultContainer = document.getElementById('result-container');
const loader = document.getElementById('loader');
const predictButton = document.getElementById('predict-button');
const fetchApiButton = document.getElementById('fetch-api-button');
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
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
    selectedLocation = { lat, lon };
    if (source !== 'manual') statusDisplay.textContent = `Selected: Lat: ${lat.toFixed(4)}, Lng: ${lon.toFixed(4)}`;
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
    if (Object.keys(data.properties.parameter).length === 0) {
        throw new Error('NASA API returned no data for this location/date.');
    }
    return data.properties.parameter;
}

fetchApiButton.addEventListener('click', async () => {
    if (!selectedLocation) {
        alert("Please select a location on the map first.");
        return;
    }
    statusDisplay.textContent = 'Fetching NASA weather data...';
    loader.classList.remove('hidden');
    predictButton.disabled = true;
    try {
        const apiData = await getEnvironmentalData(selectedLocation.lat, selectedLocation.lon, dateInput.value);
        const dateKey = getApiDateString(dateInput.value);

        if (apiData.T2M[dateKey] < -990) {
            const today = new Date();
            today.setHours(0,0,0,0);
            const selectedDate = new Date(dateInput.value.replace(/-/g, '/'));
            const dayDifference = (today - selectedDate) / (1000 * 60 * 60 * 24);

            if(dayDifference < 3) {
                 throw new Error("The API is historical. For recent dates, data may not be available. Please enter forecast values manually.");
            } else {
                 throw new Error("No valid data. The location is likely over water. Please select a point on land.");
            }
        }
        
        const tempC = apiData.T2M[dateKey];
        const incomingShortwave = apiData.ALLSKY_SFC_SW_DWN[dateKey] * 1e6;
        const incomingLongwave = apiData.ALLSKY_SFC_LW_DWN[dateKey] * 1e6;
        
        const outgoingShortwave = incomingShortwave * ALBEDO;
        const tempK = tempC + 273.15;
        const outgoingLongwave = EMISSIVITY * STEFAN_BOLTZMANN * Math.pow(tempK, 4) * (24 * 60 * 60);
        const netRadiation = (incomingShortwave - outgoingShortwave) + (incomingLongwave - outgoingLongwave);

        document.getElementById('air_temp_c').value = tempC.toFixed(2);
        document.getElementById('relative_humidity_percent').value = apiData.RH2M[dateKey].toFixed(2);
        document.getElementById('wind_speed_ms').value = apiData.WS10M[dateKey].toFixed(2);
        document.getElementById('total_precipitation_m').value = (apiData.PRECTOTCORR[dateKey] / 1000).toFixed(6);
        document.getElementById('net_solar_radiation_j_m2').value = netRadiation.toFixed(0);
        
        statusDisplay.textContent = 'API data loaded. Validate values and predict.';
        predictButton.disabled = false;
    } catch (error) {
        statusDisplay.textContent = `Failed to fetch data: ${error.message}`;
    } finally {
        loader.classList.add('hidden');
    }
});


form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!model) return;

    loader.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    statusDisplay.textContent = 'Running prediction...';

    try {
        const dateString = dateInput.value;
        const rawValues = {
            latitude: parseFloat(latitudeInput.value),
            longitude: parseFloat(longitudeInput.value),
            year: parseInt(dateString.substring(0, 4)),
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
        
        console.log(`Raw prediction probability: ${probability[0]}`);
        displayResult(probability[0] > 0.5);
        
        tf.dispose([inputTensor, prediction]);

    } catch (error) {
        statusDisplay.textContent = 'Prediction failed. Check all inputs are valid numbers.';
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