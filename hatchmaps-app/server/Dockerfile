FROM  node:latest

WORKDIR /app


ENV DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus

RUN apt-get update && apt-get install -y \
    chromium\
    dbus\
    dbus-x11\
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxcomposite1 \
    libxrandr2 \
    libgbm-dev \
    libxdamage1 \
    libxkbcommon0 \
    libasound2 \
    libx11-xcb1 \
    libxss1 \
    libxtst6 \
    libdbus-glib-1-2 \
    libgtk-3-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Puppeteer
#RUN npm install puppeteer
RUN npm install dotenv

WORKDIR /app

# Copy the package.json file to my current directory to install the necessary dependence  
COPY package*.json ./

# Install the dependence
RUN npm install


# Copy other files to my current directory
COPY . .

# Set environment variables for Puppeteer
#ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium-browser
#ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Open the port for the express server
EXPOSE 5000

# Run express run in the foreground
CMD ["npm", "start"]
