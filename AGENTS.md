# AGENTS.md

## Project Overview

This project is a Lambda function designed to initialize roles in a PostgreSQL database. It uses Node.js as the runtime environment and TypeScript for development. The project includes scripts for database setup and testing. Key technologies include:

- Node.js
- TypeScript
- AWS Lambda
- PostgreSQL

## Local development - setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Install the AWS CLI and configure it with the necessary credentials.

3. Set up environment variables:
   - `DB_MIGRATION_SECRET`: The secret ID for the database migration user credentials.
   - `DB_APP_SECRET`: The secret ID for the application user credentials.
   - `DB_ADMIN_DB`: The name of the admin database (default: `postgres`).
   - `DB_OWNER_ROLE`: The name of the database owner role (default: `postgres`).
   - `DB_MIGRATION_ROLE`: The name of the database migration role (default: `mig_grp`).
   - `DB_APP_ROLE`: The name of the application role (default: `app_grp`).
   - `DB_SCHEMA`: The name of the database schema (default: `public`).

4. The following three secrets must exist in AWS Secrets Manager and the user must have permissions to read them:
   - the superuser secret: secret containing username and password for the PostgreSQL superuser or admin user with permissions to create databases and roles
   - DB migration user secret: this contains credentials for a user which will have permissions to run the database migrations
   - DB app user secret: this contains credentials for a user which will have permissions to read and write data

The secrets must follow the default format described in the documentation: <https://docs.aws.amazon.com/secretsmanager/latest/userguide/reference_secret_json_structure.html>

Namely:

- The superuser secret must be a JSON in this format:

  ```json
  {
    "username": "<the username>",
    "password": "<the password>"
  }
  ```

- The app and migration secrets must be a JSON in this format:
  ```txt
  {
    "engine": "postgres",
    "host": "<instance host name/resolvable DNS name>",
    "username": "<username>",
    "password": "<password>",
    "dbname": "<database name. If not specified, defaults to 'postgres'>",
    "port": <TCP port number. If not specified, defaults to 5432>,
    "masterarn": "<optional: ARN of the elevated secret. Required for the Rotation strategy: alternating users.>",
    "dbInstanceIdentifier": <optional: ID of the instance. Alternately, use dbClusterIdentifier. Required for configuring rotation in the console.>",
    "dbClusterIdentifier": <optional: ID of the cluster. Alternately, use dbInstanceIdentifier. Required for configuring rotation in the console.>"
  }
  ```

The `masterarn` field must point to the ARN of the superuser secret.

## Development Workflow

1. Build:

   ```sh
   npm run build
   ```

2. Run the application locally:

   ```sh
   npm run local
   ```

## Code Style Guidelines

1. Linting:
   - Run the linter:
     ```sh
     npm run lint
     ```

2. Formatting:
   - Format the codebase:
     ```sh
     npm run format
     ```

## Build

```sh
docker build --tag "${IMAGE_TAG}" .
```

## Security Considerations

1. Secrets management:
   - Do not commit secrets to the repository.

2. Authentication:
   - Ensure AWS credentials are securely managed.

## PostgreSQL permissions

### Migration User Permissions

See the [script.sql.njk](script.sql.njk) Nunjucks template for details about the initialized permissions. Here's a summary:

The migration user (`{{ config.migrationUser }}`) will have the following permissions:

- **Database Level:**
  - `CONNECT` and `TEMPORARY` on the database `{{ config.dbName }}`.
  - `CREATE` on the database `{{ config.dbName }}`.

- **Schema Level:**
  - `USAGE` and `CREATE` on the schema `{{ config.dbSchema }}`.

- **Object Level:**
  - `ALL` privileges (SELECT, INSERT, UPDATE, DELETE, etc.) on all tables, sequences, and functions within the schema `{{ config.dbSchema }}`.

- **Default Privileges:**
  - Grants `SELECT`, `INSERT`, `UPDATE`, `DELETE` on tables to the app role and app user.
  - Grants `USAGE`, `SELECT`, `UPDATE` on sequences to the app role and app user.
  - Grants `EXECUTE` on functions to the app role and app user.

### Application User Permissions

The application user (`{{ config.appUser }}`) will have the following permissions:

- **Schema Level:**
  - `USAGE` on the schema `{{ config.dbSchema }}`.

- **Object Level:**
  - `SELECT` on all tables and sequences within the schema `{{ config.dbSchema }}`.
  - `INSERT`, `UPDATE`, `DELETE` on all tables within the schema `{{ config.dbSchema }}`.
  - `UPDATE` on all sequences within the schema `{{ config.dbSchema }}`.
  - `EXECUTE` on all functions within the schema `{{ config.dbSchema }}`.

- **Default Privileges:**
  - Automatically inherits privileges granted by the migration user for new tables, sequences, and functions.

## Additional Notes

- This project uses `npm` as the package manager.
- Update the `AGENTS.md` file as the project evolves to ensure it remains accurate and helpful.
