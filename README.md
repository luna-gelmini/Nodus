# Nodus

A multi-component asynchronous architecture comprising a custom tickrate engine, a Discord Bot backend, and an independent client. Nodus is built to demonstrate complex asynchronous event handling, socket communications, and modular system design.

## Architecture

- **Tickrate Engine (C & Python):** A custom backend system built to manage precise asynchronous loops and task executions.
- **Client (Node.js):** Connects to external services via Protobuf and WebSockets, handling communication securely.
- **Bot Component (Python):** A Discord interface seamlessly hooked into the core engine via custom task management.

## Setup

Ensure you have the required dependencies for both Python, Node.js and C (Make/GCC).

1. Clone the repository.
2. Setup the python virtual environment and install dependencies.
3. Build the tickrate engine using `make` inside the `tickrate` directory.
4. Install Node.js dependencies in the `client` directory using `yarn` or `npm`.
5. Configure the `.json` files in the `db/` folder according to your credentials.

## Usage

Start the system by running the core engine and then attaching the client.