FROM node:12.18.3-buster-slim@sha256:dd6aa3ed10af4374b88f8a6624aeee7522772bb08e8dd5e917ff729d1d3c3a4f
RUN apt-get update \
     && apt-get install -y wget gnupg \
     && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
     && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
     && apt-get update \
     && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
     --no-install-recommends \
     && rm -rf /var/lib/apt/lists/*
WORKDIR /app_container
COPY package.json /app_container
COPY package-lock.json /app_container
RUN npm install
COPY . /app_container
RUN npm i puppeteer \
     # Add user so we don't need --no-sandbox.
     # same layer as npm install to keep re-chowned files from using up several hundred MBs more space
     && groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
     && mkdir -p /home/pptruser/Downloads \
     && chown -R pptruser:pptruser /home/pptruser \
     && chown -R pptruser:pptruser ./node_modules \
     && chown -R pptruser:pptruser ./
USER pptruser
CMD ["npm", "start"]