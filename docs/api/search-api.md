# Search API Documentation

## Base URL
All API endpoints are prefixed with `/api`.

## Authentication
All endpoints require authentication using a JWT token included in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### Search Documents

#### GET `/search/documents`

Search for documents based on query and filters.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | No | Search query string |
| tags | string[] | No | Filter by tags (comma-separated) |
| folder | string | No | Filter by folder ID |
| project | string | No | Filter by project ID |
| fileType | string | No | Filter by file type (pdf, docx, etc.) |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 10) |
| sortBy | string | No | Sort field with optional - prefix for descending (e.g., '-updatedAt') |

**Success Response (200 OK):**

```json
{
  "documents": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "tags": ["string"],
      "fileType": "string",
      "fileSize": number,
      "createdAt": "ISO_DATE",
      "updatedAt": "ISO_DATE",
      "createdBy": {
        "id": "string",
        "name": "string",
        "email": "string"
      }
    }
  ],
  "pagination": {
    "total": number,
    "totalPages": number,
    "currentPage": number,
    "limit": number,
    "hasNextPage": boolean,
    "hasPreviousPage": boolean
  }
}
```

### Get Search Suggestions

#### GET `/search/suggestions`

Get search suggestions based on a query prefix.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | Yes | Search query prefix |

**Success Response (200 OK):**

```json
{
  "suggestions": ["string"]
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation Error",
  "message": "Error details",
  "statusCode": 400
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "No token provided",
  "statusCode": 401
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions",
  "statusCode": 403
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Resource not found",
  "statusCode": 404
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Error details",
  "statusCode": 500
}
```

## Rate Limiting
- 100 requests per minute per IP address
- 1000 requests per hour per user
