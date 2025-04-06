import numpy as np
from sklearn.linear_model import LinearRegression

# Sample data for last 7 days
data = [
    [1, 30],
    [2, 31],
    [3, 32],
    [4, 34],
    [5, 35],
    [6, 33],
    [7, 36]
]

# Splitting data
X = np.array([day[0] for day in data]).reshape(-1, 1)
y = np.array([day[1] for day in data])

# Train model
model = LinearRegression()
model.fit(X, y)

# Predict for day 8
day_to_predict = np.array([[8]])
predicted_temp = model.predict(day_to_predict)

print(f"Predicted temperature for day 8: {predicted_temp[0]:.2f}°C")
