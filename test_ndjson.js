import { formatOutput } from './dist/utils/output.js';

// Test with array data (like transactions/accounts)
const arrayData = [
    { id: '1', name: 'John Doe', amount: 100.50, date: '2023-08-01' },
    { id: '2', name: 'Jane Smith', amount: 250.75, date: '2023-08-02' },
    { id: '3', name: 'Bob Johnson', amount: 75.25, date: '2023-08-03' }
];

console.log('=== Testing NDJSON with array data ===');
formatOutput(arrayData, 'ndjson');

console.log('\n=== Testing NDJSON with expenses by category data ===');
// Test with expenses by category data (like categories command)
const categoryData = {
    months: ['Jan', 'Feb', 'Mar'],
    expenses_by_category: {
        'Food': { 'Jan': 100, 'Feb': 150, 'Mar': 120 },
        'Transport': { 'Jan': 50, 'Feb': 60, 'Mar': 55 },
        'Entertainment': { 'Jan': 30, 'Feb': 40, 'Mar': 35 }
    }
};

formatOutput(categoryData, 'ndjson');

console.log('\n=== Comparison with JSON format ===');
console.log('JSON format:');
formatOutput(arrayData.slice(0, 2), 'json');
console.log('\nNDJSON format:');
formatOutput(arrayData.slice(0, 2), 'ndjson');
