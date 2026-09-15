# Trails Scout

Trails Scout is a browser extension for identifying element locators and sending them to Trails.

## Build

Use Node `^20.19.0 || ^22.13.0 || >=24.0.0`.

Install dependencies once:

```bash
npm ci
```

Start a watch build:

```bash
npm start
```

Create a stable build:

```bash
npm run build
```

Both commands write extension files to `dist`. Load `dist` as an unpacked extension from Chrome's or Edge's extensions page with developer mode enabled.

## Connection

Enter values for these required fields in Scout:

- Keycloak token endpoint
- Trails service URL
- Client ID
- Username and password

Enter a client secret only when using a confidential client. Public-client setups leave it empty.

Connection values and tokens persist in browser-local extension storage. They are not source-controlled; do not put credentials or secrets in this repository.

## Useful commands

```bash
npm test
npm run test:watch
npm run format:check
```
