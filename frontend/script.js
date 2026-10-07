document.addEventListener('DOMContentLoaded', function() {
    const dataSourceInfo = document.getElementById('dataSourceInfo');
    const dataTimestamp = document.getElementById('dataTimestamp');
    const riskScenarioCheckbox = document.getElementById('riskScenarioCheckbox');
    const predictBtn = document.getElementById('predictBtn');
    const resultSection = document.getElementById('resultSection');
    const riskDisplay = document.getElementById('riskDisplay');
    const probabilityDisplay = document.getElementById('probabilityDisplay');
    const messageDisplay = document.getElementById('messageDisplay');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const sensorGrid = document.getElementById('sensorGrid');

    // Feature names and display names (must match the API)
    const FEATURES = [
        { key: 'Average Water Speed', display: 'Average Water Speed', unit: 'm/s' },
        { key: 'Average Water Direction', display: 'Average Water Direction', unit: '°' },
        { key: 'Chlorophyll', display: 'Chlorophyll', unit: 'µg/L' },
        { key: 'Temperature', display: 'Temperature', unit: '°C' },
        { key: 'Dissolved Oxygen', display: 'Dissolved Oxygen', unit: 'mg/L' },
        { key: 'Dissolved Oxygen (%Saturation)', display: 'Dissolved Oxygen Saturation', unit: '%' },
        { key: 'pH', display: 'pH', unit: '' },
        { key: 'Salinity', display: 'Salinity', unit: 'PSU' },
        { key: 'Specific Conductance', display: 'Specific Conductance', unit: 'µS/cm' },
        { key: 'Turbidity', display: 'Turbidity', unit: 'NTU' },
        { key: 'Turbidity_max', display: 'Turbidity Max', unit: 'NTU' },
        { key: 'Rainfall (mm)', display: 'Rainfall', unit: 'mm' },
        { key: 'Air Temperature (degC)', display: 'Air Temperature', unit: '°C' },
        { key: 'Relative Humidity (%)', display: 'Relative Humidity', unit: '%' },
        { key: 'Wind Speed (m/s)', display: 'Wind Speed', unit: 'm/s' },
        { key: 'Rainfall_6H', display: 'Rainfall 6H', unit: 'mm' },
        { key: 'Turbidity_delta_3h', display: 'Turbidity Delta 3H', unit: '' }
    ];

    // Create a mapping from snake_case (as returned by /api/latest-data) to original feature key
    const snakeToOriginalMap = {};
    FEATURES.forEach(feature => {
        const snakeKey = feature.key.toLowerCase()
            .replace(/ /g, '_')
            .replace(/\(\%/g, '_')
            .replace(/\)%/g, '')
            .replace(/\./g, '_');
        snakeToOriginalMap[snakeKey] = feature.key;
    });

    // Store current data (latest or high-risk scenario) in original feature key format
    let currentData = {};
    let currentTimestamp = '';

    // Fetch latest data and display it
    async function loadLatestData() {
        try {
            // Show loading state for data fetch
            predictBtn.disabled = true;
            loadingOverlay.classList.remove('hidden');
            loadingOverlay.querySelector('p').textContent = 'Loading latest sensor data...';

            const response = await fetch('/api/latest-data');
            if (!response.ok) {
                throw new Error(`Failed to load latest data: ${response.status}`);
            }

            const result = await response.json();
            const data = result.data;

            // Convert snake_case keys to original feature keys
            const convertedData = {};
            for (const [snakeKey, value] of Object.entries(data)) {
                if (snakeKey === 'timestamp') {
                    currentTimestamp = value;
                } else if (snakeToOriginalMap.hasOwnProperty(snakeKey)) {
                    convertedData[snakeToOriginalMap[snakeKey]] = value;
                }
                // Ignore any other keys (shouldn't happen)
            }
            currentData = convertedData;

            // Update timestamp
            if (currentTimestamp) {
                dataTimestamp.textContent = currentTimestamp;
                dataSourceInfo.classList.remove('hidden');
            }

            // If high-risk scenario is not checked, display the latest data
            if (!riskScenarioCheckbox.checked) {
                displaySensorData(currentData);
            }

            predictBtn.disabled = false;
            loadingOverlay.classList.add('hidden');
        } catch (error) {
            console.error('Error loading latest data:', error);
            messageDisplay.textContent = `Error: ${error.message}`;
            messageDisplay.style.color = '#dc3545';
            resultSection.classList.remove('hidden');
            resultSection.style.backgroundColor = '#f8d7da';
            predictBtn.disabled = false;
            loadingOverlay.classList.add('hidden');
        }
    }

    // Display sensor data in the grid
    function displaySensorData(data) {
        // Clear the grid
        sensorGrid.innerHTML = '';

        // Create a card for each feature
        FEATURES.forEach(feature => {
            const value = data[feature.key];
            if (value !== undefined && value !== null) {
                const card = document.createElement('div');
                card.className = 'sensor-card';

                const label = document.createElement('div');
                label.className = 'sensor-label';
                label.textContent = feature.display;

                const valueDiv = document.createElement('div');
                valueDiv.className = 'sensor-value';
                // Format the value: if it's an integer, show as integer, else show 3 decimal places
                if (Number.isInteger(value)) {
                    valueDiv.textContent = value + feature.unit;
                } else {
                    valueDiv.textContent = value.toFixed(3) + feature.unit;
                }

                card.appendChild(label);
                card.appendChild(valueDiv);
                sensorGrid.appendChild(card);
            }
        });
    }

    // Apply high-risk scenario: modify the two specific fields
    function applyHighRiskScenario(data) {
        const modifiedData = { ...data };
        modifiedData['Turbidity'] = 12;
        modifiedData['Rainfall_6H'] = 20;
        return modifiedData;
    }

    // Risk scenario checkbox handler
    riskScenarioCheckbox.addEventListener('change', function() {
        if (this.checked) {
            // Apply high-risk scenario to the current data
            const highRiskData = applyHighRiskScenario(currentData);
            displaySensorData(highRiskData);
            // Update the data source info to indicate high-risk scenario
            dataSourceInfo.innerHTML = '<small>Using <strong>High-Risk Scenario</strong> values</small>';
        } else {
            // Revert to latest data
            displaySensorData(currentData);
            // Update the data source info to show timestamp
            if (currentTimestamp) {
                dataTimestamp.textContent = currentTimestamp;
                dataSourceInfo.innerHTML = `<small>Using data from: <span id="dataTimestamp">${currentTimestamp}</span></small>`;
            } else {
                dataSourceInfo.innerHTML = '<small>Using latest dataset entry</small>';
            }
        }
    });

    // Prediction button handler
    predictBtn.addEventListener('click', async function() {
        // Show loading state
        predictBtn.disabled = true;
        loadingOverlay.classList.remove('hidden');
        resultSection.classList.add('hidden');

        try {
            // Determine which data to use for prediction
            let predictionData = { ...currentData };
            if (riskScenarioCheckbox.checked) {
                predictionData = applyHighRiskScenario(currentData);
            }

            // Make API request - send data with original feature keys (which are the aliases the model expects)
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(predictionData)
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
    });

    // Function to display prediction result
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

    // Initialize: load latest data on page load
    loadLatestData();
});