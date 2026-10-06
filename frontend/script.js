document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('predictionForm');
    const predictBtn = document.getElementById('predictBtn');
    const resultSection = document.getElementById('resultSection');
    const riskDisplay = document.getElementById('riskDisplay');
    const probabilityDisplay = document.getElementById('probabilityDisplay');
    const messageDisplay = document.getElementById('messageDisplay');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // Form submission handler
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        predictRisk();
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
                'avg_water_speed': 'Average_Water_Speed',
                'avg_water_direction': 'Average_Water_Direction',
                'chlorophyll': 'Chlorophyll',
                'temperature': 'Temperature',
                'dissolved_oxygen': 'Dissolved_Oxygen',
                'dissolved_oxygen_sat': 'Dissolved_Oxygen_Saturation',
                'ph': 'pH',
                'salinity': 'Salinity',
                'specific_conductance': 'Specific_Conductance',
                'turbidity': 'Turbidity',
                'turbidity_max': 'Turbidity_max',
                'rainfall': 'Rainfall_mm',
                'air_temp': 'Air_Temperature_degC',
                'relative_humidity': 'Relative_Humidity',
                'wind_speed': 'Wind_Speed_m_s',
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