const path = require('path');
const fs = require('fs');
const colors = require('colors');

class EnvConfig {
  constructor() {
    // Define all required environment variables with validation rules
    this.requiredVars = {
      MONGODB_URI: {
        description: 'MongoDB connection string',
        validate: (value) => {
          if (!value) return 'is required';
          try {
            const url = new URL(value);
            if (!url.protocol.startsWith('mongodb')) {
              return 'must start with mongodb:// or mongodb+srv://';
            }
            if (!url.hostname) return 'must include a valid hostname';
          } catch (err) {
            return 'is not a valid URL';
          }
          return null;
        }
      },
      JWT_SECRET: {
        description: 'JWT secret key for authentication',
        validate: (value) => {
          if (!value) return 'is required';
          if (process.env.NODE_ENV === 'production' && value.length < 32) {
            return 'must be at least 32 characters long in production';
          }
          return null;
        }
      },
      FRONTEND_URL: {
        description: 'Frontend URL for CORS',
        validate: (value) => {
          if (!value) return 'is required';
          try {
            new URL(value);
          } catch (err) {
            return 'must be a valid URL';
          }
          return null;
        }
      }
    };
    
        // Define sensitive keys that should be masked in logs
    this.sensitiveKeys = [
      'SECRET', 'PASSWORD', 'TOKEN', 'KEY', 'MONGODB_URI', 'JWT', 'API_KEY',
      'AUTH', 'CREDENTIAL', 'PWD', 'PRIVATE', 'ENCRYPT', 'DECRYPT', 'SIGNATURE'
    ];
    
    // Check if running in production
    this.isProduction = () => {
      return process.env.NODE_ENV === 'production' || 
             process.env.VERCEL_ENV === 'production' ||
             process.env.NOW_REGION ||
             process.env.VERCEL === '1';
    };
    
    // Skip these environment variables in logs
    this.skipLoggingKeys = [
      // System variables
      'NODE_', 'npm_', 'PATH', 'HOME', 'PWD', 'LANG', 'SHLVL', 'USER', 'LC_', 'TERM', 'SHELL',
      // Package managers
      'BUN_', 'YARN_', 'NPM_', 'NVM_', 'PNPM_',
      // Container/Platform specific
      'RENDER_', 'KUBERNETES_', 'DOCKER_', 'AWS_', 'GCP_', 'HEROKU_', 'VERCEL_',
      // Python
      'PYTHON_', 'PIP_', 'VIRTUAL_ENV', 'CONDA_', 'PYENV_',
      // Other
      'EDITOR', 'COLOR', 'TMPDIR', 'XDG_', 'WTFORMS_', 'WT_', 'PIPENV_'
    ];
    
    this.loaded = false;
    this.isProduction = process.env.NODE_ENV === 'production';
  }
  
  load() {
    if (this.loaded) return;
    
    console.log('\n🔍 Loading environment configuration...'.blue);
    
    // Always try to load .env file in development, but don't fail if it doesn't exist
    if (!this.isProduction) {
      this.loadEnvFile();
    } else {
      console.log('🚀 Production environment detected, skipping .env file'.green);
    }
    
    // Validate all required variables
    const validationErrors = this.validate();
    
    // Log environment summary (masking sensitive data)
    this.logEnvironment();
    
    if (validationErrors.length > 0) {
      console.error('\n❌ Environment configuration errors:'.red);
      validationErrors.forEach(({ key, error }) => {
        console.error(`- ${key}: ${error}`.red);
      });
      console.error('\nPlease fix the above configuration issues and restart the server.\n'.red);
      process.exit(1);
    }
    
    this.loaded = true;
    console.log('✅ Environment configuration loaded successfully\n'.green);
  }
  
  loadEnvFile() {
    try {
      // Try to load from backend directory first
      const envPath = path.resolve(__dirname, '../.env');
      const rootEnvPath = path.resolve(__dirname, '../../.env');
      
      if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        console.log('✅ Loaded .env file from backend directory'.green);
      } else if (fs.existsSync(rootEnvPath)) {
        require('dotenv').config({ path: rootEnvPath });
        console.log('✅ Loaded .env file from root directory'.green);
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  Warning: .env file not found in backend or root directory'.yellow);
      }
    } catch (error) {
      console.error('❌ Error loading .env file:'.red, error.message);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
  
  validate() {
    const errors = [];
    
    Object.entries(this.requiredVars).forEach(([key, config]) => {
      const value = process.env[key];
      
      // Check if variable exists
      if (value === undefined || value === '') {
        errors.push({
          key,
          error: `is required (${config.description})`
        });
        return;
      }
      
      // Run custom validation if provided
      if (typeof config.validate === 'function') {
        const validationError = config.validate(value);
        if (validationError) {
          errors.push({
            key,
            error: validationError
          });
        }
      }
    });
    
    return errors;
  }
  
  validateMongoDBUri() {
    if (!process.env.MONGODB_URI) return;
    
    try {
      const url = new URL(process.env.MONGODB_URI);
      if (!url.pathname || url.pathname === '/') {
        console.warn('⚠️  Warning: MongoDB URI does not specify a database name'.yellow);
        console.warn('   Example: mongodb+srv://user:pass@cluster0.xyz.mongodb.net/your_database_name'.yellow);
      }
    } catch (error) {
      console.error('❌ Invalid MONGODB_URI:'.red, error.message);
      process.exit(1);
    }
  }
  
  logEnvironment() {
    console.log('\n=== Environment Summary ==='.blue);
    
    // Basic system info
    console.log(`Node.js: ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
    console.log(`Environment: ${this.isProduction ? 'PRODUCTION'.red.bold : 'development'.green}`);
    
    // Application environment variables
    console.log('\n🔧 Application Configuration:'.underline);
    
    const envVars = Object.keys(process.env)
      .filter(key => !this.skipLoggingKeys.some(skipKey => key.startsWith(skipKey)))
      .sort();
    
    if (envVars.length === 0) {
      console.log('No environment variables found'.yellow);
    } else {
      envVars.forEach(key => {
        const isSensitive = this.sensitiveKeys.some(sk => 
          key.toUpperCase().includes(sk)
        );
        
        let value = process.env[key];
        
        // Mask sensitive values
        if (isSensitive) {
          value = '********';
          
          // Special handling for MongoDB URI to show some useful info
          if (key === 'MONGODB_URI') {
            try {
              const url = new URL(process.env[key]);
              value = `${url.protocol}//${url.hostname}${url.pathname}?${url.searchParams}`;
              value = value.replace(/(mongodb\+srv:\/\/[^:]+:)[^@]+@/, '$1********@');
            } catch (e) {
              // If we can't parse the URL, just use the masked value
            }
          }
        }
        
        console.log(`- ${key}: ${value}`);
      });
    }
    
    // Log required variables status
    console.log('\n✅ Required Configuration:'.underline);
    Object.entries(this.requiredVars).forEach(([key, config]) => {
      const value = process.env[key];
      const status = value ? '✓'.green : '✗'.red;
      console.log(`  ${status} ${key}: ${config.description}`);
    });
    
    console.log('==========================\n'.blue);
  }
  
  get(key, defaultValue = null) {
    return process.env[key] || defaultValue;
  }
  
  getRequired(key) {
    const value = process.env[key];
    if (!value) {
      console.error(`❌ Required environment variable not found: ${key}`.red);
      process.exit(1);
    }
    return value;
  }
  
  isProduction() {
    return process.env.NODE_ENV === 'production';
  }
  
  isDevelopment() {
    return !this.isProduction();
  }
}

// Create and export a singleton instance
const env = new EnvConfig();
module.exports = env;
