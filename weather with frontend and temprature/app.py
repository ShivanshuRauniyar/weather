from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import requests
import numpy as np
from sklearn.linear_model import LinearRegression
import json

# Configure paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')

# Create directories if they don't exist
if not os.path.exists(PUBLIC_DIR):
    os.makedirs(PUBLIC_DIR)

app = Flask(__name__, static_folder=PUBLIC_DIR, static_url_path='')
CORS(app)

# Weather API Config
API_KEY = "9685f38713234d8851954d583ec9de70"
BASE_URL = "https://api.openweathermap.org/data/2.5/weather"
AIR_QUALITY_URL = "http://api.openweathermap.org/data/2.5/air_pollution"

# Initialize temperature data
temperature_data = {}

# Load existing data if available
if os.path.exists('temp_data.json'):
    with open('temp_data.json', 'r') as f:
        temperature_data = json.load(f)

@app.route('/')
def serve_index():
    return send_from_directory(PUBLIC_DIR, 'index.html')

@app.route('/weather-prediction')
def serve_weather_prediction():
    return send_from_directory(PUBLIC_DIR, 'weather_prediction.html')

@app.route('/api/weather', methods=['POST'])
def get_weather():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        
        params = {'units': 'metric', 'appid': API_KEY}
        geo_params = {}
        
        if 'city' in data:
            params['q'] = geo_params['q'] = data['city'].strip()
        elif 'lat' in data and 'lon' in data:
            params['lat'] = geo_params['lat'] = data['lat']
            params['lon'] = geo_params['lon'] = data['lon']
        else:
            return jsonify({"success": False, "error": "Provide city or coordinates"}), 400
        
        # Get weather data
        weather_response = requests.get(BASE_URL, params=params)
        weather_response.raise_for_status()
        weather_data = weather_response.json()
        
        # Get coordinates if we only had city name
        if 'city' in data:
            geo_response = requests.get(
                "http://api.openweathermap.org/geo/1.0/direct",
                params={'q': data['city'], 'limit': 1, 'appid': API_KEY}
            )
            geo_response.raise_for_status()
            geo_data = geo_response.json()
            if not geo_data:
                return jsonify({"success": False, "error": "City not found"}), 404
            geo_params['lat'] = geo_data[0]['lat']
            geo_params['lon'] = geo_data[0]['lon']
        
        # Get air quality data
        aqi_response = requests.get(AIR_QUALITY_URL, params={
            'lat': geo_params['lat'],
            'lon': geo_params['lon'],
            'appid': API_KEY
        })
        
        aqi_data = None
        pollutants = None
        
        if aqi_response.status_code == 200:
            aqi_data = aqi_response.json()
            if aqi_data and 'list' in aqi_data and len(aqi_data['list']) > 0:
                components = aqi_data['list'][0]['components']
                pollutants = {
                    'co': components.get('co'),  # mg/m³
                    'o3': components.get('o3'),  # µg/m³
                    'nh3': components.get('nh3'),  # µg/m³
                    'c6h6': components.get('c6h6'),  # µg/m³
                    'so2': components.get('so2'),  # µg/m³
                    'no2': components.get('no2')   # µg/m³
                }
        
        # Prepare response
        response_data = {
            "success": True,
            "name": weather_data.get("name"),
            "main": {
                "temp": weather_data["main"]["temp"],
                "humidity": weather_data["main"]["humidity"],
                "feels_like": weather_data["main"]["feels_like"],
                "temp_min": weather_data["main"]["temp_min"],
                "temp_max": weather_data["main"]["temp_max"]
            },
            "wind": {
                "speed": weather_data["wind"]["speed"],
                "deg": weather_data["wind"].get("deg", 0)
            },
            "weather": weather_data["weather"],
            "coord": weather_data.get("coord", {}),
            "air_quality": aqi_data['list'][0]['main']['aqi'] if aqi_data else None,
            "pollutants": pollutants
        }
        
        return jsonify(response_data)
        
    except requests.exceptions.HTTPError as e:
        error_msg = "City not found" if e.response.status_code == 404 else "Weather service error"
        return jsonify({"success": False, "error": error_msg}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/update-temp', methods=['POST'])
def update_temperature():
    try:
        data = request.get_json()
        city = data.get('city')
        temp = data.get('temp')
        
        if not city or temp is None:
            return jsonify({"success": False, "error": "City and temperature are required"}), 400

        if city not in temperature_data:
            temperature_data[city] = []

        day = len(temperature_data[city]) + 1
        temperature_data[city].append([day, float(temp)])
        
        # Save to file
        with open('temp_data.json', 'w') as f:
            json.dump(temperature_data, f)
            
        return jsonify({"success": True, "message": "Temperature data updated"})
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/predict-temp', methods=['GET'])
def predict_temperature():
    try:
        city = request.args.get('city')
        if not city:
            return jsonify({"success": False, "error": "City is required"}), 400

        if city not in temperature_data or len(temperature_data[city]) < 3:
            return jsonify({"success": False, "error": "Not enough data for prediction"}), 400

        # Prepare data for prediction
        data = temperature_data[city]
        X = np.array([day[0] for day in data]).reshape(-1, 1)
        y = np.array([day[1] for day in data])

        # Train model
        model = LinearRegression()
        model.fit(X, y)

        # Predict next day
        next_day = len(data) + 1
        predicted_temp = model.predict(np.array([[next_day]]))[0]

        return jsonify({
            "success": True,
            "city": city,
            "predicted_temp": round(float(predicted_temp), 2),
            "days": [day[0] for day in data],
            "temps": [day[1] for day in data]
        })
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/<path:path>')
def serve_static(path):
    file_path = os.path.join(PUBLIC_DIR, path)
    if os.path.exists(file_path) and not os.path.isdir(file_path):
        return send_from_directory(PUBLIC_DIR, path)
    return send_from_directory(PUBLIC_DIR, 'index.html')

if __name__ == '__main__':
    app.run(port=3000, debug=True)