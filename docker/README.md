# Development and Testing

This directory contains a setup for testing and developing the plugin's code without running the full IntelliJ IDE.

## Prerequisites

- [Node.js](https://nodejs.org/) (22-alpine recommended)

## Setup

1. Open your terminal in this directory ([docker](.)).
2. Install dependencies:
   
**Locally**: 
```shell
npm install
```

**With Docker**:
```shell
docker compose run --rm js-dev npm install
```

## Development Server

To see the UI in your browser with Hot Module Replacement (HMR) and access to the browser console:

**Locally**:
```shell
npm run dev
```
**With Docker**:
```shell
docker compose up
```

Then open the URL shown in the terminal ([http://localhost:5173](http://localhost:5173)).
Any changes you make to `*.js` or `*.css` in docker directory will be reflected immediately.
