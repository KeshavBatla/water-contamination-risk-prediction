document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('predictionForm');
    const predictBtn = document.getElementById('predictBtn');
    const resultSection = document.getElementById('resultSection');
    const riskDisplay = document.getElementById('riskDisplay');
    const probabilityDisplay = document.getElementById('probabilityDisplay');
    const messageDisplay = document.getElementById('messageDisplay');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const useLatestDataBtn = document.getElementById('useLatestDataBtn');
    const dataInfo = document.getElementById('dataInfo');
    const dataTimestamp = document.getElementById('dataTimestamp');
    const riskScenarioCheckbox = document.getElementById('riskScenarioCheckbox');

    // Form submission handler
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        predictRisk();
    });

    // Use Latest Dataset Entry button handler
    useLatestDataBtn.addEventListener('click', async function() {
        try {
            useLatestDataBtn.disabled = true;
            useLatestDataBtn.textContent = 'Loading...';

            const response = await fetch('/api/latest-data');
            if (!response.ok) {
                throw new Error(`Failed to load latest data: ${response.status}`);
            }

            const result = await response.json();
            const data = result.data;

            // Populate form fields with the latest data
            Object.keys(data).forEach(key => {
                if (key !== 'timestamp' && form.elements[key]) {
                    form.elements[key].value = data[key];
                }
            });

            // Show data info
            if (data.timestamp) {
                dataTimestamp.textContent = data.timestamp;
                dataInfo.classList.remove('hidden');
            }

            useLatestDataBtn.textContent = 'Use Latest Dataset Entry';
            useLatestDataBtn.disabled = false;

        } catch (error) {
            console.error('Error loading latest data:', error);
            messageDisplay.textContent = `Error: ${error.message}`;
            messageDisplay.style.color = '#dc3545';
            resultSection.classList.remove('hidden');
            resultSection.style.backgroundColor = '#f8d7da';
            useLatestDataBtn.textContent = 'Use Latest Dataset Entry';
            useLatestDataBtn.disabled = false;
        }
    });

    // Risk scenario checkbox handler
    riskScenarioCheckbox.addEventListener('change', function() {
        if (this.checked) {
            // Apply high-risk scenario: Turbidity = 12, Rainfall_6H = 20
            form.elements['turbidity'].value = '12';
            form.elements['rainfall_6h'].value = '20';
        } else {
            // Reset to empty or let user modify manually
            // We don't reset automatically to allow user customization
        }
    });

    async function predictRisk() {
        // Show loading state
        predictBtn.disabled = true;
        loadingOverlay.classList.remove('hidden');
        resultSection.classList.add('hidden');

        try {
            // Collect form data
            const formData = new FormData(form);
            const data = {};

            // Convert form data to the format expected by the API
            const fieldMapping = {
                'avg_water_speed': 'Average Water Speed',
                'avg_water_direction': 'Average Water Direction',
                'chlorophyll': 'Chlorophyll',
                'temperature': 'Temperature',
                'dissolved_oxygen': 'Dissolved Oxygen',
                'dissolved_oxygen_sat': 'Dissolved Oxygen (%Saturation)',
                'ph': 'pH',
                'salinity': 'Salinity',
                'specific_conductance': 'Specific Conductance',
                'turbidity': 'Turbidity',
                'turbidity_max': 'Turbidity_max',
                'rainfall': 'Rainfall (mm)',
                'air_temp': 'Air Temperature (degC)',
                'relative_humidity': 'Relative Humidity (%)',
                'wind_speed': 'Wind Speed (m/s)',
                'rainfall_6h': 'Rainfall_6H',
                'turbidity_delta_3h': 'Turbidity_delta_3h'
            };

            for (const [inputName, apiName] of Object.entries(fieldMapping)) {
                const value = formData.get(inputName);
                if (value === '' || value === null) {
                    throw new Error(`Please fill in all fields`);
                }
                data[apiName] = parseFloat(value);
            }

            // Make API request
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const result = await response.json();
            displayResult(result);

        } catch (error) {
            console.error('Error:', error);
            messageDisplay.textContent = `Error: ${error.message}`;
            messageDisplay.style.color = '#dc3545';
            resultSection.classList.remove('hidden');
            resultSection.style.backgroundColor = '#f8d7da';
        } finally {
            // Hide loading state
            predictBtn.disabled = false;
            loadingOverlay.classList.add('hidden');
        }
    }

    function displayResult(result) {
        // Update risk display
        riskDisplay.textContent = result.risk;
        if (result.risk === 'High Risk') {
            riskDisplay.className = 'high-risk';
        } else {
            riskDisplay.className = 'low-risk';
        }

        // Update probability display
        probabilityDisplay.textContent = `Probability: ${result.probability.toFixed(3)}`;

        // Update message display
        messageDisplay.textContent = result.message;
        messageDisplay.style.color = '#555';

        // Show result section
        resultSection.classList.remove('hidden');
        resultSection.style.backgroundColor = 'white';
    }
});