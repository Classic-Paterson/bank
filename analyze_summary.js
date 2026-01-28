// Summary analysis script for discretionary spending
import fs from 'fs';

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
    personal_care: []
  };

  expenses.forEach(t => {
    const category = t.category;
    const merchant = (t.merchant || '').toLowerCase();
    const description = (t.description || '').toLowerCase();
    const parentCat = t.parentCategory;

    // Eating out (restaurants, cafes, fast food)
    if (category === 'Cafes and restaurants' || category === 'Fast food stores') {
      discretionarySpend.eating_out.push(t);
    }
    // Entertainment
    else if (category === 'Casino, lottery, and other gambling services' ||
             merchant.includes('lotto') ||
             merchant.includes('cinema') ||
             merchant.includes('movie') ||
             merchant.includes('netflix') ||
             merchant.includes('spotify') ||
             merchant.includes('disney') ||
             merchant.includes('steam') ||
             description.includes('mylotto')) {
      discretionarySpend.entertainment.push(t);
    }
    // Shopping (retail, clothing, sports equipment, but exclude household essentials)
    else if (category === 'General retail stores' ||
             category === 'Clothing and accessories' ||
             category === 'Sports equipment and supplies' ||
             category === 'Online retail stores' ||
             (merchant.includes('warehouse') && !description.includes('chemist')) ||
             merchant.includes('rebel') ||
             merchant.includes('kmart') ||
             merchant.includes('farmers')) {
      discretionarySpend.shopping.push(t);
    }
    // Alcohol
    else if (category === 'Liquor stores' ||
             merchant.includes('liquor') ||
             merchant.includes('bottle') ||
             merchant.includes('beer') ||
             merchant.includes('wine')) {
      discretionarySpend.alcohol.push(t);
    }
    // Personal care (hairdressing, beauty, salon)
    else if (category === 'Personal care services' ||
             category === 'Beauty services' ||
             category === 'Hairdressers and beauty salons' ||
             merchant.includes('hair') ||
             merchant.includes('beauty') ||
             merchant.includes('salon') ||
             merchant.includes('barber') ||
             description.includes('hairquarters')) {
      discretionarySpend.personal_care.push(t);
    }
  });

  // Calculate totals and find top merchants
  const summary = {};
  for (const [key, txns] of Object.entries(discretionarySpend)) {
    const total = txns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const count = txns.length;

    // Group by merchant
    const merchantSpend = {};
    txns.forEach(t => {
      const m = t.merchant || t.description || 'Unknown';
      if (!merchantSpend[m]) {
        merchantSpend[m] = { total: 0, count: 0 };
      }
      merchantSpend[m].total += Math.abs(t.amount);
      merchantSpend[m].count += 1;
    });

    // Sort merchants by spend
    const topMerchants = Object.entries(merchantSpend)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Group by month
    const monthlySpend = {};
    txns.forEach(t => {
      const date = t.date.split('/');
      const month = date[1]; // Get month
      const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(month) - 1];
      if (!monthlySpend[monthName]) {
        monthlySpend[monthName] = 0;
      }
      monthlySpend[monthName] += Math.abs(t.amount);
    });

    summary[key] = {
      total: parseFloat(total.toFixed(2)),
      count,
      average_per_transaction: count > 0 ? parseFloat((total / count).toFixed(2)) : 0,
      monthly_average: parseFloat((total / 11).toFixed(2)), // 11 months YTD
      top_merchants: topMerchants.map(m => ({
        name: m.name,
        total: parseFloat(m.total.toFixed(2)),
        count: m.count,
        avg: parseFloat((m.total / m.count).toFixed(2))
      })),
      monthly_breakdown: monthlySpend
    };
  }

  // Calculate grand total
  const grandTotal = Object.values(summary).reduce((sum, cat) => sum + cat.total, 0);

  const report = {
    report_period: '2025-01-01 to 2025-12-03',
    total_discretionary_spending: parseFloat(grandTotal.toFixed(2)),
    monthly_discretionary_average: parseFloat((grandTotal / 11).toFixed(2)),
    categories: summary
  };

  console.log(JSON.stringify(report, null, 2));
});
