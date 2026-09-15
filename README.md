# Umami — Char & Barten Kitchen Log

Daily kitchen log and monthly scorecard for Char and Barten.
Umami, an Alchemy Experience company.

## What this is

A single-page web app. Head chefs file a daily log on their phones; the
Executive Chef closes each month, scores it and signs it off. All data lives in
a private Google Sheet — **nothing is stored in this repository.**

## No secrets here

This repo is public, so it deliberately contains no connection details.
The first time the app is opened on a device it asks for the Apps Script Web
app URL and token. Both are stored on that device only.

## Setting it up on a phone

1. Open the site.
2. Paste the Apps Script Web app URL (ends `/exec`) and the token.
3. Tap Connect. The device remembers from then on.
4. Add to Home Screen — Safari on iPhone, Chrome on Android.

To point a device at a different sheet, use **Disconnect** in the top bar.

## The backend

`Code.gs` lives in the Apps Script project bound to the Google Sheet, not here.
It creates its own tabs on first run: Users, Outlets, Rates, Reports, Monthly,
Signoff, Actions.

## Publishing changes

Committing to `main` republishes automatically via GitHub Pages.
After a change, hard-refresh once — the service worker caches the previous
version for offline use.
