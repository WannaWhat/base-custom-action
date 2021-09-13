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
                            console.log('All tasks completed');
                            throw new Error('Exit all tasks completed')
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
const BRANCH: string = core.getInput('branch')
const HOST: string = core.getInput('host')
const PORT: string = core.getInput('port')
const USERNAME: string = core.getInput('username')
const PRIVATE_KEY: string = core.getInput('ssh-private-key')
main();