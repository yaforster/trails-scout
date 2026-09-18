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
npm ci
```

Then

```bash
npm run dev
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

Trails URL, Keycloak endpoint, client ID, optional client secret, selected target, and session tokens persist in browser-local extension storage. Username and password are never stored. Values are not source-controlled; do not put credentials or secrets in this repository.

## Screenshots

After locator validation, Scout can capture the active tab, scroll to the element, and crop a small-margin screenshot around it. The image stays in popup memory until upload and may contain sensitive content.

## Capture queue

The Capture page can queue multiple uniquely validated elements for the selected application and stage. Queue entries remain in popup memory only. Creation runs sequentially; a failed entry and all remaining entries stay available for retry. Changing the target requires confirmation and clears the queue. Queue entries do not capture or upload screenshots.

## Useful commands

```bash
npm test
npm run test:watch
npm run format:check
```
