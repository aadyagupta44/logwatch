FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy script
COPY simulate_logs.py .

# Environment variables
ENV KAFKA_BROKERS=kafka:9092

# Run script
CMD ["python", "simulate_logs.py"]
