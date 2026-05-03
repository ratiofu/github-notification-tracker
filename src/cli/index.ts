#!/usr/bin/env node

import { createCliMessage } from "./cli-message.js"

process.stdout.write(`${createCliMessage()}\n`)
