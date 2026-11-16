# Vibe Web

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, TanStack Query 5, AWS Amplify 6, and `@vibe/shared` (selected in [architecture](../docs/architecture.md)).

## Users and Purpose

See [product direction](../docs/product-idea.md). This surface serves the Milestone 1 account, party, invite, and persistent chat flow described in [implementation plan](../docs/implementation-plan.md).

## Capabilities and Constraints

Use the API and event channel contracts in [shared types](../shared/src/index.ts). Load deployment settings from `/config.json` or documented `VITE_*` development settings. Show setup state when they are missing; do not present synthetic party or message data as live.

## Brand Commitments

The approved frontend brief specifies a light neutral interface, warm orange accent, and DM Sans or Geist typography, with a party sidebar, party header, readable chat, and bottom composer.

## Evidence on Hand

Product requirements, architecture, milestone scope, and typed contracts are in the linked project documents. Do not add customer or usage claims.
