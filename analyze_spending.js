// Analysis script for discretionary spending
import fs from 'fs';

// Discretionary spending categories mapping
const discretionaryCategories = {
  'eating_out': ['Cafes and restaurants', 'Fast food stores'],
  'entertainment': ['Casino, lottery, and other gambling services', 'Entertainment and recreation services'],
  'shopping': ['General retail stores', 'Clothing and accessories', 'Sports equipment and supplies', 'Online retail stores'],
  'coffee_cafes': ['Coffee shops', 'Cafes'],
  'alcohol': ['Liquor stores', 'Bars and nightclubs'],
  'personal_care': ['Personal care services', 'Beauty services', 'Hairdressers and beauty salons']
};

// Read transactions from stdin
let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  const transactions = JSON.parse(data);

  // Filter for negative amounts (expenses) only
  const expenses = transactions.filter(t => t.amount < 0);

  // Categorize discretionary spending
  const discretionarySpend = {
    eating_out: [],
    entertainment: [],
    shopping: [],
    coffee_cafes: [],
    alcohol: [],
    personal_care: [],
    other_discretionary: []
  };

  expenses.forEach(t => {
    const category = t.category;
    const merchant = t.merchant || t.description || '';
    const parentCat = t.parentCategory;

    // Eating out
    if (category === 'Cafes and restaurants' || category === 'Fast food stores') {
      discretionarySpend.eating_out.push(t);
    }
    // Entertainment
    else if (category === 'Casino, lottery, and other gambling services' ||
             parentCat === 'Entertainment' ||
             merchant.toLowerCase().includes('cinema') ||
             merchant.toLowerCase().includes('movie') ||
             merchant.toLowerCase().includes('netflix') ||
             merchant.toLowerCase().includes('spotify') ||
             merchant.toLowerCase().includes('disney')) {
      discretionarySpend.entertainment.push(t);
    }
    // Shopping
    else if (category === 'General retail stores' ||
             category === 'Clothing and accessories' ||
             category === 'Sports equipment and supplies' ||
             category === 'Online retail stores' ||
             merchant.toLowerCase().includes('warehouse') ||
             merchant.toLowerCase().includes('rebel')) {
      discretionarySpend.shopping.push(t);
    }
    // Alcohol
    else if (category === 'Liquor stores' || merchant.toLowerCase().includes('liquor')) {
      discretionarySpend.alcohol.push(t);
    }
    // Personal care
    else if (category === 'Personal care services' ||
             category === 'Beauty services' ||
             category === 'Hairdressers and beauty salons' ||
             merchant.toLowerCase().includes('hairquarters')) {
      discretionarySpend.personal_care.push(t);
    }
  });

  // Calculate totals
  const results = {};
  for (const [key, txns] of Object.entries(discretionarySpend)) {
    const total = txns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const count = txns.length;
    results[key] = {
      total: total.toFixed(2),
      count,
      average: count > 0 ? (total / count).toFixed(2) : 0,
      transactions: txns
    };
  }

  console.log(JSON.stringify(results, null, 2));
});
