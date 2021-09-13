import * as core from '@actions/core';
import {isString} from "util";
const YAML = require('yaml');
const {NodeSSH} = require('node-ssh');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH: string = 'dpts.yaml' // DePloyment Tasks Script .yaml
const PRIVATE_KEY_FILE: string = 'tmp_privatekey.prvk'
const SERVICES_PATH: string = '/lib/systemd/system/'
const SOURCE_BIN_PATH: string = '/usr/local/bin/gitactions/'


function get_config_parametr(CONFIG_FILE: any, config_parametr: string, default_value: any): any {
    if (config_parametr in CONFIG_FILE){
        return CONFIG_FILE[config_parametr]
    }
    else {
        return default_value
    }
}


function get_config(): any {
    if (fs.existsSync(CONFIG_PATH)) {
        const file = fs.readFileSync(CONFIG_PATH, 'utf8')
        let deployment_config: any = YAML.parse(file)
        if (BRANCH in deployment_config['dep_branches']) {
        } else {
            throw new Error(`Current branch: ${BRANCH} not in config file: ${CONFIG_PATH}`);
        }
        return deployment_config['dep_branches'][BRANCH]
    } else {
        throw new Error(`Error exit, you must create configuration file: ${CONFIG_PATH}`)
    }
}

function make_env(BRANCH_CONFIG_FILE: any): void {
    if ('env' in BRANCH_CONFIG_FILE){
        let env_path: string = BRANCH_CONFIG_FILE['env']['path']
        let env_file: string = ''
        if (fs.existsSync(env_path)){
            env_file = fs.readFileSync(env_path, 'utf8')
            env_file += '\n'
        }
        let append_to_enviroment: any = BRANCH_CONFIG_FILE['env']['append'];
        for (let key in append_to_enviroment){
            let key_name: string = ''
            if (isString(append_to_enviroment[key])) {
                key_name = append_to_enviroment[key]
                env_file += `${key_name}=${process.env[key_name]}\n`
            } else {
                for (let index_key in append_to_enviroment[key]) {
                    key_name = index_key
                }
                env_file += `${key_name}=${append_to_enviroment[key][key_name]}\n`
            }
        }
        fs.writeFileSync(env_path, env_file)
    }
}


function create_service_file(BRANCH_CONFIG_FILE: any, program_file_path: string, program_name: string) {
    let exec_intep = get_config_parametr(BRANCH_CONFIG_FILE, 'exec_intep', '')
    let exec_file = get_config_parametr(BRANCH_CONFIG_FILE, 'exec_file', '')

    let service_file_text: string = `
[Unit]
    Description=Service for start project: ${program_name}, created by wannawhat
[Service]
    ExecStart=${exec_intep} ${program_file_path}${exec_file}
    Type=idle
    KillMode=process
    SyslogIdentifier=${program_name}_${BRANCH}
    SyslogFacility=daemon
    Restart=on-failure
[Install]
    WantedBy=multiuser.target
    `
    fs.writeFileSync(`${program_name}_${BRANCH}.service`, service_file_text, function (err){
        if (err){
            throw new Error(err.message)
        }
    });
    return `${program_name}_${BRANCH}.service`
}

function transfer_files(BRANCH_CONFIG_FILE: any): void{
    if ('transfer' in BRANCH_CONFIG_FILE){
        fs.writeFileSync(PRIVATE_KEY_FILE, PRIVATE_KEY, function(err){
            if (err){
                throw new Error(err.message)
            }
        });
        let program_name: string = BRANCH_CONFIG_FILE['transfer']['name'];
        const now: Date = new Date();
        let program_file_path: string = `${SOURCE_BIN_PATH}${program_name}_${now.getFullYear()}-${now.getMonth()}-${now.getDate()}_${now.getHours()}:${now.getMinutes()}/`
        let create_service: boolean = get_config_parametr(BRANCH_CONFIG_FILE['transfer'], 'create_service', true);
        let exclude_files: Array<string>;
        exclude_files = get_config_parametr(BRANCH_CONFIG_FILE, 'exclude', [])
        let transfer_files_list: Array<string> = [];
        fs.readdirSync(path.resolve(process.cwd())).forEach(file => {
            if (exclude_files.indexOf(file) == -1){
                transfer_files_list.push(file)
            }
        })
        let enable: boolean = false;
        let start_service: boolean = false;
        let service_file_name: string = '';
        if (create_service) {
            service_file_name = create_service_file(BRANCH_CONFIG_FILE['transfer'], program_file_path, program_name)
            start_service = get_config_parametr(BRANCH_CONFIG_FILE['transfer'], 'start_service', true);
            enable = get_config_parametr(BRANCH_CONFIG_FILE['transfer'], 'enable', true);
        }
        const file = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8')
        const ssh = new NodeSSH()
        ssh.connect({
            host: HOST,
            port: PORT,
            username: USERNAME,
            privateKey: PRIVATE_KEY_FILE,
        }).then(function(){
            console.log('Connect');
            push_to_ssh(ssh, transfer_files_list, 0, program_file_path, function () {
                console.log('Success transfer files to server')
                if (create_service) {
                    console.log('Creating service')
                    ssh.putFile(service_file_name, `${SERVICES_PATH}${service_file_name}`).then(
                        function () {
                            console.log('Reload systemctl daemon')
                            ssh.execCommand('systemctl daemon-reload')
                            if (enable) {
                                console.log('Enable service on server')
                                ssh.execCommand(`systemctl enable ${service_file_name}`)
                            }
                            if (start_service) {
                                console.log('Start service on server')
                                ssh.execCommand(`systemctl start ${service_file_name}`)
                            }
                            return;
                        },
                        function (error) {
                            console.log(error)
                        }
                    )
                }
            })
        })
    }
}

function main(): void {
    try {
    console.log('Start auto deployment script')
    const BRANCH_CONFIG_FILE: any = get_config()
    make_env(BRANCH_CONFIG_FILE)
    transfer_files(BRANCH_CONFIG_FILE);
    console.log('All tasks completed');
    return
    }
    catch (error) {
        core.error(error.message)
    }
}

function push_to_ssh(ssh_obj, items_list: Array<string>, counter: number, server_file_path: string, callback){
    if (fs.lstatSync(items_list[counter]).isDirectory()){
        console.log(`+ Push to server directory: ${items_list[counter]}`)
        ssh_obj.putDirectory(path.resolve(process.cwd()) + '/' + items_list[counter], server_file_path + items_list[counter]).then(
            function (){
                counter++
                if (counter >= items_list.length){
                    return callback();
                }
                return push_to_ssh(ssh_obj, items_list, counter, server_file_path, callback)
            },
            function (error){
                throw new Error(error.message)
            }
        )
    } else {
        console.log(`+ Push to server file: ${items_list[counter]}`)
        ssh_obj.putFile(path.resolve(process.cwd()) + '/' + items_list[counter], server_file_path + items_list[counter]).then(
            function (){
                counter++
                if (counter >= items_list.length){
                    return callback()
                }
                return push_to_ssh(ssh_obj, items_list, counter, server_file_path, callback)
            },
            function (error){
                throw new Error(error.message)
            }
        )
    }
}

// Initial github inputs
// const BRANCH: string = core.getInput('branch')
// const HOST: string = core.getInput('host')
// const PORT: string = core.getInput('port')
// const USERNAME: string = core.getInput('username')
// const PRIVATE_KEY: string = core.getInput('ssh-private-key')
const BRANCH = 'master';
const HOST = '172.104.237.217';
const PORT = 22;
const USERNAME = 'gitactions';
const PRIVATE_KEY: string = '-----BEGIN OPENSSH PRIVATE KEY-----\n' +
    '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\n' +
    '-----END OPENSSH PRIVATE KEY-----'
main();