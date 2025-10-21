import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager';

import { Pool } from 'pg';
import typia from 'typia';
import nunjucks from 'nunjucks';
import type { DBSecret, DBSecretStrict, DBConfig } from './types.js';

export async function getSecret(client: SecretsManagerClient, SecretId: string): Promise<unknown> {
  const secretOutput: GetSecretValueCommandOutput = await client.send(
    new GetSecretValueCommand({ SecretId }),
  );
  const secret: unknown = JSON.parse(secretOutput.SecretString ?? '{}');
  return secret;
}

export function ensureInt(input: string | number, errMsg?: string) {
  if (!errMsg) {
    errMsg = 'error: input is not a number';
  }
  const output = parseInt(String(input));
  if (isNaN(output)) {
    throw new Error(errMsg);
  }
  return output;
}

export async function getDBSecret(client: SecretsManagerClient, secretID: string) {
  const secretFmtErrorMsg =
    'error: invalid secret format; expected format as in <https://docs.aws.amazon.com/secretsmanager/latest/userguide/reference_secret_json_structure.html>';
  try {
    const secretTmp = typia.assertEquals<DBSecret>(await getSecret(client, secretID));
    const portStringOrNumber = secretTmp.port;
    const secret: DBSecretStrict = {
      ...secretTmp,
      port: ensureInt(portStringOrNumber, `${secretFmtErrorMsg}; the port is not a number`),
    };
    return secret;
  } catch (e) {
    if (e instanceof typia.TypeGuardError) {
      console.error(secretFmtErrorMsg);
    }
    throw e;
  }
}

export async function createDB(connPool: Pool, dbName: string) {
  if (!dbName) {
    throw new Error('error: database name cannot be empty');
  }

  const client = await connPool.connect();

  try {
    const res = await client.query(
      `SELECT datname FROM pg_catalog.pg_database WHERE datname = '${dbName}'`,
    );

    if (res.rowCount === 0) {
      console.log(`database ${dbName} does not exist`);
      await client.query(`CREATE DATABASE "${dbName}";`);
      console.log(`created database ${dbName}`);
    } else {
      console.log(`${dbName} database exists`);
    }
  } finally {
    client.release();
  }
}

export function getSQLScript(config: DBConfig) {
  const sqlScriptFile = 'script.sql.njk';
  nunjucks.configure('.');
  return nunjucks.render(sqlScriptFile, { config });
}

export async function runSQLScript(connPool: Pool, sqlScript: string) {
  const client = await connPool.connect();
  try {
    await client.query(sqlScript);
  } finally {
    client.release();
  }
}

export async function configureDB(connPool: Pool, dbConfig: DBConfig) {
  const sqlScript = getSQLScript(dbConfig);
  await runSQLScript(connPool, sqlScript);
  console.log(`configured database ${dbConfig.dbName}`);
}
