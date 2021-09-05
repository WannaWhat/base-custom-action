import * as core from '@actions/core';
import {isString} from "util";
const YAML = require('yaml')
const fs = require('fs')

const CONFIG_PATH: string = 'test.yml'

function get_config(): any {
    if (fs.existsSync(CONFIG_PATH)) {
        const file = fs.readFileSync(CONFIG_PATH, 'utf8')
        let deployment_config: any = YAML.parse(file)
        return deployment_config
    } else {
        throw new Error(`Error exit, you must create configuration file: ${CONFIG_PATH}`)
    }
}

function main(): void {
    try {
    console.log('Start deployment script');
    const CONFIG_FILE: any = get_config();
    if (BRANCH in CONFIG_FILE['dep_branches']) {
    } else {
        throw new Error(`Current branch: ${BRANCH} not in config file: ${CONFIG_PATH}`);
    }
    let BRANCH_FILE: any = CONFIG_FILE['dep_branches'][BRANCH];

    if ('env' in BRANCH_FILE){
        let env_path: string = BRANCH_FILE['env']['path']
        let file = fs.readFileSync(env_path, 'utf8')
        file += '\n'
        let enviroments: any = BRANCH_FILE['env']['append'];
        for (let key in enviroments){
            let key_name: string = ''
            if (isString(enviroments[key])) {
                key_name = enviroments[key]
                file += `${key_name}=${process.env[key_name]}\n`
            } else {
                for (let index_key in enviroments[key]) {
                    key_name = index_key
                }
                file += `${key_name}=${enviroments[key][key_name]}\n`
            }
        }
        fs.writeFileSync(env_path, file)
        console.log(file)
    }

    if ('service' in BRANCH_FILE){
        let service_name: string = BRANCH_FILE['service']['name']
        let enable: boolean = false
        if ('enable' in BRANCH_FILE['service']){
            enable = true
        }

    }

    }
    catch (error) {
        console.error(error.message);
    }
}
// Initial github inputs
// const BRANCH = core.getInput('branch')
const BRANCH: string = 'master'

main()