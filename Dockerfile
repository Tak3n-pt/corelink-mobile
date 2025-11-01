# Dockerfile for Mobile App (Expo Web)
FROM node:18-alpine

WORKDIR /app

# Install Expo CLI globally
RUN npm install -g expo-cli

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app files
COPY . .

# Expose Expo web port
EXPOSE 19006

# Start Expo web
CMD ["expo", "start", "--web", "--non-interactive"]