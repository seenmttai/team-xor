const SCALER_MEAN = [25.122604419584352, 81.36147517628972, 24.983303840778987, 41.74993175085285, 2.2733087588671608, 0.000824312287159012, 11505570.081579112, 1.4687645972885461, 1.4200800151207822, 2022.0599639541392, 0.6981464858107526, -0.4910497139323728, 0.801619600537817, -0.2781698041775489];
const SCALER_SCALE = [6.698981030650625, 7.546995836906652, 14.566003437130558, 24.90361620131264, 1.4326293462030555, 0.0037353850987487157, 5306988.5686583705, 1.3559572336208348, 0.8837474999326552, 1.3577813968976902, 0.3443104213283698, 0.3910396355380254, 0.25195159198622774, 0.46534715146116484];
const FEATURE_ORDER = ['latitude', 'longitude', 'air_temp_c', 'relative_humidity_percent', 'wind_speed_ms', 'total_precipitation_m', 'net_solar_radiation_j_m2', 'leaf_area_index_high_veg', 'leaf_area_index_low_veg', 'year', 'month_sin', 'month_cos', 'day_of_year_sin', 'day_of_year_cos'];

const form = document.getElementById('prediction-form');
const resultContainer = document.getElementById('result-container');
const loader = document.getElementById('loader');
const predictButton = document.getElementById('predict-button');

let model;

async function loadModel() {
    try {
        model = await tf.loadGraphModel('model/model.json');
        predictButton.disabled = false;
        predictButton.textContent = 'Predict Risk';
    } catch (error) {
        predictButton.textContent = 'Could not load model';
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
    predictButton.disabled = true;
    predictButton.textContent = 'Loading Model...';
    loadModel();
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!model) {
        alert('Model is not loaded yet. Please wait.');
        return;
    }

    loader.classList.remove('hidden');
    resultContainer.classList.add('hidden');

    try {
        const formData = new FormData(event.target);
        const rawValues = {};
        for (const [key, value] of formData.entries()) {
            if (key !== 'prediction_date') {
                 rawValues[key] = parseFloat(value);
            }
        }

        const dateString = document.getElementById('prediction_date').value;
        const date = new Date(dateString.replace(/-/g, '/'));
        
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const dayOfYear = getDayOfYear(date);

        rawValues['year'] = year;
        rawValues['month_sin'] = Math.sin(2 * Math.PI * month / 12.0);
        rawValues['month_cos'] = Math.cos(2 * Math.PI * month / 12.0);
        rawValues['day_of_year_sin'] = Math.sin(2 * Math.PI * dayOfYear / 365.0);
        rawValues['day_of_year_cos'] = Math.cos(2 * Math.PI * dayOfYear / 365.0);

        const inputData = FEATURE_ORDER.map(name => rawValues[name]);
        
        const scaledData = inputData.map((value, i) => {
            return (value - SCALER_MEAN[i]) / SCALER_SCALE[i];
        });

        const inputTensor = tf.tensor2d([scaledData], [1, FEATURE_ORDER.length]);
        const prediction = model.predict(inputTensor);
        const probability = await prediction.data();

        displayResult(probability[0]);
        
        inputTensor.dispose();
        prediction.dispose();

    } catch (error) {
        resultContainer.textContent = 'An error occurred during prediction. Please check all inputs.';
        resultContainer.className = 'danger';
        resultContainer.classList.remove('hidden');
        console.error(error);
    } finally {
        loader.classList.add('hidden');
    }
});

function displayResult(probability) {
    const percentage = (probability * 100).toFixed(2);
    resultContainer.classList.remove('hidden', 'safe', 'danger');

    if (probability > 0.5) {
        resultContainer.innerHTML = `<strong>High Risk:</strong> ${percentage}% probability of fire.`;
        resultContainer.classList.add('danger');
    } else {
        resultContainer.innerHTML = `<strong>Low Risk:</strong> ${percentage}% probability of fire.`;
        resultContainer.classList.add('safe');
    }
}