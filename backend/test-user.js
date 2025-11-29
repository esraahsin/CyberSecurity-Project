const userService = require('./src/services/user.service');

async function testUserService() {
  try {
    console.log('🧪 Testing User Service...\n');
    
    // Test 1: Get User
    console.log('1️⃣ Getting user...');
    const user = await userService.getUserById(1);
    console.log('User:', user);
    
    // Test 2: Get Accounts
    console.log('\n2️⃣ Getting user accounts...');
    const accounts = await userService.getUserAccounts(1);
    console.log('Accounts:', accounts);
    
    // Test 3: Get Stats
    console.log('\n3️⃣ Getting user stats...');
    const stats = await userService.getUserStats(1);
    console.log('Stats:', stats);
    
    // Test 4: Check Permissions
    console.log('\n4️⃣ Checking permissions...');
    const canTransfer = await userService.canPerformAction(1, 'transfer');
    console.log('Can Transfer:', canTransfer);
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUserService();