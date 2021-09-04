const core = require('@actions/core');
const os = require('os');

const TOKEN = core.getInput('github-token', {required: true})
console.log('Hello, I am an action ', TOKEN, os.homedir())

const execSync = require('child_process').execSync;
// import { execSync } from 'child_process';  // replace ^ if using ES modules
const output = execSync('ls', { encoding: 'utf-8' });  // the default is 'buffer'
console.log('Output was:\n', output);
