# sentinel/test_sentinel.py
from agent import SentinelAgent

agent = SentinelAgent()

sensor_window = {
    "pH": [5.8, 5.9, 6.0],
    "EC": [1.2, 1.3, 1.25],
    "temp": [24, 25, 24.5],
    "humidity": [70, 72, 71]
}

metadata = {
    "crop": "lettuce",
    "stage": "vegetative",
    "rack": "A3"
}

fmu = agent.create_fmu("sample_plant.jpg", sensor_window, metadata)

print("FMU ID:", fmu.id)
print("Vector length:", len(fmu.vector))
print("Quality:", fmu.quality)
print("Metadata:", fmu.metadata)
