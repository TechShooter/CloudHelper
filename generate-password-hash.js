#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter your desired password: ', async (password) => {
  if (!password) {
    console.error('Password cannot be empty');
    rl.close();
    process.exit(1);
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    console.log('\n✅ Password hash generated successfully!\n');
    console.log(`Password: ${password}`);
    console.log(`Hash length: ${hash.length}`);
    console.log(`\nHash (escaped for .env.local):`);
    console.log(hash.replace(/\$/g, '\\$'));
    console.log(`\nAdd this line to .env.local:`);
    console.log(`ADMIN_PASSWORD_HASH=${hash.replace(/\$/g, '\\$')}`);
    console.log('\nThen restart the dev server with: npm run dev\n');
  } catch (error) {
    console.error('Error generating hash:', error.message);
    process.exit(1);
  }

  rl.close();
});
