# Backend Info
## Set up the backend
1. Make sure you have podman installed and podman-compose
2. You can pip install podman-compose if you need it
3. cd server
4. cp backend/.env.example .env
5. edit .env to meet your needs

## Run the backend
1. podman-compose up --build -d

## Stop the backend
a. podman-compose down -v # this wipes the database
b. podman-compose down # this does not wipe the database

# Frontend Info
## Setup the frontend
1. npm install

## Run the frontend in dev mode
1. npm run dev
2. in a different terminal npm run electron:dev

## Deploy the frontend
1. npm run electron:build
