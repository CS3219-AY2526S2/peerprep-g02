FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
#change accordingly 
EXPOSE 3001 
CMD ["npm", "start"]