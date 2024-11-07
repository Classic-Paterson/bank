import Table from 'cli-table3';
import { stringify } from 'csv-stringify/sync';

// Helper function to format amounts
function formatAmounts(data: any): any {
    if (Array.isArray(data)) {
        return data.map(item => formatAmounts(item));
    } else if (typeof data === 'object' && data !== null) {
        const formattedData: any = {};
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                formattedData[key] = formatAmounts(data[key]);
            }
        }
        return formattedData;
    } else if (typeof data === 'number') {
        return `$${data.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return data;
}

// Function to format data as JSON
export function formatAsJson(data: any): void {
    const formattedData = formatAmounts(data);
    console.log(JSON.stringify(formattedData, null, 2));
}

// Function to format data as CSV
export function formatAsCsv(data: any[]): void {
    const formattedData = formatAmounts(data);
    const csv = stringify(formattedData, { header: true });
    console.log(csv);
}

// Function to format data as a table
export function formatAsTable(data: any[]): void {
    if (!Array.isArray(data) || data.length === 0) {
        console.log('No data available.');
        return;
    }

    const formattedData = formatAmounts(data);

    // Create table headers from object keys
    const headers = Object.keys(formattedData[0]);

    const table = new Table({
        head: headers,
        colWidths: headers.map(() => 20),
        wordWrap: true,
    });

    formattedData.forEach((item: { [x: string]: any; }) => {
        const row = headers.map((header) => {
            const value = item[header];
            return typeof value === 'object' ? JSON.stringify(value) : value;
        });
        table.push(row);
    });

    console.log(table.toString());
}

// Main function to format output based on user preference
export function formatOutput(data: any, format: string): void {
    switch (format.toLowerCase()) {
        case 'json':
            formatAsJson(data);
            break;
        case 'csv':
            if (Array.isArray(data)) {
                formatAsCsv(data);
            } else {
                formatAsCsv([data]);
            }
            break;
        case 'table':
            if (Array.isArray(data)) {
                formatAsTable(data);
            } else {
                formatAsTable([data]);
            }
            break;
        default:
            console.error(`Unknown format '${format}'. Supported formats are json, csv, table.`);
            break;
    }
}