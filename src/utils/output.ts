/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Table from 'cli-table3';
import { Input, stringify } from 'csv-stringify/sync';

export function formatOutput(data: any, format: string): void {
    switch (format.toLowerCase()) {
        case 'json': {
            break;
        }

        case 'csv': {
            formatAsCsv(data);
            break;
        }

        case 'table':
        default: {
            formatAsTable(data);
            break;
        }
    }
}

function formatAsTable(data: any): void {
    if (Array.isArray(data)) {
        formatArrayAsTable(data);
    } else if (data.months && data.expenses_by_category) {
        formatExpensesByCategoryAsTable(data);
    } else {
        console.error('Unsupported data format for table output');
    }
}

function formatArrayAsTable(data: any[]): void {
    if (data.length === 0) {
        console.log('No data available');
        return;
    }

    const headers = Object.keys(data[0]);

    // Calculate the maximum width for each column
    const colWidths = headers.map(header => {
        const headerWidth = header.length;
        const maxItemWidth = Math.max(...data.map(item => String(item[header]).length));
        return Math.min(Math.max(headerWidth, maxItemWidth) + 3, 55); // Adding some padding and setting max width
    });

    const table = new Table({
        colWidths,
        head: headers,
        style: { head: ['cyan'] },
    });

    for (const item of data) {
        const row = headers.map(header => {
            if (header === 'balance' || header === 'availableBalance' && typeof item[header] === 'number') {
                return `$${item[header].toFixed(2)}`;
            }
            return item[header];
        });
        table.push(row);
    }

    console.log(table.toString());
}

function formatExpensesByCategoryAsTable(data: any): void {
    const { expenses_by_category, months } = data;

    const headers = ['Category', ...months];

    const table = new Table({
        colWidths: [30, ...months.map(() => 15)],
        head: headers,
        style: { head: ['cyan'] },
    });

    for (const category of Object.keys(expenses_by_category)) {
        const row = [category];
        months.forEach((month: number | string) => {
            const amount = expenses_by_category[category][month] || 0;
            row.push(`$${amount.toFixed(2)}`);
        });
        table.push(row);
    }

    console.log(table.toString());
}

function formatAsCsv(data: any): void {
    if (Array.isArray(data)) {
        formatArrayAsCsv(data);
    } else if (data.months && data.expenses_by_category) {
        formatExpensesByCategoryAsCsv(data);
    } else {
        console.error('Unsupported data format for CSV output');
    }
}

function formatArrayAsCsv(data: any[]): void {
    const columns = Object.keys(data[0]);
    const csv = stringify(data, { columns, header: true });
    console.log(csv);
}

function formatExpensesByCategoryAsCsv(data: any): void {
    const { expenses_by_category, months } = data;

    const records: Input = [];

    for (const category of Object.keys(expenses_by_category)) {
        const record: { [key: string]: string } = { category };
        months.forEach((month: number | string) => {
            const amount = expenses_by_category[category][month] || 0;
            record[month] = amount.toFixed(2);
        });
        records.push(record);
    }

    const columns = ['category', ...months];

    const csv = stringify(records, { columns, header: true });
    console.log(csv);
}