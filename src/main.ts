// import * as core from '@actions/core';
//
//
// async function run() {
//     try {
//         const BRANCH = core.getInput('branch')
//         console.log('Current branch', BRANCH)
//     }
//     catch (error) {
//         core.setFailed(error.message)
//     }
// }
//
//
//
//
// run()
const YAML = require('yaml')
const fs = require('fs')

function parse_config(): void {
    const file = fs.readFileSync('test.yml', 'utf8')
    let a: any = YAML.parse(file)
    console.log(a)
}

function main(): void {
    console.log('Start deployment script')
    parse_config()
}


main()