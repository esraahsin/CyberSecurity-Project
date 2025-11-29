const fraudService = require('./src/services/fraud-detection.service');

async function testFraudService() {
  try {
    console.log('🧪 Testing Fraud Detection Service...\n');
    
    // Test 1: Risk Score
    console.log('1️⃣ Calculating risk score...');
    const riskScore = await fraudService.calculateRiskScore({
      fromAccountId: 1,
      toAccountId: 2,
      amount: 50000,
      ipAddress: '192.168.1.1'
    });
    console.log('Risk Score:', riskScore);
    
    // Test 2: Suspicious Activity
    console.log('\n2️⃣ Checking suspicious activity...');
    const suspicious = await fraudService.checkSuspiciousActivity(1);
    console.log('Suspicious:', suspicious);
    
    // Test 3: Pattern Validation
    console.log('\n3️⃣ Validating transaction pattern...');
    const pattern = await fraudService.validateTransactionPattern(1, 10000);
    console.log('Pattern:', pattern);
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFraudService();