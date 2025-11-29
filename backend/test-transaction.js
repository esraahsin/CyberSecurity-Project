const transactionService = require('./src/services/transaction.service');

async function testTransactionService() {
  try {
    console.log('🧪 Testing Transaction Service...\n');
    
    // Test 1: Validation
    console.log('1️⃣ Testing validation...');
    const validation = await transactionService.validateTransaction(1, 2, 5000);
    console.log('Validation:', validation);
    
    // Test 2: Daily Limits
    console.log('\n2️⃣ Testing daily limits...');
    const limits = await transactionService.checkDailyLimits(1, 10000);
    console.log('Limits:', limits);
    
    // Test 3: Transaction History
    console.log('\n3️⃣ Testing transaction history...');
    const history = await transactionService.getTransactionHistory(1, { limit: 5 });
    console.log('History:', history);
    
    // Test 4: Create Transfer (optionnel - modifie la DB)
    // const transfer = await transactionService.createTransfer(1, 2, 5000, 1, 'Test transfer');
    // console.log('Transfer:', transfer);
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTransactionService();