import * as core from '@actions/core';
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
                if (enviroments[key]['secret']){
                    file += `${key}=${process.env[key]}\n`
                } else {
                    file += `${key}=${enviroments[key]['name']}\n`
                }
            }
            fs.writeFileSync(env_path, file)
            console.log(file)
        }
    }
    catch (error) {
        console.error(error.message);
    }
}
// Initial github inputs
const BRANCH = core.getInput('branch')
// const BRANCH: string = 'master'

main()