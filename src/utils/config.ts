import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

const configDir = path.join(homedir(), '.bankcli');
const configFile = path.join(configDir, 'config.json');

interface Config {
    api_key?: string;
    app_token?: string;
    format?: string;
    cacheData?: boolean; // new property
    [key: string]: any;
}

// Ensure the config directory exists
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
}

// Load existing configuration or initialize a new one
let config: Config = {};
if (fs.existsSync(configFile)) {
    const data = fs.readFileSync(configFile, 'utf8');
    config = JSON.parse(data);
} else {
    config = {
        format: 'json', // default format
    };
}

// Function to save configuration to the file
export function saveConfig() {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
}

// Function to get a configuration value
export function getConfig(key: string) {
    return config[key];
}

// Function to set a configuration value
export function setConfig(key: string, value: any) {
    config[key] = value;
    saveConfig();
}

// Function to reset a configuration value to default
export function resetConfig(key: string) {
    delete config[key];
    saveConfig();
}

// Function to get all configuration values
export function getAllConfig() {
    return config;
}