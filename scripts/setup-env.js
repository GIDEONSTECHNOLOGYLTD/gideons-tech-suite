#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m'
};

// Configuration
const envConfig = {
  NODE_ENV: {
    description: 'Node environment (development/production)',
    default: 'development',
    required: true
  },
  PORT: {
    description: 'Port to run the server on',
    default: '5000',
    required: true
  },
  MONGODB_URI: {
    description: 'MongoDB connection string',
    default: '',
    required: true,
    sensitive: true
  },
  JWT_SECRET: {
    description: 'Secret key for JWT tokens',
    default: require('crypto').randomBytes(32).toString('hex'),
    required: true,
    sensitive: true
  },
  JWT_EXPIRE: {
    description: 'JWT expiration time',
    default: '30d',
    required: true
  },
  JWT_COOKIE_EXPIRE: {
    description: 'JWT cookie expiration in days',
    default: '30',
    required: true
  },
  FRONTEND_URL: {
    description: 'Frontend URL for CORS and email links',
    default: 'http://localhost:3000',
    required: true
  },
  CORS_WHITELIST: {
    description: 'Comma-separated list of allowed CORS origins',
    default: 'http://localhost:3000',
    required: true
  }
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });};

const generateEnvFile = async (envVars, env = 'development') => {
  const envPath = path.join(__dirname, '..', 'backend', 'config', `${env}.env`);
  let envContent = `# Auto-generated environment configuration\n# Generated at: ${new Date().toISOString()}\n\n`;

  for (const [key, config] of Object.entries(envVars)) {
    const value = config.value || config.default || '';
    envContent += `# ${config.description}\n${key}=${value}\n\n`;
  }

  try {
    fs.writeFileSync(envPath, envContent);
    console.log(`\n✅ Environment file created at: ${envPath}`.green);
    return true;
  } catch (error) {
    console.error(`\n❌ Error creating environment file: ${error.message}`.red);
    return false;
  }
};

const main = async () => {
  console.log('\n🚀 Setting up environment configuration\n'.cyan.bold);
  
  const envVars = { ...envConfig };
  const env = (await question(`Enter environment (${colors.cyan}development${colors.reset}/${colors.cyan}production${colors.reset}): `) || 'development').toLowerCase();
  
  // Set NODE_ENV
  envVars.NODE_ENV.value = env === 'production' ? 'production' : 'development';
  
  // Ask for values
  for (const [key, config] of Object.entries(envVars)) {
    if (key === 'NODE_ENV') continue;
    
    const defaultValue = config.default || '';
    const isSensitive = config.sensitive ? ' (sensitive)' : '';
    const input = await question(
      `${config.description}${isSensitive} [${colors.yellow}${key}${colors.reset}]: \n${colors.dim}${defaultValue ? `(default: ${defaultValue}) ` : ''}${colors.reset}${isSensitive ? '••••••••' : ''}`
    );
    
    if (input || config.required) {
      envVars[key].value = input || defaultValue;
    }
  }
  
  // Generate .env file
  const success = await generateEnvFile(envVars, env);
  
  if (success) {
    console.log('\n🎉 Environment setup completed successfully!'.green.bold);
    console.log('\nNext steps:'.cyan);
    console.log(`1. Review the generated .env file in backend/config/${env}.env`);
    console.log('2. Make sure to add this file to .gitignore');
    console.log('3. Restart your server for changes to take effect\n');
  }
  
  rl.close();
};

// Run the setup
main().catch(error => {
  console.error('\n❌ An error occurred during setup:'.red.bold);
  console.error(error);
  process.exit(1);
});
