// src/services/api.js
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Health check endpoint
 */
export const healthCheck = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

/**
 * Get list of barangays from uploaded file
 * @param {File} file - Excel file (.xlsx or .xls)
 * @returns {Promise<{barangays: string[]}>}
 */
export const getBarangays = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/barangays`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get barangays');
    }

    return await response.json();
  } catch (error) {
    console.error('Get barangays failed:', error);
    throw error;
  }
};

/**
 * Generate forecast using LSTM model
 * @param {File} file - Excel file with health data
 * @param {string} barangay - Selected barangay name
 * @param {string[]} diseases - Array of disease columns to forecast
 * @param {number} forecastMonths - Number of months to forecast (default: 6)
 * @returns {Promise<ForecastData>}
 */
export const getForecast = async (file, barangay, diseases, forecastMonths = 6) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('barangay', barangay);
    
    // Add each disease
    diseases.forEach(disease => {
      formData.append('diseases', disease);
    });
    
    formData.append('forecast_months', forecastMonths);

    const response = await fetch(`${API_BASE_URL}/forecast`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Forecast failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Forecast failed:', error);
    throw error;
  }
};

/**
 * Disease name mapping (column names in Excel -> display names)
 */
export const DISEASE_MAPPING = {
  'dengue_cases': 'Dengue',
  'diarrhea_cases': 'Diarrhea', 
  'respiratory_cases': 'Respiratory',
  'malnutrition_prevalence_pct': 'Malnutrition'
};

/**
 * Get disease display name
 */
export const getDiseaseName = (columnName) => {
  return DISEASE_MAPPING[columnName] || columnName;
};