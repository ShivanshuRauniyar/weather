let myChart = null;

const apiKey = "9685f38713234d8851954d583ec9de70";
const apiUrl = "https://api.openweathermap.org/data/2.5/weather?units=metric&q=";
const aqiUrl = "https://api.openweathermap.org/data/2.5/air_pollution?";

const searchBox = document.querySelector(".search input");
const searchBtn = document.querySelector(".search button");
const weatherIcon = document.querySelector(".Weather-icon");

if ("Notification" in window && Notification.permission !== "granted") {
  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      console.log("Notification permission granted.");
    }
  });
}

function showNotification(title, body) {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body: body,
      icon: "images/weather-icon.png",
    });
  }
}

async function checkWeather(city) {
  try {
    const response = await fetch(apiUrl + city + `&appid=${apiKey}`);
    const data = await response.json();

    if (data.cod === "404") {
      alert("❌ City not found!");
      return;
    }

    const todayTemp = Math.round(data.main.temp);
    const todayDate = new Date().getDate();
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed;

    // ✅ Send today's temp to Flask
    fetch('http://127.0.0.1:5000/update-temp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, day: todayDate, temp: todayTemp })
    })
      .then(res => res.json())
      .then(data => {
        console.log("✅ Temp saved:", data.message);
        alert("✅ Temp saved: " + data.message);
      })
      .catch(err => console.error("❌ Error sending to backend:", err));

    // 🌇 Update UI
    document.querySelector(".city").textContent = data.name;
    document.querySelector(".temp").textContent = todayTemp + "°C";
    document.querySelector(".humidity").textContent = humidity + "%";
    document.querySelector(".wind").textContent = windSpeed + " km/h";

    const condition = data.weather[0].main;
    const iconMap = {
      Clouds: "clouds.png",
      Clear: "clear.png",
      Rain: "rain.png",
      Drizzle: "drizzle.png",
      Mist: "mist.png",
      Thunderstorm: "storm.png",
      Snow: "snow.png"
    };
    weatherIcon.src = `images/${iconMap[condition] || "clear.png"}`;

    // 🍃 AQI
    const { lon, lat } = data.coord;
    const aqiResponse = await fetch(`${aqiUrl}lat=${lat}&lon=${lon}&appid=${apiKey}`);
    const aqiData = await aqiResponse.json();
    const aqi = aqiData.list[0].main.aqi;
    const aqiLevels = ["Good", "Fair", "Moderate", "Poor", "Very Poor"];
    document.querySelector(".aqi-value").textContent = aqiLevels[aqi - 1];

    // 🚨 Alerts
    const alertBox = document.querySelector(".alert-message");
    let alertMsg = "";
    if (aqi >= 4) {
      alertMsg = "⚠️ Poor Air Quality! Avoid going outside.";
    } else if (todayTemp >= 35) {
      alertMsg = "🔥 High Temperature! Stay hydrated.";
    } else if (condition === "Rain") {
      alertMsg = "☔ Rain expected. Carry an umbrella.";
    }
    alertBox.textContent = alertMsg;
    if (alertMsg) showNotification("Weather Alert", alertMsg);

    // 🎨 Background update
    const currentHour = new Date().getHours();
    document.body.style.background = (currentHour >= 18 || currentHour <= 6)
      ? "linear-gradient(-45deg, #0f2027, #203a43, #2c5364)"
      : "linear-gradient(-45deg, #00c6ff, #0072ff)";

    // 🔥 New Smart Advice & Tips
    showSmartAlert(todayTemp);
    showEnvironmentalTips(todayTemp, humidity, windSpeed);

    // 🌡️ Get prediction
    fetchPrediction(city);

  } catch (error) {
    console.error("Error fetching weather data:", error);
  }
}

async function fetchPrediction(city) {
  try {
    const res = await fetch(`http://127.0.0.1:5000/predict-temp?city=${city}`);
    const result = await res.json();

    if (result.error) {
      console.warn("⚠️ Prediction Error:", result.error);
      document.querySelector(".prediction").textContent = result.error;
      return;
    }

    console.log("✅ Predicted Temps:", result);
    const predictionText = result.days.map((day, i) => `Day ${day}: ${result.predicted_temps[i]}°C`).join("\n");
    document.querySelector(".prediction").textContent = predictionText;

    if (document.getElementById("predictionChart")) {
      renderChart(result.days, result.predicted_temps);
    }

  } catch (err) {
    console.error("❌ Prediction fetch failed:", err);
  }
}

function renderChart(days, temps) {
  const chartContainer = document.getElementById("chartContainer");

  if (myChart) {
    myChart.destroy();
    myChart = null;
  }

  const oldCanvas = document.getElementById("predictionChart");
  if (oldCanvas) {
    oldCanvas.remove();
  }

  const newCanvas = document.createElement("canvas");
  newCanvas.id = "predictionChart";
  chartContainer.appendChild(newCanvas);

  const ctx = newCanvas.getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days.map(day => "Day " + day),
      datasets: [{
        label: "Predicted Temp (°C)",
        data: temps,
        borderColor: "#ffcc00",
        backgroundColor: "rgba(255, 204, 0, 0.2)",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: false }
      }
    }
  });
}

// 🔥 New Smart Alert Function
function showSmartAlert(predictedTemp) {
  const alertEl = document.querySelector(".alert-message");

  if (predictedTemp >= 38) {
    alertEl.innerText = "🔥 Extreme Heat Alert! Stay indoors and stay hydrated!";
  } else if (predictedTemp >= 30 && predictedTemp < 38) {
    alertEl.innerText = "🌞 It's quite hot. Wear light clothes and drink water!";
  } else if (predictedTemp >= 20 && predictedTemp < 30) {
    alertEl.innerText = "🌤️ Pleasant weather. A good day for outdoor activities!";
  } else if (predictedTemp >= 10 && predictedTemp < 20) {
    alertEl.innerText = "🧥 It's a bit cool. Carry a light jacket!";
  } else {
    alertEl.innerText = "❄️ Brrr... Very cold! Bundle up and stay warm!";
  }
}

// 🌿 Tips Function
function showEnvironmentalTips(temp, humidity, windSpeed) {
  let tip = "";

  if (humidity > 80) {
    tip += "💧 High humidity — take breaks and stay cool.\n";
  }

  if (windSpeed > 30) {
    tip += "💨 Windy — secure loose objects and avoid rooftops.\n";
  }

  if (temp >= 35) {
    tip += "🔥 Stay in shade. Drink water regularly.\n";
  } else if (temp <= 10) {
    tip += "🧊 Keep warm! Avoid staying out too long.\n";
  } else {
    tip += "✅ Good day to go out and enjoy nature.\n";
  }

  document.querySelector(".prediction").innerText += `\n💡 Tips:\n${tip}`;
}

function submitData() {
  const city = document.getElementById("city").value.trim();
  const day = parseInt(document.getElementById("day").value);
  const temp = parseFloat(document.getElementById("temp").value);

  if (!city || isNaN(day) || isNaN(temp)) {
    alert("Please enter valid city, day, and temperature.");
    return;
  }

  fetch('http://127.0.0.1:5000/update-temp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city, day, temp })
  })
    .then(res => res.json())
    .then(data => alert(data.message))
    .catch(err => alert("Error: " + err));
}

function getPrediction() {
  const city = document.getElementById("city").value.trim();

  if (!city) {
    alert("Please enter a city name.");
    return;
  }

  fetch(`http://127.0.0.1:5000/predict-temp?city=${city}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
      } else {
        alert(`Predicted Temperature for ${data.city}: ${data.predicted_temp}°C`);
        renderChart(data.days, data.temps.concat(data.predicted_temp));
      }
    })
    .catch(err => alert("Prediction Error: " + err));
}

// 🔍 Search click
searchBtn.addEventListener("click", () => {
  const city = searchBox.value.trim();
  if (city) {
    checkWeather(city);
  } else {
    alert("Please enter a city name!");
  }
});
