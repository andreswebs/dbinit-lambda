import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Pool, type PoolConfig } from 'pg';
import typia from 'typia';
import { getDBSecret, getSecret, createDB, configureDB } from './utils.js';
import type { Credentials, DBSecretStrict, DBConfig } from './types.js';

const localRun = process.env.LOCAL_RUN;

const dbMigrationSecretID = process.env.DB_MIGRATION_SECRET;
const dbAppSecretID = process.env.DB_APP_SECRET;
const adminDBName = process.env.DB_ADMIN_DB || 'postgres';
const dbOwnerRoleName = process.env.DB_OWNER_ROLE || 'postgres';
const dbMigrationRoleName = process.env.DB_MIGRATION_ROLE || 'mig_grp';
const dbSchemaName = process.env.DB_SCHEMA || 'public';

// https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html
const caBundleFile = process.env.DB_CA_BUNDLE_FILE || 'rds-ca-global-bundle.pem';

let dbAppRoleName: string | undefined = process.env.DB_APP_ROLE || 'app_grp';
let smClient: SecretsManagerClient;
let masterCredentials: Credentials;
let dbMigrationSecret: DBSecretStrict;
let dbAppSecret: DBSecretStrict;
let adminConnPool: Pool;
let dbConnPool: Pool;
let ca: string | undefined;

async function init() {
  if (!dbMigrationSecretID) {
    throw new Error('error: env var DB_MIGRATION_SECRET must not be empty');
  }

  if (!dbAppSecretID) {
    dbAppRoleName = undefined;
  }

  if (!smClient) {
    smClient = new SecretsManagerClient({});
  }

  if (!dbMigrationSecret) {
    dbMigrationSecret = await getDBSecret(smClient, dbMigrationSecretID);
  }

  if (!dbAppSecret && dbAppSecretID) {
    dbAppSecret = await getDBSecret(smClient, dbAppSecretID);
  }

  if (!ca) {
    ca = existsSync(caBundleFile) ? readFileSync(resolve(caBundleFile)).toString() : undefined;
  }

  if (
    dbAppSecret &&
    (dbAppSecret.host !== dbMigrationSecret.host ||
      dbAppSecret.port !== dbMigrationSecret.port ||
      dbAppSecret.engine !== dbMigrationSecret.engine ||
      dbAppSecret.masterarn !== dbMigrationSecret.masterarn)
  ) {
    throw new Error('error: app secret does not match migration secret');
  }

  if (!masterCredentials) {
    masterCredentials = typia.assert<Credentials>(
      await getSecret(smClient, dbMigrationSecret.masterarn),
    );
  }

  const { host: remoteHost, port, dbname: database } = dbMigrationSecret;
  const { username: user, password } = masterCredentials;

  // allow overriding the host, to be able to use a bastion
  const host = process.env.PGHOST || remoteHost;

  if (!adminConnPool) {
    let poolConfig: PoolConfig = {
      host,
      port,
      database: adminDBName,
      user,
      password,
    };
    if (ca) {
      poolConfig = {
        ...poolConfig,
        ssl: { ca },
      };
    }
    adminConnPool = new Pool(poolConfig);
  }

  if (!dbConnPool) {
    let poolConfig: PoolConfig = {
      host,
      port,
      database,
      user,
      password,
    };
    if (ca) {
      poolConfig = {
        ...poolConfig,
        ssl: { ca },
      };
    }
    dbConnPool = new Pool(poolConfig);
  }

  return { adminConnPool, dbConnPool, dbMigrationSecret, dbAppSecret };
}

async function shutdown() {
  if (adminConnPool) {
    await adminConnPool.end();
  }
  if (dbConnPool) {
    await dbConnPool.end();
  }
  process.exit(0);
}

async function handler() {
  const { adminConnPool, dbConnPool, dbMigrationSecret, dbAppSecret } = await init();

  const {
    dbname: dbName,
    username: migrationUser,
    password: migrationPassword,
  } = dbMigrationSecret;

  const { username: appUser, password: appPassword } = dbAppSecret ?? {};

  const dbConfig: DBConfig = {
    dbName,
    dbSchema: dbSchemaName,
    ownerRole: dbOwnerRoleName,
    migrationRole: dbMigrationRoleName,
    migrationUser,
    migrationPassword,
    appRole: dbAppRoleName,
    appUser,
    appPassword,
  };

  await createDB(adminConnPool, dbName);
  await configureDB(dbConnPool, dbConfig);
}

['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, shutdown));

if (localRun) {
  handler()
    .then(shutdown)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

export { handler };
