const colors = require('colors');

const requiredEnvVars = {
  NODE_ENV: {
    description: 'Node environment (development, production, test)',
    required: true,
  },
  MONGODB_URI: {
    description: 'MongoDB connection string',
    required: true,
    sensitive: true,
  },
  JWT_SECRET: {
    description: 'Secret key for JWT token generation',
    required: true,
    sensitive: true,
  },
  FRONTEND_URL: {
    description: 'Frontend URL for CORS and email links',
    required: true,
  },
  CORS_WHITELIST: {
    description: 'Comma-separated list of allowed CORS origins',
    required: true,
  }
};

const validateEnvVars = () => {
  console.log('\n🔍 Validating environment variables...'.cyan.bold);
  
  let isValid = true;
  const missingVars = [];
  const sensitiveVars = [];

  Object.entries(requiredEnvVars).forEach(([key, config]) => {
    const value = process.env[key];
    
    if (config.required && !value) {
      missingVars.push(`${key}: ${config.description}`);
      isValid = false;
    } else if (value && config.sensitive) {
      sensitiveVars.push(key);
    }
  });

  if (missingVars.length > 0) {
    console.error('\n❌ Missing required environment variables:'.red.bold);
    missingVars.forEach(v => console.error(`  - ${v}`.red));
  } else {
    console.log('✅ All required environment variables are set'.green);
  }

  if (sensitiveVars.length > 0) {
    console.log('\n🔒 Sensitive environment variables detected:'.yellow);
    sensitiveVars.forEach(v => console.log(`  - ${v}`.yellow));
  }

  console.log('\nEnvironment:'.cyan, process.env.NODE_ENV || 'not set');
  console.log('Node Version:'.cyan, process.version);
  console.log('Platform:'.cyan, `${process.platform} (${process.arch})`);

  if (!isValid) {
    console.error('\n❌ Environment validation failed. Please set the missing variables.'.red.bold);
    process.exit(1);
  }

  console.log('\n✅ Environment validation passed successfully!'.green.bold);
  return true;
};

// Run validation if this file is executed directly
if (require.main === module) {
  validateEnvVars();
}

module.exports = validateEnvVars;
