import * as core from '@actions/core';
import {isString} from "util";
const YAML = require('yaml');
const {NodeSSH} = require('node-ssh');
const path = require('path');
const fs = require('fs');

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
        fs.writeFileSync('tmp_privatekey.prvk', PRIV_KEY, function(err){
            if (err){
                throw new Error(err.message)
            }
        });
        let service_name: string = BRANCH_FILE['service']['name']
        let enable: boolean = false
        if ('enable' in BRANCH_FILE['service']){
            enable = true
        }
        let exclude_files: Array<string>;
        exclude_files = [];
        if ('exclude' in BRANCH_FILE) {
            exclude_files = BRANCH_FILE['exclude']
        }
        let files_list: Array<string> = [];
        console.log(exclude_files)
        fs.readdirSync(path.resolve(process.cwd())).forEach(file => {
            console.log([file], (exclude_files.indexOf(file) == -1), 'lalal', file.type)
            if (exclude_files.indexOf(file) != -1){
            } else {
              files_list.push(file)
            }
        })
        console.log('dsdas', files_list, 'hehe')
        const now: Date = new Date();
        let server_file_path: string = `/usr/local/bin/gitactions/${service_name}_${now.getFullYear()}-${now.getMonth()}-${now.getDate()}_${now.getHours()}:${now.getMinutes()}/`
        console.log(server_file_path, 'new_path');

        const ssh = new NodeSSH()
        ssh.connect({
            host: HOST,
            port: PORT,
            username: USERNAME,
            privateKey: 'tmp_privatekey.prvk'
        }).then(function(){
            console.log('Connect');
            push_to_ssh(ssh, files_list, 0, server_file_path, function (){
                console.log('Success')
            })
        })
    }
    }
    catch (error) {
        console.error(error.message);
    }
}

function push_to_ssh(ssh_obj, items_list: Array<string>, counter: number, server_file_path: string, callback){
    if (fs.lstatSync(items_list[counter]).isDirectory()){
        console.log(`Push directory: ${items_list[counter]}`)
        ssh_obj.putDirectory(path.resolve(process.cwd()) + '/' + items_list[counter], server_file_path + items_list[counter]).then(
            function (){
                counter += 1
                if (counter >= items_list.length){
                    callback()
                }
                return push_to_ssh(ssh_obj, items_list, counter, server_file_path, callback)
            },
            function (error){
                console.log("Something's wrong")
                console.log(error)
            }
        )
    } else {
        console.log(`Push file: ${items_list[counter]}`)
        ssh_obj.putFile(path.resolve(process.cwd()) + '/' + items_list[counter], server_file_path + items_list[counter]).then(
            function (){
                counter += 1
                if (counter >= items_list.length){
                    callback()
                }
                return push_to_ssh(ssh_obj, items_list, counter, server_file_path, callback)
            },
            function (error){
                console.log("Something's wrong")
                console.log(error)
            }
        )
    }
}

// Initial github inputs
// const BRANCH = core.getInput('branch')
const BRANCH: string = 'master'
const HOST: string = '172.104.237.217'
const PORT: number = 22
const USERNAME: string = 'gitactions'
const PRIV_KEY: string = '-----BEGIN OPENSSH PRIVATE KEY-----\n' +
    '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\n' +
    '-----END OPENSSH PRIVATE KEY-----'

main()