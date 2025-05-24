# Monitoring and Health Checks

This document outlines the monitoring and health check setup for Gideon's Tech Suite.

## Health Check Endpoints

### Main Health Check
- **Endpoint**: `GET /health`
- **Description**: Comprehensive health check including system metrics, database status, and application info
- **Response**: JSON with system status, metrics, and timestamps
- **Example Response**:
  ```json
  {
    "status": "UP",
    "timestamp": "2025-05-24T19:28:21.313Z",
    "service": "Gideon's Tech Suite API",
    "version": "1.0.0",
    "environment": "production",
    "system": {
      "platform": "linux",
      "arch": "x64",
      "nodeVersion": "v16.14.2",
      "uptime": 12345,
      "memory": {
        "rss": "120 MB",
        "heapTotal": "90 MB",
        "heapUsed": "70 MB",
        "external": "10 MB"
      },
      "cpu": {
        "cores": 4,
        "loadavg": [0.5, 0.8, 0.9],
        "uptime": 123456
      },
      "network": {
        "hostname": "server1",
        "interfaces": ["eth0", "lo"]
      }
    },
    "database": {
      "status": "connected",
      "readyState": 1,
      "dbVersion": "6.0.0",
      "collections": {
        "users": 150,
        "documents": 2450
      }
    },
    "metrics": {
      "responseTime": "12.345ms",
      "process": {
        "pid": 12345,
        "uptime": 12345,
        "memory": {
          "rss": 125829120,
          "heapTotal": 94371840,
          "heapUsed": 73400320,
          "external": 10485760
        },
        "cpuUsage": {
          "user": 1234567,
          "system": 234567
        }
      }
    }
  }
  ```

### API Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Lightweight health check for API status
- **Response**: Simple JSON with API status

## Monitoring Setup

### Logging
- **Framework**: Winston with Logtail integration
- **Log Levels**: error, warn, info, debug
- **Log Files**:
  - `logs/error.log`: Error logs only
  - `logs/combined.log`: All logs
  - `logs/exceptions.log`: Uncaught exceptions

### Environment Variables
```
# Logging
LOG_LEVEL=info  # Set to 'debug' for development
LOGTAIL_SOURCE_TOKEN=your_logtail_source_token  # Optional: For cloud logging

# Health Check
HEALTH_CHECK_PATH=/health
HEALTH_CHECK_INTERVAL=30000  # 30 seconds
```

## Setting Up Monitoring

1. **Local Development**:
   - Logs are written to the `logs/` directory
   - View logs using `tail -f logs/combined.log`

2. **Production**:
   - Set up Logtail for cloud logging (optional)
   - Configure log rotation in your deployment
   - Set up alerts for errors and critical issues

3. **Log Rotation**:
   - Logs are rotated when they reach 5MB
   - Keeps up to 5 backup files per log type

## Alerting

Set up alerts for:
- Error rate > 1% of requests
- Response time > 2s (p95)
- Memory usage > 80%
- CPU usage > 80% for 5 minutes

## Performance Monitoring

Key metrics to monitor:
- Request/response times
- Error rates
- Memory usage
- CPU usage
- Database query performance
- API endpoint response times
