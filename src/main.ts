import * as core from '@actions/core';


async function run() {
    try {
        const BRANCH = core.getInput('branch')
        console.log('Current branch', BRANCH)
    }
    catch (error) {
        core.setFailed(error.message)
    }
}




console.log('Start deployment script')
run()
