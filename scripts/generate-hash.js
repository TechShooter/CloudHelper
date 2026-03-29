#!/usr/bin/env node

/**
 * Script per generare il bcrypt hash di una password
 * Uso: node scripts/generate-hash.js
 * 
 * Chiede la password da hashare e stampa il hash da usare in .env.local
 */

const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n📝 CloudHelper Password Hash Generator\n');

rl.question('Enter your password: ', async (password) => {
  if (!password) {
    console.error('❌ Password cannot be empty');
    rl.close();
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    
    console.log('\n✅ Hash generated successfully!\n');
    console.log('Add this to your .env.local:\n');
    console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
    console.log('Example .env.local section:');
    console.log('---');
    console.log('ADMIN_EMAIL=your_email@example.com');
    console.log(`ADMIN_PASSWORD_HASH=${hash}`);
    console.log('JWT_SECRET=your-random-jwt-secret');
    console.log('---\n');
    
  } catch (error) {
    console.error('❌ Error generating hash:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
});
